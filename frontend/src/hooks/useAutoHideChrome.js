import { useState, useRef, useCallback, useEffect } from 'react'

const HIDE_DELAY_MS = 3200

export function useAutoHideChrome() {
  const [visible, setVisible] = useState(true)
  const timerRef = useRef(null)

  const show = useCallback(() => {
    setVisible(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), HIDE_DELAY_MS)
  }, [])

  useEffect(() => {
    show()
    return () => clearTimeout(timerRef.current)
  }, [show])

  return { chromeVisible: visible, wake: show }
}
