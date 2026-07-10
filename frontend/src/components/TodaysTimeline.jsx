import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { callCurryAI } from './CurryAI'

// Today's Timeline — a compact strip above the chat list summarizing
// what's actually happening right now, all derived from real data:
//   - unread messages (useUnreadCounts, already tracked in ChatPage)
//   - conversations active today (updated_at === today)
//   - pending scheduled messages (scheduled_messages table)
//   - chats shared with Curry (sharedConvoIds, already tracked)
//   - live weather + rain alert (same Open-Meteo call as the daily brief)
//
// Deliberately does NOT show emails, calendar events, or task due-dates —
// those need a Gmail read scope / calendar table / due-date column that
// don't exist yet. Nothing here is invented; if a data point is empty,
// its row just doesn't render.
//
// Collapses to a slim bar once the user minimizes it, persisted in
// sessionStorage so it stays out of the way for the rest of the tab
// session (mirrors the UI note about the daily brief card being tall
// on smaller screens).

const STORAGE_KEY = 'curry_timeline_collapsed'

function weatherEmoji(description = '') {
  const d = description.toLowerCase()
  if (d.includes('thunder')) return '⛈️'
  if (d.includes('snow')) return '❄️'
  if (d.includes('drizzle') || d.includes('rain') || d.includes('shower')) return '🌧️'
  if (d.includes('fog')) return '🌫️'
  if (d.includes('overcast')) return '☁️'
  if (d.includes('partly') || d.includes('mainly clear')) return '⛅'
  if (d.includes('clear')) return '☀️'
  return '🌡️'
}

export default function TodaysTimeline({ session, userId, totalUnread, conversations, sharedConvoIds }) {
  const [weather, setWeather] = useState(null)
  const [scheduledCount, setScheduledCount] = useState(0)
  const [collapsed, setCollapsed] = useState(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    if (!navigator.geolocation) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const data = await callCurryAI('weather', { lat: latitude, lon: longitude }, session)
          if (!cancelled && data.ok) setWeather(data.weather)
        } catch (e) { console.error('Timeline weather fetch failed:', e) }
      },
      () => {},
      { timeout: 8000, maximumAge: 10 * 60000 }
    )
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadScheduled() {
      const { count } = await supabase
        .from('scheduled_messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', userId)
        .eq('status', 'pending')
      if (!cancelled) setScheduledCount(count || 0)
    }
    if (userId) loadScheduled()
    return () => { cancelled = true }
  }, [userId])

  const activeToday = (conversations || []).filter(c => {
    if (!c.updated_at) return false
    return new Date(c.updated_at).toDateString() === new Date().toDateString()
  }).length

  const items = []
  if (totalUnread > 0) items.push({ icon: '💬', text: `${totalUnread} unread message${totalUnread === 1 ? '' : 's'}` })
  if (activeToday > 0) items.push({ icon: '🗨️', text: `${activeToday} conversation${activeToday === 1 ? '' : 's'} active today` })
  if (scheduledCount > 0) items.push({ icon: '🕐', text: `${scheduledCount} message${scheduledCount === 1 ? '' : 's'} scheduled` })
  if (sharedConvoIds?.size > 0) items.push({ icon: '✨', text: `${sharedConvoIds.size} chat${sharedConvoIds.size === 1 ? '' : 's'} shared with Curry` })
  if (weather) items.push({ icon: weatherEmoji(weather.description), text: `${weather.tempC}°C, ${weather.description}` })
  if (weather?.rainAlert) items.push({ icon: '☔', text: weather.rainAlert })

  if (items.length === 0) return null

  const toggle = () => {
    setCollapsed(v => {
      const next = !v
      try { sessionStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }

  if (collapsed) {
    return (
      <button style={s.collapsedBar} onClick={toggle}>
        <span style={s.collapsedLabel}>📋 Today's Brief</span>
        <span style={s.collapsedCount}>{items.length} update{items.length === 1 ? '' : 's'}</span>
        <span style={s.expandArrow}>▾</span>
      </button>
    )
  }

  return (
    <div style={s.card}>
      <div style={s.headerRow}>
        <span style={s.title}>📋 Today's Brief</span>
        <button style={s.collapseBtn} onClick={toggle} title="Minimize">︿</button>
      </div>
      <div style={s.list}>
        {items.map((item, i) => (
          <div key={i} style={s.item}>
            <span style={s.itemIcon}>{item.icon}</span>
            <span style={s.itemText}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  card: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '12px 16px', margin: '8px 16px 0',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 12.5, fontWeight: 700, color: '#c9cbe0', letterSpacing: '0.02em' },
  collapseBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', padding: 2 },
  list: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px' },
  item: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#d8dae8', fontWeight: 500 },
  itemIcon: { fontSize: 13 },
  itemText: {},
  collapsedBar: {
    display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% - 32px)', margin: '8px 16px 0',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
    padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit',
  },
  collapsedLabel: { fontSize: 12, color: '#9ca3af', fontWeight: 600 },
  collapsedCount: { flex: 1, textAlign: 'left', fontSize: 11.5, color: 'rgba(255,255,255,0.35)' },
  expandArrow: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
}
