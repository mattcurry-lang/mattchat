// Decides whether an incoming message should make a sound or alert.
// Pure functions, no React, no DOM: the same rules are mirrored in the database
// (notification_plan() in step5_notifications.sql) for push notifications, and tested against each other.

const WEEKDAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

// Wall-clock time in a given IANA time zone: hour as a decimal (7.5 = 07:30) and ISO weekday (1 = Mon ... 7 = Sun).
export function localClock(date = new Date(), timeZone) {
  const make = (tz) => new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(date)
  let parts
  try { parts = make(timeZone || undefined) } catch { parts = make(undefined) } // unknown zone: use this device's
  const get = (type) => parts.find((p) => p.type === type)?.value
  return { hour: Number(get('hour')) + Number(get('minute')) / 60, isoDow: WEEKDAY[get('weekday')] }
}

// 'night'  = 10 pm to 7 am, every day
// 'class'  = 8 am to 5 pm, Monday to Friday
export function inQuietHours(rule, clock) {
  if (rule === 'night') return clock.hour >= 22 || clock.hour < 7
  if (rule === 'class') return clock.isoDow >= 1 && clock.isoDow <= 5 && clock.hour >= 8 && clock.hour < 17
  return false
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')

// "@name" at the start or after a space, and not the start of a longer name.
export function mentionsUser(text, username) {
  if (!text || !username) return false
  return new RegExp(`(^|\\s)@${escapeRegex(username)}(?![\\w])`, 'i').test(text)
}

/*
 * settings: { dnd, quietHours, mentionsOnly, previews, timezone }  (missing values mean the defaults)
 * Returns { alert, reason, preview }
 *   alert   false = stay quiet (no sound, no push)
 *   reason  'dnd' | 'quiet_hours' | 'mentions_only' | null
 *   preview whether notifications may show the message text
 * Calls are not covered: they keep ringing.
 */
export function notifyDecision({ settings = {}, now = new Date(), isGroup = false, text = '', myUsername = '' } = {}) {
  const preview = settings.previews !== false
  if (settings.dnd === true) return { alert: false, reason: 'dnd', preview }
  if (inQuietHours(settings.quietHours, localClock(now, settings.timezone))) return { alert: false, reason: 'quiet_hours', preview }
  if (isGroup && settings.mentionsOnly === true && !mentionsUser(text, myUsername)) return { alert: false, reason: 'mentions_only', preview }
  return { alert: true, reason: null, preview }
}
