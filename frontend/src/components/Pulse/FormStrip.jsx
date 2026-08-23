import React from 'react'

const COLORS = { W: '#22c55e', D: '#a1a1aa', L: '#ef4444' }

export default function FormStrip({ form }) {
  if (!form || form.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {form.map((r, i) => (
        <div
          key={i}
          title={r === 'W' ? 'Win' : r === 'D' ? 'Draw' : 'Loss'}
          style={{
            width: 20, height: 20, borderRadius: '50%', background: COLORS[r],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, color: '#0f0f1a',
          }}
        >
          {r}
        </div>
      ))}
    </div>
  )
}
