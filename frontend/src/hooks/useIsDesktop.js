import { useState, useEffect } from 'react'

// Matches Instagram's own breakpoint behavior fairly closely — below
// this, there's not enough horizontal room for a centered card with
// content beside/below it, so the mobile immersive overlay is used
// instead.
const DESKTOP_BREAKPOINT = 820

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= DESKTOP_BREAKPOINT : false
  )
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`)
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}
