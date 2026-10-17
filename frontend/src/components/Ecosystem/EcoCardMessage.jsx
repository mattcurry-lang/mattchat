// src/components/Ecosystem/EcoCardMessage.jsx
// Renders an ecosystem card inside the chat. Pass the result of parseEcoCard().

import React from 'react'
import { googleCalendarUrl } from '../../lib/ecosystem/cards'

function formatDue(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  // UTC on both sides so the date never shifts with the viewer's timezone
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export default function EcoCardMessage({ card }) {
  const box = {
    width: 'min(300px, 100%)', borderRadius: 16, overflow: 'hidden',
    background: 'var(--bg-surface-1, #14141f)', border: '1px solid var(--border, #2a2a3a)',
    color: 'var(--text-primary, #f2eefc)',
  }

  if (!card) {
    return <div style={{ ...box, padding: 12, fontSize: 13, color: 'var(--text-muted, #a39bc0)' }}>This card can’t be shown on your version of Mattchat.</div>
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 0' }}>
        <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#0ea5e9', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 750 }}>T</span>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text-muted, #a39bc0)' }}>
          Tasks{card.automated ? ' · shared automatically' : ''}
        </span>
      </div>
      <div style={{ padding: '8px 12px 4px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{card.title}</div>
        {card.dueDate && <div style={{ fontSize: 13.5, color: 'var(--text-muted, #a39bc0)', marginTop: 4 }}>Due {formatDue(card.dueDate)}</div>}
      </div>
      <div style={{ padding: '8px 12px 12px' }}>
        <a href={googleCalendarUrl(card)} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 999, background: '#7c3aed', color: '#fff', fontSize: 13.5, fontWeight: 650, textDecoration: 'none' }}>
          Add to calendar
        </a>
      </div>
    </div>
  )
}
