import { useEffect, useRef, useState, useCallback } from 'react'

// Continuous browser SpeechRecognition doesn't actually stay open
// forever — it auto-ends after a period of silence / time limit, and
// restarting it re-requests the microphone every time. That's what
// was causing the mic indicator to flicker on/off repeatedly,
// especially on mobile where these sessions end much more
// aggressively than on desktop.
//
// Fix: this hook no longer starts listening on its own. It exposes
// `listening` + `start`/`stop` so the UI can turn it on explicitly
// (e.g. a toggle in settings or a mic icon the user taps), and it
// only restarts on its own WHILE the user has explicitly left it on
// — stop() fully kills it, so the mic goes fully quiet the moment
// they turn it off instead of quietly resurrecting itself a second
// later.
export function useHeyCurry(onActivated, { autoStart = false } = {}) {
  const [active, setActive] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const restartTimer = useRef(null)
  const wantsListeningRef = useRef(autoStart)

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    wantsListeningRef.current = true

    function run() {
      if (!wantsListeningRef.current) return
      try {
        const recognition = new SR()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'
        recognition.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const transcript = e.results[i][0].transcript.toLowerCase().trim()
            if (
              transcript.includes('hey curry') ||
              transcript.includes('hey kerry') ||
              transcript.includes('hey cory')
            ) {
              const afterWake = transcript
                .replace(/hey curry|hey kerry|hey cory/gi, '')
                .trim()
              setActive(true)
              onActivated(afterWake)
              recognition.stop()
            }
          }
        }
        recognition.onend = () => {
          setListening(false)
          // Only auto-restart while the user still wants it on —
          // this is the difference that stops the "silently comes
          // back on" behavior once someone turns it off.
          if (wantsListeningRef.current) {
            restartTimer.current = setTimeout(run, 1000)
          }
        }
        recognition.onerror = (e) => {
          if (e.error !== 'no-speech' && wantsListeningRef.current) {
            restartTimer.current = setTimeout(run, 3000)
          }
        }
        recognition.start()
        setListening(true)
        recognitionRef.current = recognition
      } catch (e) {
        // Fail silently if browser doesn't support it
      }
    }
    run()
  }, [onActivated])

  const stopListening = useCallback(() => {
    wantsListeningRef.current = false
    clearTimeout(restartTimer.current)
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }, [])

  useEffect(() => {
    if (autoStart) startListening()
    return () => {
      wantsListeningRef.current = false
      clearTimeout(restartTimer.current)
      recognitionRef.current?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { active, setActive, listening, startListening, stopListening }
}
