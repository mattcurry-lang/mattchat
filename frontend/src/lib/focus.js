// Focus modes: Study, Sleep, Work. One can be on at a time. While it is on, message alerts from anyone
// who is not on that mode's "allowed people" list stay quiet. Allowed people also break through quiet hours.
// Pure functions, no React. The same rules run on the server in notification_plan() (step5_notifications.sql).
//
// Stored (in user_settings, key "focus"):
//   { active: 'study' | null, until: ISO string | null, modes: { study: { allowed: [userId, ...] }, ... } }

export const FOCUS_MODES = [
  { id: 'study', name: 'Study', emoji: '📚', colors: ['#2563eb', '#7c3aed'], blurb: 'Quiet for lectures and revision' },
  { id: 'sleep', name: 'Sleep', emoji: '🌙', colors: ['#4338ca', '#0ea5e9'], blurb: 'Quiet through the night' },
  { id: 'work',  name: 'Work',  emoji: '💼', colors: ['#0f766e', '#2563eb'], blurb: 'Quiet while you focus' },
]

export const DURATIONS = [
  { id: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { id: '2h', label: '2 hours', ms: 2 * 60 * 60 * 1000 },
  { id: '4h', label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { id: 'off', label: 'Until I turn it off', ms: null },
]

export const DEFAULT_FOCUS = { active: null, until: null, modes: {} }

const MODE_IDS = new Set(FOCUS_MODES.map((m) => m.id))
const MAX_ALLOWED = 200

export const modeById = (id) => FOCUS_MODES.find((m) => m.id === id) || null

// Make any stored value safe to use.
export function normalizeFocus(raw) {
  const f = raw && typeof raw === 'object' ? raw : {}
  const active = MODE_IDS.has(f.active) ? f.active : null
  const untilMs = typeof f.until === 'string' ? Date.parse(f.until) : NaN
  const modes = {}
  for (const id of MODE_IDS) {
    const list = Array.isArray(f.modes?.[id]?.allowed) ? f.modes[id].allowed : []
    modes[id] = { allowed: [...new Set(list.filter((x) => typeof x === 'string' && x))].slice(0, MAX_ALLOWED) }
  }
  return { active, until: Number.isFinite(untilMs) ? new Date(untilMs).toISOString() : null, modes }
}

// The id of the mode that is on right now, or null. A mode whose time has run out is off.
export function activeMode(focus, now = Date.now()) {
  const f = normalizeFocus(focus)
  if (!f.active) return null
  if (f.until && Date.parse(f.until) <= now) return null
  return f.active
}

export const allowedOf = (focus, id) => normalizeFocus(focus).modes[id]?.allowed || []

// Should a message from senderId stay quiet because of Focus? (Nothing is quiet when no mode is on.)
export function isSilenced(focus, senderId, now = Date.now()) {
  const id = activeMode(focus, now)
  if (!id) return false
  return !senderId || !allowedOf(focus, id).includes(senderId)
}

// Is this sender explicitly allowed through the mode that is on?
export function isAllowedThrough(focus, senderId, now = Date.now()) {
  const id = activeMode(focus, now)
  return !!id && !!senderId && allowedOf(focus, id).includes(senderId)
}

export function activate(focus, id, durationMs = null, now = Date.now()) {
  if (!MODE_IDS.has(id)) return normalizeFocus(focus)
  return { ...normalizeFocus(focus), active: id, until: durationMs ? new Date(now + durationMs).toISOString() : null }
}

export const deactivate = (focus) => ({ ...normalizeFocus(focus), active: null, until: null })

export function setAllowed(focus, id, ids) {
  const f = normalizeFocus(focus)
  if (!MODE_IDS.has(id)) return f
  return { ...f, modes: { ...f.modes, [id]: { allowed: [...new Set(ids)].slice(0, MAX_ALLOWED) } } }
}

export function toggleAllowed(focus, id, userId) {
  const list = allowedOf(focus, id)
  return setAllowed(focus, id, list.includes(userId) ? list.filter((x) => x !== userId) : [...list, userId])
}

// "until 4:30 PM" / "until tomorrow 6:00 AM" / "until you turn it off"
export function formatUntil(untilIso, now = Date.now(), timeZone) {
  if (!untilIso) return 'until you turn it off'
  const end = new Date(untilIso)
  const opts = { hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : null) }
  const time = new Intl.DateTimeFormat('en-US', opts).format(end)
  const day = (d) => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', ...(timeZone ? { timeZone } : null) }).format(d)
  if (day(end) === day(new Date(now))) return `until ${time}`
  if (day(end) === day(new Date(now + 24 * 3600 * 1000))) return `until tomorrow ${time}`
  return `until ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...(timeZone ? { timeZone } : null) }).format(end)} ${time}`
}

// What to say about the current state.
export function describeFocus(focus, now = Date.now(), timeZone) {
  const id = activeMode(focus, now)
  if (!id) return { on: false, modeId: null, title: 'Off', detail: '' }
  const f = normalizeFocus(focus)
  return { on: true, modeId: id, title: `${modeById(id).name} is on`, detail: formatUntil(f.until, now, timeZone) }
}

export function allowedSummary(focus, id) {
  const n = allowedOf(focus, id).length
  return n === 0 ? 'Quiet for everyone' : n === 1 ? 'Only 1 person can reach you' : `Only ${n} people can reach you`
}
