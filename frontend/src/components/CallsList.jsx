import React from 'react'
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

export default function CallsList({ calls, loading, onOpenConversation }) {
  if (loading) return <div className="loading-state">Loading…</div>

  if (calls.length === 0) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>📞</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: '#fff' }}>Recent calls</div>
        <div style={{ fontSize: 13 }}>Your call history will appear here</div>
      </div>
    )
  }

  return (
    <div className="contact-list">
      {calls.map(call => {
        const missed = call.status === 'missed' || (call.status === 'declined' && !call.outgoing)
        const label = call.status === 'missed' ? 'Missed' : call.status === 'declined' ? 'Declined' : (call.outgoing ? 'Outgoing' : 'Incoming')
        const dur = fmtDuration(call.duration_seconds)
        return (
          <div key={call.id} className="contact" onClick={() => onOpenConversation?.(call.conversation_id)}>
            <Avatar name={call.convoName} size={46} />
            <div className="contact-info">
              <div className="contact-name" style={{ color: missed ? '#f87171' : undefined }}>{call.convoName}</div>
              <div className="contact-preview" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {call.call_type === 'video' ? <IconVideo size={12} /> : <IconPhone size={12} />}
                {call.outgoing ? '↗' : '↙'} {label}{dur ? ` · ${dur}` : ''}
              </div>
            </div>
            <div className="contact-time">{fmtCallTime(call.created_at)}</div>
          </div>
        )
      })}
    </div>
  )
}
