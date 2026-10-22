// src/hooks/useVoiceDictation.js
// "Press the mic, say something, get text." Used by the command bar.
//
// Why record-then-transcribe instead of the browser's SpeechRecognition?
// The same reason useCurryVoice does it: SpeechRecognition streams audio to
// Google and fails permanently in Brave, Vivaldi and Opera (and Firefox has none).
// MediaRecorder + your `voice-transcribe` function works in every browser.
//
// Flow:  requesting (mic permission) -> listening (record + watch loudness)
//        -> processing (transcribe) -> idle, with the text handed to onResult.
//
// "Listening properly" is handled by lib/voiceVad.js: it measures the room's noise
// first, ignores clicks and coughs, waits through pauses between words, and gives up
// politely if nothing is said.
//
// Options:
//   onResult(text)          called once with the transcript
//   onActiveChange(bool)    true the moment we want the mic, false when done, so the
//                           caller can pause "Hey Curry" (two mics fighting = bugs)
//   vadOptions              override timings (see VAD_DEFAULTS)

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createVad } from '../lib/voiceVad'

// Same project as useCurryVoice.js
const SUPABASE_URL = 'https://bqerkvywgxoioocbkxif.supabase.co'
const TRANSCRIBE_URL = `${SUPABASE_URL}/functions/v1/voice-transcribe`

// Safari/iPhone can't record webm before iOS 18.4, so ask what this browser can do.
const FORMATS = [
  ['audio/webm;codecs=opus', 'webm'],
  ['audio/webm', 'webm'],
  ['audio/mp4;codecs=mp4a.40.2', 'm4a'],
  ['audio/mp4', 'm4a'],
  ['audio/ogg;codecs=opus', 'ogg'],
]

export function pickRecorderFormat(MR) {
  if (!MR) return null
  if (typeof MR.isTypeSupported === 'function') {
    for (const [mime, ext] of FORMATS) if (MR.isTypeSupported(mime)) return { mime, ext }
  }
  return { mime: '', ext: 'webm' }              // let the browser choose
}

const extFor = (mime, fallback) => (/mp4|m4a|aac/i.test(mime) ? 'm4a' : /ogg/i.test(mime) ? 'ogg' : /webm/i.test(mime) ? 'webm' : fallback)

const MESSAGES = {
  denied: 'Microphone access is blocked. Allow it in your browser’s site settings, then try again.',
  'no-mic': 'No microphone was found on this device.',
  'mic-error': 'Couldn’t start the microphone.',
  unsupported: 'Voice input isn’t supported in this browser.',
  'no-speech': 'I didn’t hear anything. Tap the mic and try again.',
  'no-text': 'I couldn’t make that out. Try again a little closer to the mic.',
  failed: 'Couldn’t turn that into text. Check your connection and try again.',
  signin: 'Please sign in again to use voice.',
}

export function useVoiceDictation({ onResult, onActiveChange, vadOptions } = {}) {
  const supported =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined'

  const [status, setStatus] = useState('idle')              // idle | requesting | listening | processing
  const [speechDetected, setSpeechDetected] = useState(false)
  const [error, setError] = useState(null)                  // { code, message }
  const [transcript, setTranscript] = useState('')

  const streamRef = useRef(null)
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const rafRef = useRef(null)
  const vadRef = useRef(null)
  const freqRef = useRef(null)
  const volumeRef = useRef(0)
  const heardRef = useRef(false)
  const cancelledRef = useRef(false)
  const busyRef = useRef(false)                              // a session is in progress
  const activeRef = useRef(false)
  const abortRef = useRef(null)
  const formatRef = useRef(null)
  const onResultRef = useRef(onResult)
  const onActiveRef = useRef(onActiveChange)
  const vadOptRef = useRef(vadOptions)
  onResultRef.current = onResult
  onActiveRef.current = onActiveChange
  vadOptRef.current = vadOptions

  const emitActive = useCallback((value) => {
    if (activeRef.current === value) return
    activeRef.current = value
    onActiveRef.current?.(value)
  }, [])

  const fail = useCallback((code) => {
    setError({ code, message: MESSAGES[code] || MESSAGES.failed })
    setStatus('idle')
    setSpeechDetected(false)
    busyRef.current = false
    emitActive(false)
  }, [emitActive])

  // Stop the loop and release the microphone completely (the browser's red dot goes away).
  const releaseAudio = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => { try { t.stop() } catch (e) { /* already stopped */ } })
    streamRef.current = null
    try { ctxRef.current?.close() } catch (e) { /* already closed */ }
    ctxRef.current = null
    analyserRef.current = null
    volumeRef.current = 0
  }, [])

  // Resolve once the recorder has flushed its last chunk.
  const stopRecorder = useCallback(() => new Promise((resolve) => {
    const rec = recorderRef.current
    recorderRef.current = null
    if (!rec || rec.state === 'inactive') return resolve()
    const timer = setTimeout(resolve, 800)
    rec.onstop = () => { clearTimeout(timer); resolve() }
    try { rec.stop() } catch (e) { clearTimeout(timer); resolve() }
  }), [])

  const transcribe = useCallback(async (blob, ext) => {
    setStatus('processing')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return fail('signin')
      const form = new FormData()
      form.append('audio', blob, `recording.${ext}`)
      const res = await fetch(TRANSCRIBE_URL, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: form, signal: controller.signal,
      })
      const data = await res.json()
      if (cancelledRef.current) return
      if (!data.ok) throw new Error(data.error || 'Transcription failed')
      const text = (data.text || '').trim()
      if (!text) return fail('no-text')
      setTranscript(text)
      setStatus('idle')
      busyRef.current = false
      emitActive(false)
      onResultRef.current?.(text)
    } catch (e) {
      if (cancelledRef.current || e?.name === 'AbortError') return
      console.error('voice dictation: transcription failed:', e)
      fail('failed')
    }
  }, [emitActive, fail])

  // Called when you stop talking (or tap Done): hand what we recorded to the transcriber.
  const finish = useCallback(async () => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    const heard = heardRef.current
    await stopRecorder()
    releaseAudio()
    if (cancelledRef.current) return
    if (!heard || chunksRef.current.length === 0) return fail('no-speech')
    const mime = formatRef.current?.mime || chunksRef.current[0]?.type || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: mime })
    await transcribe(blob, extFor(mime, formatRef.current?.ext || 'webm'))
  }, [fail, releaseAudio, stopRecorder, transcribe])

  const loop = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser || cancelledRef.current) return
    const freq = freqRef.current
    analyser.getByteFrequencyData(freq)

    // Loudness of the speech band only (roughly 200 Hz - 5 kHz); hiss above it is ignored.
    let sum = 0
    const hi = Math.min(freq.length, 48)
    for (let i = 1; i < hi; i++) sum += freq[i]
    const level = sum / (hi - 1)

    const target = Math.min(1, level / 90)
    volumeRef.current += (target - volumeRef.current) * (target > volumeRef.current ? 0.5 : 0.18)

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const { event } = vadRef.current.push(level, now)
    if (event === 'speech-start') { heardRef.current = true; setSpeechDetected(true) }
    else if (event === 'misfire') { heardRef.current = false; setSpeechDetected(false) }
    else if (event === 'speech-end' || event === 'max-length') { setSpeechDetected(false); finish(); return }
    else if (event === 'no-speech') { heardRef.current = false; finish(); return }

    rafRef.current = requestAnimationFrame(loop)
  }, [finish])

  const start = useCallback(async () => {
    if (busyRef.current) return
    if (!supported) { setError({ code: 'unsupported', message: MESSAGES.unsupported }); return }
    busyRef.current = true
    cancelledRef.current = false
    heardRef.current = false
    chunksRef.current = []
    setError(null)
    setTranscript('')
    setSpeechDetected(false)
    setStatus('requesting')
    emitActive(true)                                       // pause other mic users BEFORE we ask for it

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (e) {
      const name = e?.name
      return fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
        : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'no-mic' : 'mic-error')
    }
    if (cancelledRef.current) { stream.getTracks().forEach((t) => t.stop()); return }
    streamRef.current = stream

    try {
      const AC = window.AudioContext || window.webkitAudioContext
      const ctx = new AC()
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.6
      ctx.createMediaStreamSource(stream).connect(analyser)
      ctxRef.current = ctx
      analyserRef.current = analyser
      freqRef.current = new Uint8Array(analyser.frequencyBinCount)

      formatRef.current = pickRecorderFormat(window.MediaRecorder)
      const rec = new window.MediaRecorder(stream, formatRef.current.mime ? { mimeType: formatRef.current.mime } : undefined)
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      rec.start(250)
      recorderRef.current = rec
    } catch (e) {
      console.error('voice dictation: recorder setup failed:', e)
      releaseAudio()
      return fail('mic-error')
    }

    vadRef.current = createVad(vadOptRef.current)
    setStatus('listening')
    try { navigator.vibrate?.(10) } catch (e) { /* not supported */ }
    rafRef.current = requestAnimationFrame(loop)
  }, [emitActive, fail, loop, releaseAudio, supported])

  // Tap "Done": use what was said so far (if anything).
  const stop = useCallback(() => {
    if (status === 'listening') finish()
  }, [finish, status])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    abortRef.current?.abort()
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    const rec = recorderRef.current
    recorderRef.current = null
    if (rec && rec.state !== 'inactive') { rec.onstop = null; try { rec.stop() } catch (e) { /* ignore */ } }
    releaseAudio()
    chunksRef.current = []
    busyRef.current = false
    setStatus('idle')
    setSpeechDetected(false)
    emitActive(false)
  }, [emitActive, releaseAudio])

  // Never leave the mic open if the screen goes away.
  useEffect(() => () => { if (busyRef.current || activeRef.current) cancel() }, [cancel])

  return {
    supported,
    status,
    requesting: status === 'requesting',
    listening: status === 'listening',
    processing: status === 'processing',
    busy: status !== 'idle',
    speechDetected,
    error,
    transcript,
    start,
    stop,
    cancel,
    clearError: useCallback(() => setError(null), []),
    getLevels: useCallback(() => freqRef.current, []),     // raw frequency bars for the visualizer (no re-render per frame)
    getVolume: useCallback(() => volumeRef.current, []),   // smoothed 0..1
  }
}
