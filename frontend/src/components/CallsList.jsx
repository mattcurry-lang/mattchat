// CallsList.jsx
// Redesigned as a WhatsApp/Mattchat hybrid: WhatsApp's structure (date-
// grouped rows, red missed-call styling, one-tap redial, All/Missed
// filter) rendered in Mattchat's own glass-card visual language instead
// of WhatsApp's flat list rows.
//
// Same props as before — calls, loading, onOpenConversation — so nothing
// upstream (useCallHistory, ChatPage) needs to change. onCall is new and
// optional: pass it to enable the one-tap redial icon; omitted, the row
// just opens the conversation like it always did.

import React, { useMemo, useState } from 'react'
import Avatar from './Avatar'
import { IconPhone, IconVideo } from './Icons'
import { format, isToday, isYesterday } from 'date-fns'
import { createPortal } from 'react-dom'

function fmtCallTime(ts) {
  const d = new Date(ts)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d')
}
function fmtDuration(sec) {
  if (!sec) return null
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
function dayGroupLabel(ts) {
  const d = new Date(ts)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMMM d, yyyy')
}

const IconRedial = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9a8 8 0 1 1 1.5 6.7" /><path d="M4 4v5h5" />
  </svg>
)

const IconChevronDown = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)
const IconMessageSquare = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)
const IconTrash = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m-8 0l1 13a2 2 0 002 2h4a2 2 0 002-2l1-13" />
  </svg>
)

// Per-row dropdown — same createPortal-anchored pattern as ChatPage's
// ThreeDotMenu, so it renders above everything and positions off the
// trigger button's real screen location rather than the scrolling list.
function CallRowMenu({ anchorRef, onMessage, onVideoCall, onVoiceCall, onDelete, onClose }) {
  const [pos, setPos] = useState(null)
  const menuRef = React.useRef(null)

  React.useEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return
    const MENU_WIDTH = 180
    const left = Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)
    setPos({ top: rect.bottom + 6, left: Math.max(8, left) })
  }, [anchorRef])

  React.useEffect(() => {
    const handler = (e) => {
      if (menuRef.current?.contains(e.target)) return
      if (anchorRef.current?.contains(e.target)) return
      onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  const items = [
    { icon: <IconMessageSquare size={15} />, label: 'Message', action: onMessage },
    { icon: <IconVideo size={15} />, label: 'Video call', action: onVideoCall },
    { icon: <IconPhone size={15} />, label: 'Voice call', action: onVoiceCall },
    { icon: <IconTrash size={15} />, label: 'Delete', action: onDelete, danger: true },
  ]

  if (!pos) return null

  return createPortal(
    <div ref={menuRef} style={{ ...menuStyles.wrap, top: pos.top, left: pos.left }}>
      {items.map(({ icon, label, action, danger }) => (
        <button
          key={label}
          onClick={() => { action?.(); onClose() }}
          style={{ ...menuStyles.item, color: danger ? '#f87171' : '#e4e0f0' }}
        >
          <span style={{ ...menuStyles.itemIcon, color: danger ? '#f87171' : '#c9c0ff' }}>{icon}</span>
          {label}
        </button>
      ))}
    </div>,
    document.body
  )
}

const IconArrowUpRight = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
  </svg>
)
const IconArrowDownLeft = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <line x1="17" y1="7" x2="7" y2="17" /><polyline points="17 17 7 17 7 7" />
  </svg>
)

export default function CallsList({ calls, loading, onOpenConversation, onCall, onDeleteCall }) {
  const [filter, setFilter] = useState('all') // 'all' | 'missed'
   const [openMenuId, setOpenMenuId] = useState(null)
  const rowMenuRefs = React.useRef({})

  const filtered = useMemo(() => {
    if (filter === 'all') return calls
    return calls.filter(c => c.status === 'missed' || (c.status === 'declined' && !c.outgoing))
  }, [calls, filter])

  const grouped = useMemo(() => {
    const groups = []
    let lastLabel = null
    filtered.forEach(call => {
      const label = dayGroupLabel(call.created_at)
      if (label !== lastLabel) { groups.push({ label, calls: [] }); lastLabel = label }
      groups[groups.length - 1].calls.push(call)
    })
    return groups
  }, [filtered])

  if (loading) return <div className="loading-state">Loading…</div>

  return (
    <div style={styles.wrap}>
      <div style={styles.filterRow}>
        <button
          onClick={() => setFilter('all')}
          style={{ ...styles.filterPill, ...(filter === 'all' ? styles.filterPillActive : {}) }}
        >
          All
        </button>
        <button
          onClick={() => setFilter('missed')}
          style={{ ...styles.filterPill, ...(filter === 'missed' ? styles.filterPillActiveMissed : {}) }}
        >
          Missed
        </button>
      </div>

      {calls.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIconWrap}><IconPhone size={26} /></div>
          <div style={styles.emptyTitle}>Recent calls</div>
          <div style={styles.emptySub}>Your call history will appear here</div>
        </div>
      ) : grouped.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyTitle}>No missed calls</div>
          <div style={styles.emptySub}>You're all caught up</div>
        </div>
      ) : (
        grouped.map(group => (
          <div key={group.label}>
            <div style={styles.groupLabel}>{group.label}</div>
            {group.calls.map(call => {
              const missed = call.status === 'missed' || (call.status === 'declined' && !call.outgoing)
              const label = call.status === 'missed' ? 'Missed' : call.status === 'declined' ? 'Declined' : (call.outgoing ? 'Outgoing' : 'Incoming')
              const dur = fmtDuration(call.duration_seconds)
              return (
                <div key={call.id} style={styles.row} onClick={() => onOpenConversation?.(call.conversation_id)}>
                  <div style={styles.avatarWrap}>
                    <Avatar name={call.convoName} size={48} />
                    <span style={{ ...styles.typeBadge, ...(call.call_type === 'video' ? styles.typeBadgeVideo : styles.typeBadgeVoice) }}>
                      {call.call_type === 'video' ? <IconVideo size={10} /> : <IconPhone size={10} />}
                    </span>
                  </div>

                  <div style={styles.info}>
                    <div style={{ ...styles.name, color: missed ? '#f87171' : '#f2f0f8' }}>{call.convoName}</div>
                    <div style={styles.metaRow}>
                      <span style={{ color: missed ? '#f87171' : 'rgba(148,120,255,0.75)' }}>
                        {call.outgoing ? <IconArrowUpRight /> : <IconArrowDownLeft />}
                      </span>
                      <span style={styles.metaText}>{label}{dur ? ` · ${dur}` : ''}</span>
                    </div>
                  </div>

                  <div style={styles.rightCol}>
                    <div style={styles.time}>{fmtCallTime(call.created_at)}</div>
   <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {onCall && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onCall(call) }}
                          style={styles.redialBtn}
                          title={`Call ${call.convoName} again`}
                          aria-label={`Call ${call.convoName} again`}
                        >
                          <IconRedial size={15} />
                        </button>
                      )}
                      <button
                        ref={(el) => { rowMenuRefs.current[call.id] = el }}
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(v => (v === call.id ? null : call.id)) }}
                        style={styles.chevronBtn}
                        title="More"
                        aria-label="More options"
                      >
                        <IconChevronDown size={14} />
                      </button>
                    </div>
                    {openMenuId === call.id && (
                      <CallRowMenu
                        anchorRef={{ current: rowMenuRefs.current[call.id] }}
                        onMessage={() => onOpenConversation?.(call.conversation_id)}
                        onVideoCall={() => onCall?.({ ...call, call_type: 'video' })}
                        onVoiceCall={() => onCall?.({ ...call, call_type: 'audio' })}
                        onDelete={() => onDeleteCall?.(call.id)}
                        onClose={() => setOpenMenuId(null)}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}

const menuStyles = {
  wrap: {
    position: 'fixed', zIndex: 2000, width: 180,
    background: 'rgba(20,18,30,0.98)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(148,120,255,0.2)', borderRadius: 14,
    boxShadow: '0 12px 32px rgba(0,0,0,0.5)', overflow: 'hidden', padding: 6,
  },
  item: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px',
    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 600, borderRadius: 9, textAlign: 'left',
  },
  itemIcon: { width: 18, display: 'flex', justifyContent: 'center' },
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column' },
  filterRow: { display: 'flex', gap: 8, padding: '10px 16px 6px' },
  filterPill: {
    padding: '6px 16px', borderRadius: 20, border: '1px solid rgba(148,120,255,0.2)',
    background: 'rgba(148,120,255,0.06)', color: 'rgba(228,224,240,0.65)',
    fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },
  filterPillActive: { background: 'linear-gradient(135deg,#7F5FFF,#C86DD7)', border: '1px solid transparent', color: '#fff' },
  filterPillActiveMissed: { background: 'linear-gradient(135deg,#ef4444,#b91c1c)', border: '1px solid transparent', color: '#fff' },

  groupLabel: {
    padding: '14px 16px 6px', fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
    textTransform: 'uppercase', color: 'rgba(228,224,240,0.4)',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', cursor: 'pointer',
    transition: 'background 0.12s',
  },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  typeBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #14121f', color: '#fff',
  },
  typeBadgeVoice: { background: 'linear-gradient(135deg,#7F5FFF,#C86DD7)' },
  typeBadgeVideo: { background: 'linear-gradient(135deg,#38A3F5,#7F5FFF)' },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 14.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  metaRow: { display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 },
  metaText: { fontSize: 12, color: 'rgba(228,224,240,0.55)' },
  rightCol: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  time: { fontSize: 11.5, color: 'rgba(228,224,240,0.4)' },
  redialBtn: {
    width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(148,120,255,0.25)',
    background: 'rgba(148,120,255,0.1)', color: '#c9c0ff', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer',
  },
     chevronBtn: {
    width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(148,120,255,0.1)',
    color: 'rgba(228,224,240,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  emptyState: { padding: '64px 24px', textAlign: 'center' },
  emptyIconWrap: {
    width: 60, height: 60, borderRadius: '50%', margin: '0 auto 14px',
    background: 'linear-gradient(135deg, rgba(127,95,255,0.18), rgba(200,109,215,0.14))',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9c0ff',
  },
  emptyTitle: { fontWeight: 700, fontSize: 15, marginBottom: 6, color: '#fff' },
  emptySub: { fontSize: 13, color: 'rgba(228,224,240,0.5)' },
}
