import React from 'react'
import { AppIcon } from './PulseIcons'

// Honest placeholder — clearly explains WHY it's locked instead of
// pretending the feature exists. Becomes real once a native Android
// app with NotificationListenerService access ships.
export default function PulseLockedCard({ app, label }) {
  const Icon = AppIcon[app] || AppIcon.mattchat
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        borderRadius: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
        opacity: 0.55,
      }}
    >
      <Icon size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
          Available once Mattchat's mobile app is installed
        </div>
      </div>
      <span style={{
        fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap',
      }}>
        Locked
      </span>
    </div>
  )
}
