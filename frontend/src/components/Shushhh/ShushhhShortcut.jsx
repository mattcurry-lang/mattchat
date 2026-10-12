import { useEffect, useRef } from 'react'

export const SHUSHHH_OPEN_EVENT = 'shushhh:open'
const WINDOW_MS = 700 // all three hits must land within this time

export default function ShushhhShortcut() {
  const enterHits = useRef([])
  const tapHits = useRef([])

  useEffect(() => {
    const hit = (ref) => {
      const now = Date.now()
      ref.current = [...ref.current.filter((t) => now - t < WINDOW_MS), now]
      if (ref.current.length >= 3) { ref.current = []; return true }
      return false
    }
    const open = () => window.dispatchEvent(new CustomEvent(SHUSHHH_OPEN_EVENT))

    // Desktop: Enter x3, but never while typing or on a focused button/link
    const onKeyDown = (e) => {
      if (e.key !== 'Enter' || e.repeat) return
      const tag = e.target?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag) || e.target?.isContentEditable) return
      if (hit(enterHits)) open()
    }

    // Mobile: tap x3 on any element marked data-shushhh-trigger
    const onPointerUp = (e) => {
      if (!e.target?.closest?.('[data-shushhh-trigger]')) return
      if (hit(tapHits)) open()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  return null
}
