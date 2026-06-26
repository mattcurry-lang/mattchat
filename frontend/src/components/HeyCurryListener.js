import { useEffect, useRef, useState } from 'react'

export function useHeyCurry(onActivated) {
  const [active, setActive] = useState(false)
  const recognitionRef = useRef(null)
  const restartTimer = useRef(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    function startListening() {
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
          restartTimer.current = setTimeout(startListening, 1000)
        }

        recognition.onerror = (e) => {
          if (e.error !== 'no-speech') {
            restartTimer.current = setTimeout(startListening, 3000)
          }
        }

        recognition.start()
        recognitionRef.current = recognition
      } catch (e) {
        // Fail silently if browser doesn't support
      }
    }

    startListening()

    return () => {
      clearTimeout(restartTimer.current)
      recognitionRef.current?.stop()
    }
  }, [onActivated])

  return { active, setActive }
}
