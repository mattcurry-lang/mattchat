import React from 'react'
import { format, isToday, isYesterday } from 'date-fns'

function formatMsgTime(ts) {
  const d = new Date(ts)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`
  return format(d, 'MMM d, h:mm a')
}

// Double-tick status indicator, WhatsApp's own visual language kept
// intentionally recognizable — just recolored to fit Mattchat's
// purple accent instead of WhatsApp's blue, per the "familiar but
// blended in" brief
function StatusTicks({ status }) {
  if (status === 'failed') {
    return <span style={{ color: '#f87171', fontSize: 11 }} title="Failed to send">⚠</span>
  }
  const color = status === 'read' ? '#a78bfa' : 'rgba(255,255,255,0.4)'
  const double = status === 'delivered' || status === 'read'
  return (
    <span style={{ display: 'inline-flex', color, fontSize: 13, lineHeight: 1 }} title={status}>
      {double ? '✓✓' : '✓'}
    </span>
  )
}

export default function WhatsAppMessageBubble({ message }) {
  const isMe = message.direction === 'outbound'

  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', padding: '2px 14px' }}>
      <div
        style={{
          maxWidth: '72%',
          background: isMe
            ? 'linear-gradient(135deg, rgba(102,126,234,0.28), rgba(118,75,162,0.28))'
            : 'var(--bg-surface-2)',
          border: isMe ? '1px solid rgba(167,139,250,0.35)' : '1px solid var(--border)',
          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding: '8px 12px',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        {message.message_type === 'unsupported' ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            This message type isn't supported yet
          </div>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.content || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(no text)</span>}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginTop: 4 }}>
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{formatMsgTime(message.timestamp)}</span>
          {isMe && <StatusTicks status={message.status} />}
        </div>
      </div>
    </div>
  )
}
