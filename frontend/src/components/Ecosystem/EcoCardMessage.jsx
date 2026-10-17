// src/components/Ecosystem/EcoCardMessage.jsx
// Renders an ecosystem card inside the chat. Pass the result of parseEcoCard().
//
// Props:
//   card         parsed card (or null if it can't be shown)
//   viewerId     the signed-in user's id
//   messageId    id of the chat message carrying the card
//   senderName   who shared it
//   isMe         true if the viewer sent it (hides "Add to my tasks")
//   onOpenTasks  optional: opens the Tasks screen after adding

import React, { useEffect, useState } from 'react'
import { googleCalendarUrl, addCardToMyTasks, hasCardTask } from '../../lib/ecosystem/cards'

function formatDue(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  // UTC on both sides so the date never shifts with the viewer's timezone
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

const pill = { display: 'inline-block', padding: '8px 14px', borderRadius: 999, fontSize: 13.5, fontWeight: 650, border: 'none', cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' }

export default function EcoCardMessage({ card, viewerId, messageId, senderName, isMe, onOpenTasks }) {
  // 'checking' | 'idle' | 'adding' | 'added' | 'error'
  const [state, setState] = useState('checking')
  const canAdd = !!card && !isMe && !!viewerId && !!messageId

  useEffect(() => {
    if (!canAdd) return undefined
    let live = true
    hasCardTask(viewerId, messageId)
      .then((yes) => { if (live) setState(yes ? 'added' : 'idle') })
      .catch(() => { if (live) setState('idle') })
    return () => { live = false }
  }, [canAdd, viewerId, messageId])

  const add = async () => {
    if (state === 'adding') return
    setState('adding')
    try {
      await addCardToMyTasks(viewerId, card, { messageId, fromName: senderName })
      setState('added')
    } catch {
      setState('error')
    }
  }

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
      <div style={{ padding: '8px 12px 12px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {canAdd && state !== 'added' && (
          <button type="button" style={{ ...pill, background: '#7c3aed', color: '#fff', opacity: state === 'adding' || state === 'checking' ? 0.6 : 1 }}
            disabled={state === 'adding' || state === 'checking'} onClick={add}>
            {state === 'adding' ? 'Adding…' : 'Add to my tasks'}
          </button>
        )}
        {canAdd && state === 'added' && (
          <>
            <span style={{ ...pill, background: 'transparent', color: '#4ade80', padding: '8px 2px' }}>✓ In your tasks</span>
            {onOpenTasks && <button type="button" style={{ ...pill, background: 'var(--chip, #241d3b)', color: 'inherit' }} onClick={onOpenTasks}>Open</button>}
          </>
        )}
        <a href={googleCalendarUrl(card)} target="_blank" rel="noopener noreferrer"
          style={{ ...pill, background: 'var(--chip, #241d3b)', color: 'inherit' }}>
          Add to calendar
        </a>
      </div>
      {state === 'error' && (
        <div role="alert" style={{ padding: '0 12px 12px', fontSize: 12.5, color: '#f87171' }}>Couldn’t add it. Check your connection and try again.</div>
      )}
    </div>
  )
}
