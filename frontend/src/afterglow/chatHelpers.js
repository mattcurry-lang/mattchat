// afterglow/chatHelpers.js — small pure helpers for the chat screen.

const FIVE_MIN = 5 * 60 * 1000

function isSystemish(m) {
  if (!m) return true
  if (m.message_type === 'curry' || m.deleted_for_everyone) return true
  const c = m.content
  return typeof c === 'string' && (c.startsWith('missed_call:') || c.startsWith('call_log:'))
}

function joins(a, b) {
  if (!a || !b || isSystemish(a) || isSystemish(b)) return false
  if (a.sender_id !== b.sender_id) return false
  const ta = new Date(a.created_at)
  const tb = new Date(b.created_at)
  if (ta.toDateString() !== tb.toDateString()) return false
  return Math.abs(tb - ta) < FIVE_MIN
}

/**
 * Where a message sits in a run from the same person.
 *   ag-solo  – on its own        ag-first – top of a run
 *   ag-mid   – middle of a run   ag-last  – bottom of a run
 * CSS uses this to tighten the corners between stacked pebbles and to show
 * the time and sender name once per run instead of once per message.
 */
export function groupPosition(prev, msg, next) {
  const withPrev = joins(prev, msg)
  const withNext = joins(msg, next)
  if (withPrev) return withNext ? 'ag-mid' : 'ag-last'
  return withNext ? 'ag-first' : 'ag-solo'
}

/** Scroll a message into view and give it a brief glow. Safe to call with undefined. */
export function flashMessage(el) {
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.remove('ag-jump-flash')
  void el.offsetWidth // restart the animation if it's already running
  el.classList.add('ag-jump-flash')
  setTimeout(() => el.classList.remove('ag-jump-flash'), 1700)
}
