// src/beyond/LiveShareBar.jsx
//
// Shown at the top of a chat for as long as YOU are sharing your live location
// with that person. Sharing should never be invisible to the person doing it.

import React from 'react'

export default function LiveShareBar({ expiresAt, onStop }) {
  const until = new Date(expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, margin: '8px 16px 0', padding: '8px 10px 8px 14px',
        borderRadius: 14, background: 'rgba(123,224,164,0.08)', border: '1px solid rgba(123,224,164,0.28)',
        fontSize: 12.5, color: '#d7f5e3',
      }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: '#7be0a4', boxShadow: '0 0 0 4px rgba(123,224,164,0.18)', flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0 }}>Sharing your live location until {until}</span>
      <button
        onClick={onStop}
        style={{
          flex: 'none', minHeight: 32, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(248,113,113,0.5)',
          background: 'rgba(248,113,113,0.12)', color: '#fecaca', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Stop
      </button>
    </div>
  )
}
