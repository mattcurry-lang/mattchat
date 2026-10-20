import { useRef } from 'react'

const time = (m) => new Date(m.created_at).getTime() || 0

/**
 * Which messages just arrived, so only those get the entrance animation.
 *
 * Not animated: the history that loads when you open a chat, older pages that
 * load when you scroll up, and an optimistic message being swapped for its
 * saved copy (same sender and text, new id) — each of those would otherwise
 * pop in all at once or play twice.
 *
 * It's computed during render (no effect, no extra state) on purpose: an effect
 * would add the class one frame AFTER the message appears and cause a flicker.
 * Mutating the ref is idempotent, so React's double-render in dev is harmless.
 */
export function useArrivals(messages, convoKey, loading) {
  const r = useRef(null)
  if (!r.current || r.current.key !== convoKey) {
    r.current = { key: convoKey, ready: false, info: new Map(), newest: 0, arrived: new Set(), lastList: null }
  }
  const s = r.current
  if (loading || !messages || s.lastList === messages) return s.arrived
  s.lastList = messages

  const signature = (m) => `${m.sender_id}\u0000${m.content}`

  if (!s.ready) { // baseline: everything already here is history
    for (const m of messages) { s.info.set(m.id, signature(m)); s.newest = Math.max(s.newest, time(m)) }
    s.ready = true
    return s.arrived
  }

  const present = new Set(messages.map((m) => m.id))
  const gone = new Set()
  for (const [id, sig] of s.info) if (!present.has(id)) { gone.add(sig); s.info.delete(id) }

  for (const m of messages) {
    if (s.info.has(m.id)) continue
    const sig = signature(m)
    s.info.set(m.id, sig)
    const t = time(m)
    const replacesOptimistic = gone.has(sig)
    const isOlderPage = t < s.newest - 1000
    if (!replacesOptimistic && !isOlderPage) s.arrived.add(m.id)
    s.newest = Math.max(s.newest, t)
  }
  if (s.arrived.size > 300) s.arrived = new Set([...s.arrived].slice(-100))
  return s.arrived
}
