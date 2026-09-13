// src/hooks/useCurryVoice.js
//
// Voice mode for Curry — entirely browser-native (Web Speech API), no
// extra paid API. Two independent capabilities:
//   - Speech-to-text: SpeechRecognition, tap-to-start/tap-to-stop (not
//     auto-silence-detection — more predictable across browsers).
//   - Text-to-speech: SpeechSynthesis for Curry's spoken replies.
// Plus live mic amplitude (via getUserMedia + AnalyserNode) so the orb
// can visually react to the student's actual voice while listening,
// not just a generic animation.
//
// Browser support: solid in Chrome/Edge, inconsistent/absent in Firefox
// and older Safari. `supported` reflects this — callers should hide
// voice mode entirely when it's false rather than show a broken button.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Name of the deployed ElevenLabs TTS edge function — confirm this matches
// your actual function folder name (supabase/functions/<name>/index.ts).
// It takes { text } and streams back audio/mpeg.
const TTS_FUNCTION_NAME = 'text-to-speech'

const SpeechRecognitionImpl =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

export function useCurryVoice() {
  const supported = !!SpeechRecognitionImpl && typeof window !== 'undefined' && 'speechSynthesis' in window

  // Brave strips the Google API key Chrome's SpeechRecognition depends
  // on, so recognition.start() always fails there with a generic
  // "network" error — regardless of actual connectivity. This is a
  // long-standing, unresolved Brave limitation, not a bug here. Detect
  // it up front so Curry can say that plainly instead of implying the
  // student's internet is the problem.
  const [isBrave, setIsBrave] = useState(false)
  useEffect(() => {
    let cancelled = false
    navigator.brave?.isBrave?.().then((result) => { if (!cancelled) setIsBrave(!!result) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [volume, setVolume] = useState(0) // 0–1 live mic amplitude, only meaningful while listening
  const [transcript, setTranscript] = useState('') // interim + final, for live captions
  const [error, setError] = useState(null) // last recognition problem, surfaced to the UI instead of silently reverting

  const recognitionRef = useRef(null)
  const audioCtxRef = useRef(null)
  const micStreamRef = useRef(null)
  const rafRef = useRef(null)
  const onFinalRef = useRef(null)
  const finalTextRef = useRef('') // accumulates finalized speech across the whole listening session
  const audioRef = useRef(null) // currently-playing ElevenLabs audio element, if any
  const audioUrlRef = useRef(null) // its object URL, so we can revoke it on cleanup

  const stopVolumeLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    setVolume(0)
  }, [])

  // Best-effort only — if a browser blocks getUserMedia or something
  // else goes wrong here, recognition itself still works fine without
  // the amplitude visualization.
  const startVolumeLoop = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setVolume(Math.min(1, avg / 100))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (err) {
      console.error('Curry voice: mic amplitude loop unavailable (recognition continues without it):', err)
    }
  }, [])

  // onFinalTranscript(text) fires once, when the student taps to stop
  // listening (or the browser ends the session) — not per recognized
  // chunk, so a longer sentence isn't cut into multiple sent messages.
  const start = useCallback((onFinalTranscript) => {
    if (!supported || listening) return
    onFinalRef.current = onFinalTranscript
    finalTextRef.current = ''
    setError(null)

    const recognition = new SpeechRecognitionImpl()
    // continuous: true — with `false`, Chrome auto-stops the session
    // after a very short window if it doesn't detect speech starting
    // right away, which is exactly the "says Listening then disappears"
    // bug. continuous keeps the mic open until the student explicitly
    // taps stop (or a real error occurs).
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTextRef.current += (finalTextRef.current ? ' ' : '') + chunk
        else interim += chunk
      }
      setTranscript((finalTextRef.current + ' ' + interim).trim())
    }
    recognition.onerror = (event) => {
      console.error('Curry voice: speech recognition error:', event.error)
      const messages = {
        'no-speech': "Didn't catch anything — tap the beacon to try again.",
        'not-allowed': 'Microphone access is blocked — check your browser permissions.',
        'audio-capture': 'No microphone found — check your device.',
        network: 'Voice recognition needs an internet connection.',
      }
      setError(messages[event.error] || 'Something interrupted voice mode — tap to try again.')
      setListening(false)
      stopVolumeLoop()
    }
    recognition.onend = () => {
      setListening(false)
      stopVolumeLoop()
      // Send whatever was actually captured, however the session ended
      // (explicit stop() or the browser closing it) — never drop speech
      // the student already gave just because the session ended.
      const finalText = finalTextRef.current.trim()
      if (finalText) onFinalRef.current?.(finalText)
    }

    recognitionRef.current = recognition
    setTranscript('')
    setListening(true)
    recognition.start()
    startVolumeLoop()
  }, [supported, listening, startVolumeLoop, stopVolumeLoop])

  // Stopping just ends the recognition session — onend (above) is the
  // single place that sends the accumulated transcript, so there's only
  // ever one send path regardless of why listening stopped.
  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const cleanupAudio = useCallback(() => {
    audioRef.current?.pause()
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    audioRef.current = null
  }, [])

  // Speaks via your ElevenLabs TTS function (same voice as the main
  // assistant everywhere else in Mattchat). Falls back to the browser's
  // built-in voice ONLY if that call fails — so voice mode never just
  // goes silent because of a network hiccup or a quota limit.
  const speak = useCallback(async (text) => {
    if (!text) return
    cancelSpeech()
    setSpeaking(true)

    try {
      const { data, error } = await supabase.functions.invoke(TTS_FUNCTION_NAME, { body: { text } })
      if (error) throw error
      // supabase-js returns a Blob for a non-JSON (audio/mpeg) response.
      const audioUrl = URL.createObjectURL(data)
      audioUrlRef.current = audioUrl
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => { setSpeaking(false); cleanupAudio() }
      audio.onerror = () => { setSpeaking(false); cleanupAudio() }
      await audio.play()
    } catch (err) {
      console.error('Curry voice: ElevenLabs TTS failed, falling back to browser voice:', err)
      if (!supported) { setSpeaking(false); return }
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
    }
  }, [supported, cleanupAudio])

  const cancelSpeech = useCallback(() => {
    cleanupAudio()
    if (supported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported, cleanupAudio])

  // Release the mic and stop any speech if the component unmounts
  // mid-conversation (e.g. the student closes Curry while it's talking).
  useEffect(() => {
    return () => {
      stop()
      cancelSpeech()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup
  }, [])

  return { supported, listening, speaking, volume, transcript, error, start, stop, speak, cancelSpeech }
}
