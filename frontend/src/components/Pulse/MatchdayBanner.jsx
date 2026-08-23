import React from 'react'

const PHASE_LABEL = {
  pre: 'MATCHDAY',
  live: 'LIVE NOW',
  post: 'FULL TIME',
}

const PHASE_COLOR = {
  pre: '#a78bfa',
  live: '#ef4444',
  post: 'rgba(255,255,255,0.5)',
}

export default function MatchdayBanner({ phase }) {
  if (!phase) return null
  const color = PHASE_COLOR[phase]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
      padding: '5px 10px', borderRadius: 20, width: 'fit-content',
      background: `${color}1a`, border: `1px solid ${color}55`,
    }}>
      {phase === 'live' && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, animation: 'livePulse 1.4s ease infinite' }} />
      )}
      <span style={{ fontSize: 10.5, fontWeight: 800, color, letterSpacing: 0.5 }}>
        {PHASE_LABEL[phase]}
      </span>
    </div>
  )
}
