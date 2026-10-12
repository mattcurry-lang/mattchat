import { useEffect, useRef, useState } from 'react'
import ShushhhExperience from './ShushhhExperience'

const WINDOW_MS = 1200
const HOLD_MS = 900      // how long to hold two fingers
const MOVE_LIMIT = 18    // px of finger drift allowed while holding

export default function ShushhhShortcut({ me }) {
  const [open, setOpen] = useState(false)
  const enterHits = useRef([])
  const tapHits = useRef([])

  useEffect(() => {
    const hit = (ref) => {
      const now = Date.now()
      ref.current = [...ref.current.filter((t) => now - t < WINDOW_MS), now]
      if (ref.current.length >= 3) { ref.current = []; return true }
      return false
    }

    // Desktop: Enter x3 (ignored only when you're typing real text)
    const onKeyDown = (e) => {
      if (e.key !== 'Enter' || e.repeat) return
      const el = e.target
      const isText = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable
      const hasText = isText && String(el.value ?? el.textContent ?? '').trim().length > 0
      if (hasText) { enterHits.current = []; return }
      if (hit(enterHits)) { e.preventDefault(); setOpen(true) }
    }

    // Mobile (optional): tap x3 on anything marked data-shushhh-trigger
    const onPointerUp = (e) => {
      if (!e.target?.closest?.('[data-shushhh-trigger]')) return
      if (hit(tapHits)) setOpen(true)
    }

    // Mobile: hold two fingers still for about a second, anywhere
    let timer = null
    let start = null
    const cancel = () => { clearTimeout(timer); timer = null; start = null }
    const spread = (touches) => touches.map((t) => [t.clientX, t.clientY])

    const onTouchStart = (e) => {
      if (e.touches.length !== 2) { cancel(); return }
      start = spread([...e.touches])
      clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        navigator.vibrate?.(30)
        setOpen(true)
      }, HOLD_MS)
    }
    const onTouchMove = (e) => {
      if (!timer || !start || e.touches.length !== 2) { if (timer) cancel(); return }
      const now = spread([...e.touches])
      const moved = now.some(([x, y], i) => Math.hypot(x - start[i][0], y - start[i][1]) > MOVE_LIMIT)
      if (moved) cancel()
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', cancel, { passive: true })
    window.addEventListener('touchcancel', cancel, { passive: true })
    return () => {
      cancel()
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', cancel)
      window.removeEventListener('touchcancel', cancel)
    }
  }, [])

  return open && me ? <ShushhhExperience me={me} onClose={() => setOpen(false)} /> : null
}
