// src/hooks/useCurryVoice.js
//
// Voice mode for Curry.
//   - Speech-to-text: browser SpeechRecognition, tap-to-start/tap-to-stop.
//     continuous: true so Chrome doesn't auto-timeout the session after a
//     short pause (that was the "says Listening then disappears" bug).
//     Errors are surfaced via `error`, not silently swallowed — a "network"
//     error here almost always means the browser itself (e.g. Brave)
//     can't reach the speech backend, not an actual connectivity problem;
//     it's a hard browser limitation, not something this code can fix.
//   - Text-to-speech: your own ElevenLabs `curry-tts` edge function — same
//     voice as the main assistant everywhere else in Mattchat. Mirrors
//     CurryAIChat.jsx's speakWithElevenLabs exactly: raw fetch with the
//     user's access token, then arrayBuffer -> AudioContext.decodeAudioData
//     -> AudioBufferSourceNode. supabase.functions.invoke() was tried
//     first but doesn't reliably hand back binary audio the same way this
//     project's own working implementation does, so this matches that
//     implementation instead of reinventing it. Falls back to the
//     browser's built-in voice only if the ElevenLabs call itself fails,
//     so voice mode never just goes silent.
//   - Live mic amplitude (getUserMedia + AnalyserNode) so the orb reacts
//     to the student's actual voice while listening.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Matches the main assistant's own setup exactly (see CurryAIChat.jsx's
// speakWithElevenLabs) — same project, same deployed function name.
const SUPABASE_URL = 'https://bqerkvywgxoioocbkxif.supabase.co'
const TTS_URL = `${SUPABASE_URL}/functions/v1/curry-tts`

const SpeechRecognitionImpl =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

export function useCurryVoice() {
  const supported = !!SpeechRecognitionImpl && typeof window !== 'undefined' && 'speechSynthesis' in window

  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [volume, setVolume] = useState(0) // 0–1 live mic amplitude, only meaningful while listening
  const [transcript, setTranscript] = useState('') // interim + final, for live captions
  const [error, setError] = useState(null) // last recognition problem, surfaced to the UI instead of silently reverting

  const recognitionRef = useRef(null)
  const micAudioCtxRef = useRef(null) // AudioContext for the mic-volume analyser (listening)
  const micStreamRef = useRef(null)
  const rafRef = useRef(null)
  const onFinalRef = useRef(null)
  const finalTextRef = useRef('') // accumulates finalized speech across the whole listening session

  const ttsAudioCtxRef = useRef(null) // AudioContext for ElevenLabs playback (speaking)
  const ttsSourceRef = useRef(null)

  const stopVolumeLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    if (micAudioCtxRef.current) {
      micAudioCtxRef.current.close().catch(() => {})
      micAudioCtxRef.current = null
    }
    setVolume(0)
  }, [])

  // Best-effort only — if this fails, recognition itself still works
  // fine without the amplitude visualization.
  const startVolumeLoop = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      micAudioCtxRef.current = ctx
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

  const stopTtsPlayback = useCallback(() => {
    try { ttsSourceRef.current?.stop() } catch (e) { /* already stopped */ }
    ttsSourceRef.current = null
    if (ttsAudioCtxRef.current) {
      ttsAudioCtxRef.current.close().catch(() => {})
      ttsAudioCtxRef.current = null
    }
  }, [])

  // Speaks via ElevenLabs (curry-tts) — same voice as the main assistant.
  // Falls back to the browser's built-in voice ONLY if that call fails,
  // so voice mode never just goes silent from a network hiccup or quota.
  const speak = useCallback(async (text) => {
    if (!text) return
    cancelSpeech()
    setSpeaking(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('not signed in')

      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error(`curry-tts returned ${res.status}`)

      const arrayBuffer = await res.arrayBuffer()
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
      const source = audioCtx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioCtx.destination)
      ttsAudioCtxRef.current = audioCtx
      ttsSourceRef.current = source

      await new Promise((resolve) => {
        source.onended = () => { setSpeaking(false); resolve() }
        source.start(0)
      })
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
   
  }, [supported])

  const cancelSpeech = useCallback(() => {
    stopTtsPlayback()
    if (supported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported, stopTtsPlayback])

  // Release the mic and stop any speech if the component unmounts
  // mid-conversation (e.g. the student closes Curry while it's talking).
  useEffect(() => {
    return () => {
      stop()
      cancelSpeech()
    }
    
  }, [])

  return { supported, listening, speaking, volume, transcript, error, start, stop, speak, cancelSpeech }
}
