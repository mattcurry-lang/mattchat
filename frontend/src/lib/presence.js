// lib/presence.js
//
// Pure logic for the Presence Rail: ONE row, ONE chip per person, combining their note, their status
// and their story, so nobody ever shows up twice. No React here, so it is easy to test.

export const NOTE_MAX = 60

export const DURATIONS = [
  { id: '1h', label: '1 hour' },
  { id: '4h', label: '4 hours' },
  { id: 'today', label: 'Today' },
  { id: '24h', label: '24 hours' },
]

// One tap sets the note text AND the profile status (so the emoji badge and status line match everywhere).
export const VIBES = [
  { emoji: '📚', text: 'In class' },
  { emoji: '🏛️', text: 'At the library' },
  { emoji: '🍽️', text: 'Eating' },
  { emoji: '🚌', text: 'Commuting' },
  { emoji: '🎧', text: 'Chilling' },
  { emoji: '🔥', text: 'Grinding' },
  { emoji: '😴', text: 'Resting' },
  { emoji: '🎉', text: 'Free tonight' },
]

// Notes that ask a tiny question get answered; these save people from a blank box.
export const STARTERS = [
  'Anyone free for lunch? 🍽️',
  'Need a study buddy 📚',
  'A or B? Reply 👇',
  'Who’s up for a game? 🎮',
]

export const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👏', '😮', '🙌']
export const QUICK_REPLIES = ['Same 🙋', 'I’m in ✋', 'Where? 📍', 'Tell me more 👀']

const HOUR = 60 * 60 * 1000

/** When a note/status chosen with `durationId` should disappear (ISO string). */
export function expiryFor(durationId, now = new Date()) {
  const t = now.getTime()
  if (durationId === '1h') return new Date(t + HOUR).toISOString()
  if (durationId === '4h') return new Date(t + 4 * HOUR).toISOString()
  if (durationId === 'today') {
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    // near midnight "today" would be a few minutes: give at least an hour so it isn't instantly gone
    return new Date(Math.max(end.getTime(), t + HOUR)).toISOString()
  }
  return new Date(t + 24 * HOUR).toISOString()
}

/** "5h left", "42 min left", "Ending soon" — or '' when there is no expiry. */
export function timeLeft(iso, now = Date.now()) {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return 'Expired'
  const mins = Math.ceil(ms / 60000)
  if (mins <= 5) return 'Ending soon'
  if (mins < 60) return `${mins} min left`
  return `${Math.floor(mins / 60)}h left`
}

/** Notes quietly fade over their last hour, so a stale one doesn't look as fresh as a new one. */
export function agingOpacity(iso, now = Date.now()) {
  if (!iso) return 1
  const ms = new Date(iso).getTime() - now
  if (ms >= HOUR) return 1
  if (ms <= 0) return 0.6
  return 0.6 + 0.4 * (ms / HOUR)
}

/** What actually gets written to `profiles`. `vibe === undefined` leaves the status untouched. */
export function buildNotePatch({ text, vibe, duration, now = new Date() }) {
  const clean = (text || '').trim().slice(0, NOTE_MAX)
  const expiry = expiryFor(duration, now)
  const patch = { note_text: clean || null, note_expires_at: clean ? expiry : null }
  if (vibe !== undefined) {
    patch.status_emoji = vibe ? vibe.emoji : null
    patch.status_text = vibe ? vibe.text : null
    patch.status_expires_at = vibe ? expiry : null
  }
  return patch
}

/** A reply to a note is a normal chat message that quotes the note, so it lands in the chat like any other. */
export const quoteReply = (note, text) => `↩ Note: “${note}”\n${text}`

/**
 * Builds the single list of people for the rail.
 *  - one entry per person (a Map keyed by userId), however many things they have posted
 *  - includes anyone with a note, a status, or a story — also people you have no chat with (stories only)
 *  - never includes yourself, groups or Curry AI
 *  - order: new stories, then fresh notes, then statuses, then seen stories; closer chats win ties
 */
export function buildPresenceItems({ conversations, userId, extras, getOtherId, getAvatar, getName, statusGroups }) {
  const byUser = new Map()

  ;(conversations || []).forEach((c, index) => {
    if (c.is_group || c.isCurryAI) return
    const otherId = getOtherId(c, userId)
    if (!otherId || otherId === userId || byUser.has(otherId)) return
    byUser.set(otherId, { userId: otherId, name: getName(c), avatarUrl: getAvatar(c, userId), convo: c, convoIndex: index, story: null })
  })

  ;(statusGroups || []).forEach((g) => {
    if (!g?.userId || g.userId === userId) return
    let item = byUser.get(g.userId)
    if (!item) {
      item = { userId: g.userId, name: g.profile?.username || 'Unknown', avatarUrl: g.profile?.avatar_url || null, convo: null, convoIndex: Infinity, story: null }
      byUser.set(g.userId, item)
    }
    item.story = g
  })

  const items = []
  for (const item of byUser.values()) {
    const ex = extras.get(item.userId)
    const note = ex?.note || ''
    const vibeEmoji = ex?.statusEmoji || ''
    const vibeText = ex?.statusText || ''
    const vibe = (vibeText || vibeEmoji) ? `${vibeEmoji} ${vibeText}`.trim() : ''
    if (!note && !vibe && !item.story) continue          // nothing to show for them

    const unseen = !!item.story && !item.story.allViewed
    let rank = 0
    if (unseen) rank += 100
    if (note) rank += 60
    if (vibe) rank += 30
    if (item.story && !unseen) rank += 20
    rank += Math.max(0, 10 - Math.min(10, item.convoIndex))

    items.push({
      ...item,
      note,
      noteExpiresAt: ex?.noteExpiresAt || null,
      vibeEmoji,
      vibeText,
      bubbleText: note || vibe,       // the bubble shows the note, or falls back to their status
      hasNote: !!note,
      unseen,
      rank,
    })
  }
  return items.sort((a, b) => b.rank - a.rank || (a.name || '').localeCompare(b.name || ''))
}
