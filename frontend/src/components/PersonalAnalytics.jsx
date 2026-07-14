import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// Personal Communication Analytics — a global version of the per-chat
// Score tab. Everything here is computed directly from real message
// timestamps across the last 30 days of the person's conversations.
// No AI, no guessing, same philosophy as RelationshipInsights' Score
// and Timeline tabs.
//
// Cost/perf note: this pulls up to LOOKBACK_DAYS of text messages
// across ALL of the person's conversations in one query, capped at
// MAX_MESSAGES. Fine for a personal messaging app's normal volume;
// if that ever becomes a real number, this is the query to paginate.

const LOOKBACK_DAYS = 30
const MAX_MESSAGES = 4000
const SHORT_MSG_WORD_LIMIT = 40
const IGNORED_WINDOW_DAYS = 7

function formatHourLabel(hour) {
  const period = hour < 12 ? 'AM' : 'PM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12} ${period}`
}

function formatDuration(ms) {
  const mins = Math.round(ms / 60000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'}`
  return `${Math.round(hrs / 24)} day${Math.round(hrs / 24) === 1 ? '' : 's'}`
}

function countWords(s) {
  return (s || '').trim().split(/\s+/).filter(Boolean).length
}

function isRealText(m) {
  return m.message_type !== 'curry' && m.content
    && !m.content.startsWith('call_log:') && !m.content.startsWith('missed_call:')
    && !m.content.startsWith('sticker:') && !m.content.startsWith('gif:')
    && !m.content.startsWith('status_reply:')
}

function computeAnalytics(allMessages, conversations, userId) {
  const byConvo = new Map()
  allMessages.forEach((m) => {
    if (!byConvo.has(m.conversation_id)) byConvo.set(m.conversation_id, [])
    byConvo.get(m.conversation_id).push(m)
  })

  const otherNameByConvo = new Map()
  conversations.forEach((c) => {
    if (c.is_group) return
    const other = c.conversation_members?.find((mem) => mem.user_id !== userId)
    if (other) otherNameByConvo.set(c.id, other.profiles?.username || other.profiles?.email || 'Someone')
  })

  const hourCounts = new Array(24).fill(0)
  const replyDelays = [] // ms, their msg -> my next reply
  const shortMsgReplyTimes = [] // ms, my short msg -> their next reply
  const longMsgReplyTimes = []
  let myTotalMsgs = 0
  let doubleTextCount = 0
  const ignoredPeople = new Set()
  const now = Date.now()

  for (const [convoId, msgs] of byConvo) {
    const sorted = [...msgs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    let prevSender = null

    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i]
      const mine = m.sender_id === userId

      if (mine) {
        myTotalMsgs++
        hourCounts[new Date(m.created_at).getHours()]++
        if (prevSender === userId) doubleTextCount++

        // their next reply after this message of mine
        const nextTheirs = sorted.slice(i + 1).find((x) => x.sender_id !== userId)
        if (nextTheirs) {
          const delta = new Date(nextTheirs.created_at) - new Date(m.created_at)
          const bucket = countWords(m.content) < SHORT_MSG_WORD_LIMIT ? shortMsgReplyTimes : longMsgReplyTimes
          bucket.push(delta)
        }
      } else {
        // my next reply after their message
        const nextMine = sorted.slice(i + 1).find((x) => x.sender_id === userId)
        if (nextMine) {
          replyDelays.push(new Date(nextMine.created_at) - new Date(m.created_at))
        }
      }
      prevSender = m.sender_id
    }

    // Ignored-this-week check: last message in this conversation's window
    // is from them, and it's recent, and I never replied to it.
    const last = sorted[sorted.length - 1]
    if (last && last.sender_id !== userId) {
      const daysSince = (now - new Date(last.created_at).getTime()) / (24 * 60 * 60 * 1000)
      if (daysSince <= IGNORED_WINDOW_DAYS) {
        const name = otherNameByConvo.get(convoId)
        if (name) ignoredPeople.add(name)
      }
    }
  }

  const avg = (arr) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
  const mostActiveHour = hourCounts.some((c) => c > 0) ? hourCounts.indexOf(Math.max(...hourCounts)) : null
  const avgReplyDelay = avg(replyDelays)
  const avgShortReply = shortMsgReplyTimes.length >= 3 ? avg(shortMsgReplyTimes) : null
  const avgLongReply = longMsgReplyTimes.length >= 3 ? avg(longMsgReplyTimes) : null
  const doubleTextRate = myTotalMsgs > 0 ? Math.round((doubleTextCount / myTotalMsgs) * 100) : null

  return {
    mostActiveHour,
    avgReplyDelay,
    avgShortReply,
    avgLongReply,
    doubleTextRate,
    ignoredPeople: [...ignoredPeople],
    totalMessages: myTotalMsgs,
    hasEnoughData: myTotalMsgs >= 10,
  }
}

function useAnalyticsData(userId, conversations) {
  const [messages, setMessages] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const convoIds = conversations.map((c) => c.id)
      if (convoIds.length === 0) { setMessages([]); setLoading(false); return }

      const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('messages')
        .select('conversation_id, sender_id, content, created_at, message_type')
        .in('conversation_id', convoIds)
        .eq('message_type', 'text')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(MAX_MESSAGES)

      if (!cancelled) {
        setMessages((data || []).filter(isRealText))
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [userId, conversations])

  return { messages, loading }
}

export default function PersonalAnalytics({ userId, conversations, onClose }) {
  const { messages, loading } = useAnalyticsData(userId, conversations)
  const analytics = useMemo(
    () => (messages ? computeAnalytics(messages, conversations, userId) : null),
    [messages, conversations, userId]
  )

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>📊 Your Communication Analytics</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={s.empty}>Crunching the last {LOOKBACK_DAYS} days…</div>
        ) : !analytics.hasEnoughData ? (
          <div style={s.empty}>Not enough recent messages yet — check back after a bit more chatting.</div>
        ) : (
          <>
            <div style={s.grid}>
              {analytics.mostActiveHour !== null && (
                <div style={s.card}>
                  <div style={s.cardLabel}>Most active hour</div>
                  <div style={s.cardValue}>{formatHourLabel(analytics.mostActiveHour)}</div>
                </div>
              )}
              {analytics.avgReplyDelay !== null && (
                <div style={s.card}>
                  <div style={s.cardLabel}>Your avg. reply delay</div>
                  <div style={s.cardValue}>{formatDuration(analytics.avgReplyDelay)}</div>
                </div>
              )}
              {analytics.doubleTextRate !== null && (
                <div style={s.card}>
                  <div style={s.cardLabel}>Follow-up rate</div>
                  <div style={s.cardValue}>{analytics.doubleTextRate}%</div>
                  <div style={s.cardFootnote}>of your messages follow another one of yours before a reply</div>
                </div>
              )}
              <div style={s.card}>
                <div style={s.cardLabel}>Messages, last {LOOKBACK_DAYS} days</div>
                <div style={s.cardValue}>{analytics.totalMessages}</div>
              </div>
            </div>

            {analytics.avgShortReply !== null && analytics.avgLongReply !== null && (
              <div style={s.insightCard}>
                <div style={s.insightTitle}>Message length vs. reply speed</div>
                <div style={s.insightBody}>
                  {analytics.avgShortReply < analytics.avgLongReply ? (
                    <>Messages under {SHORT_MSG_WORD_LIMIT} words get replies in about <strong>{formatDuration(analytics.avgShortReply)}</strong>, vs <strong>{formatDuration(analytics.avgLongReply)}</strong> for longer ones.</>
                  ) : (
                    <>No real speed difference — short messages average <strong>{formatDuration(analytics.avgShortReply)}</strong>, longer ones <strong>{formatDuration(analytics.avgLongReply)}</strong>.</>
                  )}
                </div>
              </div>
            )}

            {analytics.ignoredPeople.length > 0 && (
              <div style={s.insightCard}>
                <div style={s.insightTitle}>Waiting on your reply</div>
                <div style={s.insightBody}>
                  {analytics.ignoredPeople.join(', ')} messaged you in the last {IGNORED_WINDOW_DAYS} days and you haven't replied yet.
                </div>
              </div>
            )}

            <div style={s.footnote}>
              Computed directly from your message timestamps over the last {LOOKBACK_DAYS} days — no AI, no estimates.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  panel: {
    background: 'rgba(20,20,32,0.98)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 18,
    padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14,
    width: '100%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto',
    fontFamily: "'Inter',sans-serif",
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: 700, color: '#fff' },
  closeBtn: { background: 'none', border: 'none', color: '#666', fontSize: 15, cursor: 'pointer' },
  empty: { fontSize: 13, color: '#9ca3af', padding: '20px 0', textAlign: 'center' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  card: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, padding: '12px 14px',
  },
  cardLabel: { fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 4 },
  cardValue: { fontSize: 20, color: '#c4b5fd', fontWeight: 800 },
  cardFootnote: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4, lineHeight: 1.4 },
  insightCard: {
    background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)',
    borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4,
  },
  insightTitle: { fontSize: 12.5, fontWeight: 700, color: '#e9d5ff' },
  insightBody: { fontSize: 12.5, color: '#d8dae8', lineHeight: 1.55 },
  footnote: { fontSize: 10.5, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },
}
