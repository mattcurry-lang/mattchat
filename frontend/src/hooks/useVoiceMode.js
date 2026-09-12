// src/hooks/useVoiceMode.js
//
// Voice I/O for Curry, built entirely on the browser's native Web Speech
// APIs — no external STT/TTS service, no new API key, no per-request
// cost. Trade-off: browser support varies (best in Chrome/Edge; Safari
// is partial; Firefox has no SpeechRecognition) — every consumer must
// check the `*Supported` flags and degrade gracefully rather than assume
// voice is available.

import { useCallback, useEffect, useRef, useState } from 'react'

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function useVoiceMode() {
  const SpeechRecognitionCtor = getSpeechRecognition()
  const speechRecognitionSupported = !!SpeechRecognitionCtor
  const speechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const [listening, setListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [pulseTick, setPulseTick] = useState(0) // increments on each TTS word boundary — drives the orb's speaking animation since we don't have real amplitude
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const onFinalRef = useRef(null)

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  // onFinalTranscript: (text) => void — called once when the student
  // finishes speaking. Caller decides what to do with it (usually: send
  // it as a message).
  const startListening = useCallback((onFinalTranscript) => {
    if (!speechRecognitionSupported) {
      setError('Voice input isn\'t supported in this browser. Try Chrome or Edge.')
      return
    }
    setError(null)
    onFinalRef.current = onFinalTranscript

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) final += transcript
        else interim += transcript
      }
      setInterimTranscript(interim)
      if (final.trim()) onFinalRef.current?.(final.trim())
    }
    recognition.onerror = (event) => {
      // 'no-speech' and 'aborted' happen on ordinary silence/cancel — not real errors.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError('Voice input had trouble hearing you — please try again.')
      }
    }
    recognition.onend = () => {
      setListening(false)
      setInterimTranscript('')
    }

    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }, [speechRecognitionSupported, SpeechRecognitionCtor])

  const stopSpeaking = useCallback(() => {
    if (speechSynthesisSupported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [speechSynthesisSupported])

  // onEnd: () => void — called when Curry finishes talking, so callers
  // can e.g. automatically start listening again for a hands-free loop.
  const speak = useCallback((text, onEnd) => {
    if (!speechSynthesisSupported || !text) { onEnd?.(); return }
    window.speechSynthesis.cancel() // never let two utterances overlap
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onstart = () => setSpeaking(true)
    utterance.onboundary = () => setPulseTick((t) => t + 1)
    utterance.onend = () => { setSpeaking(false); onEnd?.() }
    utterance.onerror = () => { setSpeaking(false); onEnd?.() }
    window.speechSynthesis.speak(utterance)
  }, [speechSynthesisSupported])

  // Clean up on unmount — never leave a mic or an utterance running
  // after the component that owns it is gone.
  useEffect(() => () => {
    recognitionRef.current?.stop()
    if (speechSynthesisSupported) window.speechSynthesis.cancel()
  }, [speechSynthesisSupported])

  return {
    speechRecognitionSupported,
    speechSynthesisSupported,
    listening,
    interimTranscript,
    speaking,
    pulseTick,
    error,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  }
}
