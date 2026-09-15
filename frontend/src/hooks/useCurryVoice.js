// src/hooks/useCurryVoice.js
//
// Voice mode for Curry, rebuilt to match the main assistant's own
// working implementation (see CurryAIChat.jsx's VoiceMode) instead of
// the browser's SpeechRecognition API.
//
// Why the switch: SpeechRecognition doesn't run locally — it streams
// audio to Google's speech servers, which only Chrome and Edge have a
// working connection to. Brave (and Vivaldi, Opera) expose the same
// JS API but always fail with a "network" error, permanently, by
// design — no amount of client-side fixing changes that. MediaRecorder
// + a real transcription endpoint is plain WebRTC audio capture, which
// works the same everywhere, so this sidesteps the problem entirely
// rather than working around it.
//
// Flow, mirroring the reference exactly:
//   listening (record + watch volume) -> silence detected ->
//   thinking (transcribe, then send to Curry) -> speaking (ElevenLabs) ->
//   back to listening, automatically. start()/stop() control the whole
//   loop, not a single turn.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Matches the main assistant's own setup exactly.
const SUPABASE_URL = 'https://bqerkvywgxoioocbkxif.supabase.co'
const TTS_URL = `${SUPABASE_URL}/functions/v1/curry-tts`
const TRANSCRIBE_URL = `${SUPABASE_URL}/functions/v1/voice-transcribe`

const SILENCE_THRESHOLD = 8
const SILENCE_DURATION = 1400

export function useCurryVoice() {
  // MediaRecorder + getUserMedia is plain WebRTC — supported in every
  // modern browser, including Brave, unlike SpeechRecognition.
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined'

  const [status, setStatus] = useState('idle') // 'idle' | 'listening' | 'thinking' | 'speaking'
  const [volume, setVolume] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)

  const stoppedRef = useRef(true)
  const processingRef = useRef(false)
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const silenceTimerRef = useRef(null)
  const hasSpokenRef = useRef(false)
  const animFrameRef = useRef(null)
  const onTurnRef = useRef(null) // async (transcribedText) => replyText | null

  const ttsAudioCtxRef = useRef(null)
  const ttsSourceRef = useRef(null)

  const cleanupRecording = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    clearTimeout(silenceTimerRef.current)
    try { recorderRef.current?.stop() } catch (e) { /* already stopped */ }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    try { audioCtxRef.current?.close() } catch (e) { /* already closed */ }
    setVolume(0)
  }, [])

  const monitorVolume = useCallback(() => {
    if (!analyserRef.current || stoppedRef.current) return
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)
    const avg = data.reduce((a, b) => a + b, 0) / data.length
    setVolume(Math.min(1, avg / 100))

    if (avg > SILENCE_THRESHOLD) {
      hasSpokenRef.current = true
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        if (hasSpokenRef.current && !processingRef.current) finishRecording()
      }, SILENCE_DURATION)
    }
    animFrameRef.current = requestAnimationFrame(monitorVolume)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finishRecording is stable enough here
  }, [])

  const startListening = useCallback(async () => {
    if (stoppedRef.current) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser
      chunksRef.current = []
      hasSpokenRef.current = false

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start(100)
      recorderRef.current = recorder

      setStatus('listening')
      setTranscript('')
      monitorVolume()
    } catch (err) {
      console.error('Curry voice: mic error:', err)
      setError('Microphone access is blocked — check your browser permissions.')
      setStatus('idle')
      stoppedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- monitorVolume is stable enough here
  }, [])

  async function finishRecording() {
    if (processingRef.current) return
    processingRef.current = true
    cancelAnimationFrame(animFrameRef.current)
    clearTimeout(silenceTimerRef.current)
    recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    try { audioCtxRef.current?.close() } catch (e) { /* already closed */ }
    setVolume(0)
    await new Promise((r) => setTimeout(r, 200)) // let the final dataavailable event land

    if (chunksRef.current.length === 0) {
      processingRef.current = false
      if (!stoppedRef.current) startListening()
      return
    }

    setStatus('thinking')
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('not signed in')

      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      const res = await fetch(TRANSCRIBE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Transcription failed')

      const text = (data.text || '').trim()
      if (stoppedRef.current) { processingRef.current = false; return }
      if (!text) { processingRef.current = false; if (!stoppedRef.current) startListening(); return }

      setTranscript(text)
      const replyText = await onTurnRef.current?.(text)
      if (!stoppedRef.current && replyText) {
        await speak(replyText)
      }
    } catch (err) {
      console.error('Curry voice: turn failed:', err)
      setError("Didn't catch that — check your connection and try again.")
    }

    processingRef.current = false
    if (!stoppedRef.current) startListening()
  }

  // onTurn(text) => Promise<replyText|null> — the caller sends the
  // transcribed text to Curry and returns what to speak back.
  const start = useCallback((onTurn) => {
    onTurnRef.current = onTurn
    stoppedRef.current = false
    startListening()
  }, [startListening])

  const stop = useCallback(() => {
    stoppedRef.current = true
    cleanupRecording()
    setStatus('idle')
  }, [cleanupRecording])

  const stopTtsPlayback = useCallback(() => {
    try { ttsSourceRef.current?.stop() } catch (e) { /* already stopped */ }
    ttsSourceRef.current = null
    if (ttsAudioCtxRef.current) {
      ttsAudioCtxRef.current.close().catch(() => {})
      ttsAudioCtxRef.current = null
    }
  }, [])

  // Speaks via ElevenLabs (curry-tts) — same voice as the main
  // assistant everywhere else in Mattchat. Falls back to the browser's
  // built-in voice ONLY if that call fails, so voice mode never just
  // goes silent from a network hiccup or quota limit.
  async function speak(text) {
    if (!text) return
    stopTtsPlayback()
    setStatus('speaking')

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
        source.onended = resolve
        source.start(0)
      })
    } catch (err) {
      console.error('Curry voice: ElevenLabs TTS failed, falling back to browser voice:', err)
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        await new Promise((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.rate = 1
          utterance.onend = resolve
          utterance.onerror = resolve
          window.speechSynthesis.speak(utterance)
        })
      }
    }
  }

  // Interrupts whatever's currently speaking — barge-in. Does NOT stop
  // the overall listen/speak loop, just the current utterance.
  const cancelSpeech = useCallback(() => {
    stopTtsPlayback()
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [stopTtsPlayback])

  // Release the mic and stop any speech if the component unmounts
  // mid-conversation (e.g. the student closes Curry while it's talking).
  useEffect(() => {
    return () => {
      stop()
      cancelSpeech()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup
  }, [])

  return {
    supported,
    listening: status === 'listening',
    thinking: status === 'thinking',
    speaking: status === 'speaking',
    volume,
    transcript,
    error,
    start,
    stop,
    cancelSpeech,
  }
}
