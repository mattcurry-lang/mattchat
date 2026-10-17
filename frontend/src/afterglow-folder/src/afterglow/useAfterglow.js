import { useState, useCallback, useRef, useSyncExternalStore } from 'react'

// Kill-switch: run localStorage.setItem('mattchat:afterglow', 'off') and reload
// to get the previous chat list back instantly.
export function isAfterglowEnabled() {
  try { return localStorage.getItem('mattchat:afterglow') !== 'off' } catch { return true }
}

const CLOSE_KEY = 'mattchat:close'
function loadClose() {
  try { return new Set(JSON.parse(localStorage.getItem(CLOSE_KEY) || '[]')) } catch { return new Set() }
}

// "Close" circle — people you keep near. Stored per-browser for now
// (same approach as the existing conversation tags); can move to Supabase later.
export function useCloseCircle() {
  const [closeIds, setCloseIds] = useState(loadClose)
  const toggleClose = useCallback((id) => {
    setCloseIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      try { localStorage.setItem(CLOSE_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }, [])
  return { closeIds, toggleClose }
}

// Horizontal swipe on the list moves between lenses.
const ORDER = ['now', 'close', 'all']
export function useLensSwipe(lens, onChange) {
  const start = useRef(null)
  return {
    onTouchStart: (e) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY } },
    onTouchEnd: (e) => {
      if (!start.current) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.current.x
      const dy = t.clientY - start.current.y
      start.current = null
      if (Math.abs(dx) < 70 || Math.abs(dy) > 40) return
      const i = ORDER.indexOf(lens)
      const next = dx < 0 ? ORDER[Math.min(ORDER.length - 1, i + 1)] : ORDER[Math.max(0, i - 1)]
      if (next !== lens) onChange(next)
    },
  }
}

// One shared minute-tick so rings cool down live without every row owning a timer.
let tick = 0
let timer = null
const subs = new Set()
function subscribe(cb) {
  subs.add(cb)
  if (!timer) timer = setInterval(() => { tick++; subs.forEach((f) => f()) }, 60000)
  return () => {
    subs.delete(cb)
    if (!subs.size && timer) { clearInterval(timer); timer = null }
  }
}
export function useMinuteTick() {
  return useSyncExternalStore(subscribe, () => tick, () => 0)
}
