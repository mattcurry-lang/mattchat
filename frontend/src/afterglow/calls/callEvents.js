// afterglow/calls/callEvents.js
//
// Turns the app's call-log messages into something a person can read in a chat, from THEIR side of the call.
//
// A call is logged as a chat message:  call_log:<audio|video>:<status>:<seconds>[:by=<userId>][:zoom]
//   status: completed | missed | declined | cancelled
//   by=     who STARTED the call (new — older messages don't have it)
// The old "missed_call:<type>[:declined]" format is still understood.
//
// Why `by=` matters: the log row is written by whoever ends the call, not by whoever placed it, so without it
// "outgoing" vs "incoming" can't be told apart reliably. Old messages fall back to the call-history record
// (which knows who initiated), and then to the best guess the data allows.

const STATUSES = ['completed', 'missed', 'declined', 'cancelled']

export function isCallContent(c) {
  return typeof c === 'string' && (c.startsWith('call_log:') || c.startsWith('missed_call:'))
}

/** The text stored in the chat. `by=` goes BEFORE `:zoom` so older readers that test endsWith(':zoom') keep working. */
export function buildCallLogContent({ callType, status, durationSeconds = 0, isZoom = false, initiatedBy = null }) {
  const dur = Math.max(0, Math.round(Number(durationSeconds) || 0))
  return `call_log:${callType}:${status}:${dur}${initiatedBy ? `:by=${initiatedBy}` : ''}${isZoom ? ':zoom' : ''}`
}

export function parseCallLog(content) {
  if (!isCallContent(content)) return null
  const parts = content.split(':')
  let callType = parts[1] || 'audio'
  let status; let duration = 0; let zoom = false; let by = null
  if (parts[0] === 'call_log') {
    status = parts[2] || 'missed'
    duration = parseInt(parts[3], 10) || 0
    for (const seg of parts.slice(4)) {
      if (seg === 'zoom') zoom = true
      else if (seg.startsWith('by=')) by = seg.slice(3) || null
    }
  } else { // legacy  missed_call:<type>[:declined]
    status = parts[2] === 'declined' ? 'declined' : 'missed'
  }
  if (!STATUSES.includes(status)) status = 'missed'
  return { callType, isVideo: callType === 'video', status, duration, zoom, by }
}

// ── formatting ──
export function formatCallDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0))
  if (s < 60) return `${s} sec`
  const m = Math.floor(s / 60); const r = s % 60
  if (m < 60) return r ? `${m} min ${r} sec` : `${m} min`
  const h = Math.floor(m / 60); const mm = m % 60
  return mm ? `${h} hr ${mm} min` : `${h} hr`
}

// ── who called whom ──
/** Find the call-history record (active_calls) that this log message describes. */
export function matchCall(msg, parsed, history) {
  if (!history || !history.length) return null
  const t = Date.parse(msg.created_at)
  let best = null; let bestD = Infinity
  for (const c of history) {
    if (c.conversation_id !== msg.conversation_id) continue
    const ok = parsed.status === 'completed' ? (c.status === 'ended' && !!c.answered_at)
      : parsed.status === 'declined' ? c.status === 'declined'
      : (c.status === 'missed' || (c.status === 'ended' && !c.answered_at))
    if (!ok) continue
    const d = Math.abs(t - Date.parse(c.ended_at || c.created_at))
    if (d <= 120000 && d < bestD) { best = c; bestD = d }
  }
  return best
}

/** 'out' = I placed it, 'in' = it came to me, 'unknown' = the data can't say (only very old completed calls). */
export function directionOf(parsed, { meId, senderId, matched } = {}) {
  if (parsed.by) return parsed.by === meId ? 'out' : 'in'
  if (matched && matched.initiated_by) return matched.initiated_by === meId ? 'out' : 'in'
  if (parsed.status === 'missed' || parsed.status === 'cancelled') return senderId === meId ? 'out' : 'in' // logged by the caller
  if (parsed.status === 'declined') return senderId === meId ? 'in' : 'out' // logged by the person who declined
  return 'unknown'
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * What to say and offer, from the viewer's side. Mirrors what the big apps do:
 *   WhatsApp   - "Missed voice call · tap to call back" vs "Voice call · No answer"
 *   Telegram   - Missed (it rang) / Cancelled (they hung up first) / Declined (refused) are different things
 *   Messenger  - a button in the row: Call back vs Call again
 * tone: bad (missed, needs you) | warn | ok | muted
 */
export function describeCall(parsed, dir, { name = '', isGroup = false } = {}) {
  const kind = parsed.isVideo ? 'video' : 'voice'
  const noun = `${isGroup ? 'group ' : ''}${kind} call`
  const who = name || 'They'
  const base = { dir, kind, zoom: parsed.zoom, needsReply: false, backLabel: 'Call again', voiceNote: false }
  switch (parsed.status) {
    case 'completed':
      return { ...base, id: 'completed', tone: 'ok', title: cap(noun), detail: parsed.duration > 0 ? formatCallDuration(parsed.duration) : 'Connected briefly' }
    case 'missed':
      if (dir === 'out') return { ...base, id: 'no-answer', tone: 'muted', title: cap(noun), detail: 'No answer', voiceNote: true }
      return { ...base, id: 'missed', tone: 'bad', title: `Missed ${noun}`, detail: name ? `${name} tried to reach you` : 'Tap to call back', needsReply: true, backLabel: 'Call back', voiceNote: true }
    case 'cancelled':
      if (dir === 'out') return { ...base, id: 'cancelled', tone: 'muted', title: cap(noun), detail: 'You cancelled' }
      return { ...base, id: 'missed', tone: 'bad', title: `Missed ${noun}`, detail: `${who} hung up before you answered`, needsReply: true, backLabel: 'Call back', voiceNote: true }
    case 'declined':
      if (dir === 'in') return { ...base, id: 'declined-by-me', tone: 'muted', title: cap(noun), detail: 'You declined', backLabel: 'Call back' }
      return { ...base, id: 'declined', tone: 'warn', title: cap(noun), detail: `${who} declined`, voiceNote: true }
    default:
      return { ...base, id: 'completed', tone: 'muted', title: cap(noun), detail: '' }
  }
}

export const QUICK_REPLIES = ['Call you in 5 min', 'Can’t talk — text me', 'I’ll call you later']

/**
 * One pass over a conversation's messages. Returns:
 *   events    id → { parsed, dir }
 *   hidden    ids that are folded into a later card (a run of "missed" becomes ONE card with a count)
 *   bursts    id of the card that stands for the run → { count, times[] }
 *   resolved  id of a missed card → { kind: 'called' | 'replied', at }  once you've dealt with it
 */
export function analyzeCalls(messages, meId, { history = [], burstGapMin = 30 } = {}) {
  const events = new Map(); const hidden = new Set(); const bursts = new Map(); const resolved = new Map()
  const list = Array.isArray(messages) ? messages : []
  const infos = list.map((m) => {
    const p = parseCallLog(m.content)
    if (!p) return null
    const matched = matchCall(m, p, history)
    const dir = directionOf(p, { meId, senderId: m.sender_id, matched })
    const d = describeCall(p, dir)
    events.set(m.id, { parsed: p, dir })
    return { m, p, dir, id: d.id }
  })

  // runs of unanswered attempts → one card
  const collapsible = (x) => x && (x.id === 'missed' || x.id === 'no-answer')
  let run = []
  const flush = () => {
    if (run.length > 1) {
      const last = run[run.length - 1]
      run.slice(0, -1).forEach((r) => hidden.add(r.m.id))
      bursts.set(last.m.id, { count: run.length, times: run.map((r) => r.m.created_at) })
    }
    run = []
  }
  for (const x of infos) {
    if (!x) { flush(); continue }
    if (!collapsible(x)) { flush(); continue }
    const prev = run[run.length - 1]
    const sameKind = prev && prev.id === x.id && prev.p.isVideo === x.p.isVideo
    const close = prev && (Date.parse(x.m.created_at) - Date.parse(prev.m.created_at)) <= burstGapMin * 60000
    if (prev && !(sameKind && close)) flush()
    run.push(x)
  }
  flush()

  // missed calls you've since dealt with
  infos.forEach((x, i) => {
    if (!x || x.id !== 'missed') return
    for (let j = i + 1; j < list.length; j++) {
      const n = list[j]
      if (n.sender_id !== meId || n.message_type === 'curry') continue
      const ni = infos[j]
      if (ni) { if (ni.dir === 'out' || ni.id === 'completed') { resolved.set(x.m.id, { kind: 'called', at: n.created_at }); break } continue }
      resolved.set(x.m.id, { kind: 'replied', at: n.created_at }); break
    }
  })
  return { events, hidden, bursts, resolved }
}

/** For the chat list: a short line from the viewer's side. Needs `by=`; older rows stay neutral rather than wrong. */
export function callPreview(content, meId) {
  const p = parseCallLog(content)
  if (!p) return null
  const kind = p.isVideo ? 'video' : 'voice'
  const neutral = { icon: kind, tone: 'muted', dir: 'unknown', text: p.status === 'completed' ? `${cap(kind)} call${p.duration > 0 ? ` · ${formatCallDuration(p.duration)}` : ''}` : 'Call' }
  if (!p.by) return neutral
  const dir = p.by === meId ? 'out' : 'in'
  const d = describeCall(p, dir)
  if (d.id === 'completed') return { icon: kind, tone: 'ok', dir, text: `${d.title}${p.duration > 0 ? ` · ${formatCallDuration(p.duration)}` : ''}` }
  if (d.id === 'missed') return { icon: kind, tone: 'bad', dir, text: d.title }
  if (d.id === 'no-answer') return { icon: kind, tone: 'muted', dir, text: `${d.title} · No answer` }
  if (d.id === 'cancelled') return { icon: kind, tone: 'muted', dir, text: 'Cancelled call' }
  if (d.id === 'declined-by-me') return { icon: kind, tone: 'muted', dir, text: 'You declined' }
  return { icon: kind, tone: 'warn', dir, text: 'Declined' }
}

// ───────────────────────── calls drawn from CALL HISTORY ─────────────────────────
// The chat used to depend on a call_log row being INSERTED into `messages` when a call ended. That insert can be
// refused by the database (row-level security, a message_type check) and then no call ever shows in the chat —
// while the Calls tab, which reads `active_calls`, works fine. So the thread now also draws calls straight from
// the call history that is already loaded. These "events" look like messages to the list, but they have no row in
// `messages` (they're flagged `_synthetic`), so nothing may try to pin, react to, reply to or delete them.

export const isZoomRoom = (url) => typeof url === 'string' && /zoom\.(us|com)/i.test(url)

/** Map an active_calls row to a call-log status, or null while the call is still ringing / in progress. */
export function statusFromCall(c) {
  if (!c) return null
  if (c.status === 'declined') return 'declined'
  if (c.status === 'missed') return 'missed'
  if (c.status === 'ended') return c.answered_at ? 'completed' : 'cancelled' // ended before anyone picked up = the caller hung up
  return null
}

export function callEventsFromHistory(history, conversationId) {
  const out = []
  for (const c of history || []) {
    if (!c || c.conversation_id !== conversationId) continue
    const status = statusFromCall(c)
    if (!status) continue
    // null/undefined mean "not recorded" (Number(null) would wrongly be 0), so work it out from the timestamps
    let seconds = c.duration_seconds == null || c.duration_seconds === '' ? NaN : Number(c.duration_seconds)
    if (!Number.isFinite(seconds) || seconds < 0) seconds = c.answered_at && c.ended_at ? Math.max(0, Math.round((Date.parse(c.ended_at) - Date.parse(c.answered_at)) / 1000)) : 0
    if (status !== 'completed') seconds = 0
    out.push({
      id: `call:${c.id}`, _synthetic: true, _callId: c.id,
      conversation_id: c.conversation_id, sender_id: c.initiated_by, message_type: 'call_log',
      content: buildCallLogContent({ callType: c.call_type || 'audio', status, durationSeconds: seconds, isZoom: isZoomRoom(c.room_url), initiatedBy: c.initiated_by }),
      created_at: (status === 'completed' ? c.ended_at : null) || c.created_at,
    })
  }
  return out
}

/**
 * The thread's messages plus its calls, in time order. A call_log row that duplicates a call from the history is
 * dropped (the history version knows exactly who called whom); a call_log row with no match is kept, so nothing
 * that was ever logged disappears.
 */
export function mergeCallEvents(messages, history, conversationId) {
  const list = Array.isArray(messages) ? messages : []
  if (!history || !history.length || !conversationId) return list
  const events = callEventsFromHistory(history, conversationId)
  if (!events.length) return list
  const scoped = history.filter((c) => c && c.conversation_id === conversationId)
  const kept = list.filter((m) => {
    const p = parseCallLog(m && m.content)
    return !p || !matchCall(m, p, scoped)
  })
  const stamp = (m) => Date.parse(m.created_at) || 0
  return [...kept, ...events]
    .map((m, i) => ({ m, i, t: stamp(m) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.m)
}
