import { useEffect, useRef, useState, useCallback } from 'react'

// "Hey Curry" wake word using the browser's SpeechRecognition.
//
// Notes on how it behaves:
// - It never starts on its own unless autoStart is true; the UI turns it on.
// - Browsers end continuous recognition on their own after a while, so while
//   the user has it ON we restart it — but only ever ONE recognizer at a time.
// - Fatal problems (mic blocked, no mic) stop it and are reported through
//   `error`, instead of retrying forever.
// - We only react to FINAL results, so the text after the wake word is the
//   complete phrase, and one phrase can only trigger once.
// - onActivated receives whatever was said after "hey curry" ('' if nothing).

const WAKE = /\bhey[,.]?\s+(curry|currie|kerry|cory|carry|kari|cari|curri|curie)\b/i
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'])

export function useHeyCurry(onActivated, { autoStart = false } = {}) {
  const [active, setActive] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)
  const restartTimer = useRef(null)
  const wantsListeningRef = useRef(autoStart)
  const lastErrorRef = useRef(null)
  const onActivatedRef = useRef(onActivated)
  onActivatedRef.current = onActivated // always call the latest handler

  const supported =
    typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setError('unsupported'); return }

    wantsListeningRef.current = true
    lastErrorRef.current = null
    setError(null)
    clearTimeout(restartTimer.current)
    try { recognitionRef.current?.abort() } catch { /* nothing running */ }

    function schedule(ms) {
      clearTimeout(restartTimer.current)
      restartTimer.current = setTimeout(run, ms)
    }

    function run() {
      if (!wantsListeningRef.current) return

      let recognition
      try {
        recognition = new SR()
      } catch (e) {
        wantsListeningRef.current = false
        setListening(false)
        setError('start-failed')
        return
      }

      let handled = false
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => { lastErrorRef.current = null; setError(null) }

      recognition.onresult = (e) => {
        if (handled) return
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i]
          if (!result.isFinal) continue
          const transcript = result[0].transcript.trim()
          const m = transcript.match(WAKE)
          if (!m) continue
          handled = true
          const afterWake = transcript
            .slice(m.index + m[0].length)
            .replace(/^[\s,.:;!?-]+/, '')
            .trim()
          setActive(true)
          try { onActivatedRef.current?.(afterWake) } catch (err) { console.error('Hey Curry handler failed:', err) }
          try { recognition.stop() } catch { /* already stopping */ }
          break
        }
      }

      recognition.onerror = (e) => {
        lastErrorRef.current = e.error
        if (FATAL.has(e.error)) {
          // Retrying can't fix these — stop and tell the UI.
          wantsListeningRef.current = false
          clearTimeout(restartTimer.current)
          setError(e.error)
        } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
          setError(e.error) // transient, e.g. 'network'
        }
        // Restarting is handled in onend (it always fires after an error).
      }

      recognition.onend = () => {
        // Ignore the end of a recognizer we replaced or stopped on purpose.
        if (recognitionRef.current !== recognition) return
        recognitionRef.current = null
        setListening(false)
        if (wantsListeningRef.current) {
          schedule(lastErrorRef.current === 'network' ? 3000 : 1000)
        }
      }

      try {
        recognition.start()
        recognitionRef.current = recognition
        setListening(true)
      } catch (e) {
        // e.g. InvalidStateError if the browser hasn't released the previous one yet
        if (wantsListeningRef.current) schedule(1000)
      }
    }

    run()
  }, [])

  const stopListening = useCallback(() => {
    wantsListeningRef.current = false
    clearTimeout(restartTimer.current)
    const r = recognitionRef.current
    recognitionRef.current = null // so its onend is ignored
    try { r?.stop() } catch { /* nothing running */ }
    setListening(false)
    setError(null)
  }, [])

  useEffect(() => {
    if (autoStart) startListening()
    return () => {
      wantsListeningRef.current = false
      clearTimeout(restartTimer.current)
      const r = recognitionRef.current
      recognitionRef.current = null
      try { r?.stop() } catch { /* nothing running */ }
    }
  }, [])

  return { active, setActive, listening, supported, error, startListening, stopListening }
}
