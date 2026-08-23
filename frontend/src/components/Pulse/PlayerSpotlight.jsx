import React from 'react'
import { useTopScorers } from '../../hooks/useTopScorers'

export default function PlayerSpotlight() {
  const { players, loading, error } = useTopScorers()

  if (loading) return <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading top scorers…</div>
  if (error || players.length === 0) return null // gracefully hide, per spec — no fake data

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
        Top Scorers
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        {players.map((p, i) => (
          <div key={i} style={{
            flexShrink: 0, width: 100, borderRadius: 14, padding: '10px 8px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(167,139,250,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}>
            <img src={p.photo} alt={p.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>{p.name}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#c4b5fd' }}>⚽ {p.goals}</div>
            {p.assists > 0 && <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.45)' }}>{p.assists} assists</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
