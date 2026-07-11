import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Today's Timeline — now a small circular badge that sits beside Curry's
// avatar in the PromotedDailyBrief header, instead of its own full-width
// strip. Tapping it opens a compact dropdown with the same info.
//
// Weather was intentionally REMOVED from here — PromotedDailyBrief
// already fetches and displays it, and showing it twice (once in each
// strip) was the main clutter complaint. This component now only
// covers things the brief card doesn't: unread count, conversations
// active today, pending scheduled messages, and chats shared with Curry.

export default function TodaysTimeline({ userId, totalUnread, conversations, sharedConvoIds }) {
  const [scheduledCount, setScheduledCount] = useState(0)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

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

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const activeToday = (conversations || []).filter(c => {
    if (!c.updated_at) return false
    return new Date(c.updated_at).toDateString() === new Date().toDateString()
  }).length

  const items = []
  if (totalUnread > 0) items.push({ icon: '💬', text: `${totalUnread} unread message${totalUnread === 1 ? '' : 's'}` })
  if (activeToday > 0) items.push({ icon: '🗨️', text: `${activeToday} conversation${activeToday === 1 ? '' : 's'} active today` })
  if (scheduledCount > 0) items.push({ icon: '🕐', text: `${scheduledCount} message${scheduledCount === 1 ? '' : 's'} scheduled` })
  if (sharedConvoIds?.size > 0) items.push({ icon: '✨', text: `${sharedConvoIds.size} chat${sharedConvoIds.size === 1 ? '' : 's'} shared with Curry` })

  if (items.length === 0) return null

  return (
    <div ref={wrapRef} style={s.wrap}>
      <button style={s.badge} onClick={() => setOpen(v => !v)} title="Today's Brief">
        <span style={s.badgeIcon}>📋</span>
        <span style={s.badgeCount}>{items.length}</span>
      </button>

      {open && (
        <div style={s.panel}>
          <div style={s.panelTitle}>Today's Brief</div>
          <div style={s.list}>
            {items.map((item, i) => (
              <div key={i} style={s.item}>
                <span style={s.itemIcon}>{item.icon}</span>
                <span style={s.itemText}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  // Positioned by the parent (ChatPage renders this inside a
  // position:relative wrapper around PromotedDailyBrief) so it sits
  // just to the right of Curry's avatar circle in the brief header.
  wrap: { position: 'absolute', top: 20, left: 56, zIndex: 5 },
  badge: {
    width: 26, height: 26, borderRadius: '50%', position: 'relative',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },
  badgeIcon: { fontSize: 12 },
  badgeCount: {
    position: 'absolute', top: -5, right: -5, minWidth: 15, height: 15, borderRadius: 999,
    background: 'var(--brand-grad, linear-gradient(135deg,#6c63ff,#a78bfa))',
    color: '#fff', fontSize: 9.5, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
    boxShadow: '0 0 0 2px #171225',
  },
  panel: {
    position: 'absolute', top: 32, left: 0, width: 220, zIndex: 20,
    background: '#1c1830', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
    padding: '10px 12px', boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  panelTitle: { fontSize: 11.5, fontWeight: 700, color: '#c9cbe0', letterSpacing: '0.02em', marginBottom: 2 },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  item: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#d8dae8', fontWeight: 500 },
  itemIcon: { fontSize: 13 },
  itemText: {},
}
