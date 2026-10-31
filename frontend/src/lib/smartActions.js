// src/lib/smartActions.js
// Pure text helpers behind the message menu:
//   detectSmartActions(text)  -> context-aware actions (open a link, call a number, email, copy a code)
//   suggestReminderTime(text) -> "tomorrow at 9", "in 2 hours", "friday 5pm" -> a Date, or null
//   reminderPresets(now)      -> the quick "Remind me" choices
//   formatWhen(date, now)     -> "Today, 5:00 PM" / "Tomorrow, 9:00 AM" / "Mon 3 Nov, 9:00 AM"
// No network, no dependencies: everything runs on the device.

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"')\]]*[^\s<>"')\].,;:!?])/i
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const PHONE_RE = /(?:\+|00)?\d[\d\s().-]{7,17}\d/g
const CODE_RES = [
  /\b(?:code|otp|pin|passcode|password|verification|confirmation)\b[^\d\n]{0,25}(\d{4,8})\b/i,
  /\b(\d{4,8})\b[^\d\n]{0,12}\b(?:is|as) your\b/i,
]

const stripUrlsAndEmails = (t) => t.replace(new RegExp(URL_RE.source, 'gi'), ' ').replace(new RegExp(EMAIL_RE.source, 'gi'), ' ')

function hostOf(href) {
  try { return new URL(href).hostname.replace(/^www\./i, '') } catch { return href }
}

/** @returns {Array<{id:string, kind:'open'|'copy', label:string, value?:string, href?:string}>} (max 5) */
export function detectSmartActions(text) {
  if (typeof text !== 'string' || !text.trim()) return []
  const out = []

  for (const re of CODE_RES) {
    const m = text.match(re)
    if (m) { out.push({ id: 'code', kind: 'copy', label: `Copy code ${m[1]}`, value: m[1] }); break }
  }

  const link = text.match(URL_RE)
  if (link) {
    const href = /^https?:\/\//i.test(link[1]) ? link[1] : `https://${link[1]}`
    out.push({ id: 'link-open', kind: 'open', label: `Open ${hostOf(href)}`, href })
    out.push({ id: 'link-copy', kind: 'copy', label: 'Copy link', value: href })
  }

  const email = text.match(EMAIL_RE)
  if (email) out.push({ id: 'email', kind: 'open', label: `Email ${email[0]}`, href: `mailto:${email[0]}` })

  const plain = stripUrlsAndEmails(text)
  const seenCodes = new Set(out.filter((a) => a.id === 'code').map((a) => a.value))
  for (const raw of plain.match(PHONE_RE) || []) {
    const digits = raw.replace(/\D/g, '')
    const intl = /^(\+|00)/.test(raw.trim())
    const local = /^0\d{9}$/.test(digits)                       // e.g. 0712345678
    if (digits.length < 9 || digits.length > 15) continue
    if (!intl && !local && digits.length < 11) continue         // bare 8-10 digit numbers are usually ids, not phones
    if (seenCodes.has(digits)) continue
    const dial = intl ? `+${digits.replace(/^00/, '')}` : digits
    out.push({ id: 'phone', kind: 'open', label: `Call ${raw.trim()}`, href: `tel:${dial}` })
    if (intl) out.push({ id: 'whatsapp', kind: 'open', label: 'WhatsApp this number', href: `https://wa.me/${digits.replace(/^00/, '')}` })
    break
  }

  return out.slice(0, 5)
}

// ── reminders ────────────────────────────────────────────
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const atTime = (base, h, m = 0) => { const d = new Date(base); d.setHours(h, m, 0, 0); return d }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export function formatClock(d) {
  const h = d.getHours(); const m = d.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export function formatWhen(date, now = new Date()) {
  const d = new Date(date)
  if (sameDay(d, now)) return `Today, ${formatClock(d)}`
  if (sameDay(d, addDays(now, 1))) return `Tomorrow, ${formatClock(d)}`
  const days = (d - now) / 86400000
  if (days > 0 && days < 7) return `${DAY_SHORT[d.getDay()]}, ${formatClock(d)}`
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}, ${formatClock(d)}`
}

function parseClock(text) {
  // "5pm", "5:30 pm", "at 17:30", "at 5"
  let m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)
  if (m) {
    let h = parseInt(m[1], 10) % 12; if (/pm/i.test(m[3])) h += 12
    const min = m[2] ? parseInt(m[2], 10) : 0
    if (min < 60) return { h, m: min }
  }
  m = text.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i)
  if (m) return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) }
  m = text.match(/\bat\s+(\d{1,2})\b(?!\s*(?:min|hour|hr|day))/i)
  if (m) { const h = parseInt(m[1], 10); if (h >= 1 && h <= 12) return { h: h < 7 ? h + 12 : h, m: 0 } } // "at 5" means 5pm, "at 9" means 9am
  return null
}

/** Finds a time in a message: returns { at: Date, label } or null. `now` is injectable for tests. */
export function suggestReminderTime(text, now = new Date()) {
  if (typeof text !== 'string') return null
  const t = text.toLowerCase()
  const fin = (at) => (at && at.getTime() >= now.getTime() + 60000 ? { at, label: formatWhen(at, now) } : null)

  const rel = t.match(/\bin\s+(\d{1,3})\s*(min(?:ute)?s?|hours?|hrs?|days?)\b/)
  if (rel) {
    const n = parseInt(rel[1], 10); const u = rel[2]
    const ms = /^min/.test(u) ? n * 60000 : /^(hour|hr)/.test(u) ? n * 3600000 : n * 86400000
    return fin(new Date(now.getTime() + ms))
  }

  const clock = parseClock(t)
  const nextWord = /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.exec(t)
  const dayWord = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.exec(t)

  if (/\btomorrow\b/.test(t)) { const c = clock || { h: 9, m: 0 }; return fin(atTime(addDays(now, 1), c.h, c.m)) }
  if (/\btonight\b/.test(t)) { const c = clock && clock.h >= 12 ? clock : { h: 20, m: 0 }; return fin(atTime(now, c.h, c.m)) }
  if (/\btoday\b/.test(t)) { return clock ? fin(atTime(now, clock.h, clock.m)) : null }

  const wd = nextWord || dayWord
  if (wd) {
    const target = DAYS.indexOf(wd[1])
    let diff = (target - now.getDay() + 7) % 7
    const c = clock || { h: 9, m: 0 }
    let at = atTime(addDays(now, diff), c.h, c.m)
    if (nextWord && diff === 0) at = addDays(at, 7)
    if (!nextWord && at.getTime() < now.getTime() + 60000) at = addDays(at, 7)
    return fin(at)
  }

  if (clock) {
    let at = atTime(now, clock.h, clock.m)
    if (at.getTime() < now.getTime() + 60000) at = addDays(at, 1)
    return fin(at)
  }
  return null
}

export function reminderPresets(now = new Date()) {
  const inMs = (ms) => new Date(now.getTime() + ms)
  const tomorrow9 = atTime(addDays(now, 1), 9, 0)
  const list = [
    { id: 'in30', label: 'In 30 minutes', at: inMs(30 * 60000) },
    { id: 'in1h', label: 'In 1 hour', at: inMs(3600000) },
    { id: 'in3h', label: 'In 3 hours', at: inMs(3 * 3600000) },
    { id: 'tomorrow', label: 'Tomorrow morning', at: tomorrow9 },
  ]
  let monday = atTime(addDays(now, ((1 - now.getDay() + 7) % 7) || 7), 9, 0)
  if (sameDay(monday, tomorrow9)) monday = addDays(monday, 7)   // don't offer "Monday" when it IS tomorrow
  list.push({ id: 'monday', label: 'Next Monday', at: monday })
  return list.map((p) => ({ ...p, hint: formatWhen(p.at, now) }))
}
