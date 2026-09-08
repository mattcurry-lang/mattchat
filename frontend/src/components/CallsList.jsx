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

export default function CallsList({ calls, loading, onOpenConversation, onCall }) {
  const [filter, setFilter] = useState('all') // 'all' | 'missed'

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
  emptyState: { padding: '64px 24px', textAlign: 'center' },
  emptyIconWrap: {
    width: 60, height: 60, borderRadius: '50%', margin: '0 auto 14px',
    background: 'linear-gradient(135deg, rgba(127,95,255,0.18), rgba(200,109,215,0.14))',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9c0ff',
  },
  emptyTitle: { fontWeight: 700, fontSize: 15, marginBottom: 6, color: '#fff' },
  emptySub: { fontSize: 13, color: 'rgba(228,224,240,0.5)' },
}
