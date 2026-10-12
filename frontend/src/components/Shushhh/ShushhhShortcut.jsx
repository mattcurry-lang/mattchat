import { useEffect, useRef, useState } from 'react'
import ShushhhExperience from './ShushhhExperience'

const WINDOW_MS = 1200

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

    // Mobile: tap x3 on anything marked data-shushhh-trigger
    const onPointerUp = (e) => {
      if (!e.target?.closest?.('[data-shushhh-trigger]')) return
      if (hit(tapHits)) setOpen(true)
    }

    window.addEventListener('keydown', onKeyDown, true) // capture, so other handlers can't swallow it
    window.addEventListener('pointerup', onPointerUp, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('pointerup', onPointerUp, true)
    }
  }, [])

  return open && me ? <ShushhhExperience me={me} onClose={() => setOpen(false)} /> : null
}
