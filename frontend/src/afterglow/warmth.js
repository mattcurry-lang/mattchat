// afterglow/warmth.js
//
// The core idea of Afterglow: a conversation has a TEMPERATURE.
// Warmth is a number from 0 (cold) to 1 (hot) computed from real signals —
// how recently you talked, whether there's something unread, whether the
// person is online right now, whether they're typing. It cools on its own
// as time passes. Everything visual (ring glow, row tint, time color) is
// derived from this one number, so the whole app feels like one system.

// Curated hues (degrees) that all look good on the dark UI. A conversation
// gets one of these deterministically, so a chat keeps the same color forever.
const HUES = [258, 282, 316, 8, 32, 150, 176, 204]

export function convoHue(key = '') {
  const s = String(key)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

const HALF_LIFE_HOURS = 30 // activity loses half its heat every ~30 hours

export function hoursSince(ts, now = Date.now()) {
  if (!ts) return Infinity
  const t = new Date(ts).getTime()
  return Number.isFinite(t) ? Math.max(0, (now - t) / 3.6e6) : Infinity
}

export function warmthOf({ lastActivityAt, unread = 0, online = false, typing = false, now = Date.now() }) {
  if (typing) return 1
  const age = hoursSince(lastActivityAt, now)
  let w = Number.isFinite(age) ? Math.max(0.06, Math.pow(0.5, age / HALF_LIFE_HOURS)) : 0.06
  if (unread > 0) w = Math.max(w, Math.min(1, 0.82 + Math.min(unread, 6) * 0.03))
  if (online) w = Math.min(1, w + 0.18)
  return Math.round(w * 100) / 100
}

export function heatLabel(w) {
  return w >= 0.8 ? 'hot' : w >= 0.5 ? 'warm' : w >= 0.2 ? 'cool' : 'cold'
}

// "Now" = something is alive in this chat: unread, typing, online, or talked in the last day.
export function isNowChat({ lastActivityAt, unread = 0, online = false, typing = false }, now = Date.now()) {
  return unread > 0 || typing || online || hoursSince(lastActivityAt, now) < 24
}

// ── notes (24h thoughts, from usePublicProfiles extras) ──
export function isNoteActive(extras, now = Date.now()) {
  if (!extras?.note) return false
  if (!extras.noteExpiresAt) return true
  return new Date(extras.noteExpiresAt).getTime() > now
}

// "Freshest line": show the note only if it was posted after the last message,
// so the line under the name is always whichever is newest.
export function freshNote(extras, lastActivityAt, now = Date.now()) {
  if (!isNoteActive(extras, now)) return null
  if (!extras.noteExpiresAt || !lastActivityAt) return extras.note
  const postedAt = new Date(extras.noteExpiresAt).getTime() - 24 * 3.6e6
  return postedAt > new Date(lastActivityAt).getTime() ? extras.note : null
}

// ── lens filtering ──
export function applyLens(list, lens, { unreadCounts = {}, closeIds = new Set(), listState = {}, now = Date.now() } = {}) {
  if (lens === 'close') return list.filter((c) => closeIds.has(c.id))
  if (lens === 'now') {
    return list.filter((c) => {
      const st = listState[c.id] || {}
      return isNowChat({
        lastActivityAt: c.updated_at,
        unread: unreadCounts[c.id] || st.unreadMessageCount || 0,
        online: !!st.onlineStatus,
        typing: !!st.isTyping,
      }, now)
    })
  }
  return list
}

/**
 * Conversations in the order you most likely want them: someone typing to you
 * first, then chats with unread messages, then everything else by warmth
 * (recency, online). Used by the desktop home: the first becomes the "resume"
 * card and the next few become the "also alive" strip. Ring glow still comes
 * straight from warmthOf, so only this ordering is tiered.
 */
export function rankByWarmth(list, { unreadCounts = {}, listState = {}, now = Date.now() } = {}) {
  const tier = (x) => (x.typing ? 2 : x.unread > 0 ? 1 : 0)
  return list
    .map((c) => {
      const st = listState[c.id] || {}
      const unread = unreadCounts[c.id] || st.unreadMessageCount || 0
      const online = !!st.onlineStatus
      const typing = !!st.isTyping
      return { c, unread, online, typing, warmth: warmthOf({ lastActivityAt: c.updated_at, unread, online, typing, now }) }
    })
    .sort((a, b) =>
      tier(b) - tier(a) ||
      b.warmth - a.warmth ||
      new Date(b.c.updated_at || 0) - new Date(a.c.updated_at || 0))
}
