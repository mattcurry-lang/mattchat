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

const SpeechRecognitionImpl =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

export function useCurryVoice() {
  const supported = !!SpeechRecognitionImpl && typeof window !== 'undefined' && 'speechSynthesis' in window

  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [volume, setVolume] = useState(0) // 0–1 live mic amplitude, only meaningful while listening
  const [transcript, setTranscript] = useState('') // interim + final, for live captions

  const recognitionRef = useRef(null)
  const audioCtxRef = useRef(null)
  const micStreamRef = useRef(null)
  const rafRef = useRef(null)
  const onFinalRef = useRef(null)

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

  // onFinalTranscript(text) fires once per completed utterance.
  const start = useCallback((onFinalTranscript) => {
    if (!supported || listening) return
    onFinalRef.current = onFinalTranscript

    const recognition = new SpeechRecognitionImpl()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript
        if (event.results[i].isFinal) final += chunk
        else interim += chunk
      }
      setTranscript((final || interim).trim())
      if (final.trim()) onFinalRef.current?.(final.trim())
    }
    recognition.onerror = (event) => {
      console.error('Curry voice: speech recognition error:', event.error)
      setListening(false)
      stopVolumeLoop()
    }
    recognition.onend = () => {
      setListening(false)
      stopVolumeLoop()
    }

    recognitionRef.current = recognition
    setTranscript('')
    setListening(true)
    recognition.start()
    startVolumeLoop()
  }, [supported, listening, startVolumeLoop, stopVolumeLoop])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
    stopVolumeLoop()
  }, [stopVolumeLoop])

  const speak = useCallback((text) => {
    if (!supported || !text) return
    window.speechSynthesis.cancel() // never let two replies overlap
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [supported])

  const cancelSpeech = useCallback(() => {
    if (supported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  // Release the mic and stop any speech if the component unmounts
  // mid-conversation (e.g. the student closes Curry while it's talking).
  useEffect(() => {
    return () => {
      stop()
      cancelSpeech()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup
  }, [])

  return { supported, listening, speaking, volume, transcript, start, stop, speak, cancelSpeech }
}
