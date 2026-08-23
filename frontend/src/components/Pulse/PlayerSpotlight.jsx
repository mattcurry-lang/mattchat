import React, { useState } from 'react'
import { useTopScorers } from '../../hooks/useTopScorers'
import PlayerDetailModal from './PlayerDetailModal'

const autoContrastText = {
  color: '#ffffff',
  mixBlendMode: 'difference',
}

export default function PlayerSpotlight() {
  const { players, loading, error } = useTopScorers()
  const [selected, setSelected] = useState(null)

  if (loading) return <div style={{ fontSize: 12, ...autoContrastText, opacity: 0.5 }}>Loading top scorers…</div>
  if (error || players.length === 0) return null // gracefully hide, per spec — no fake data

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, ...autoContrastText, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
        Top Scorers
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        {players.map((p, i) => (
          <button
            key={i}
            onClick={() => setSelected(p)}
            style={{
              flexShrink: 0, width: 100, borderRadius: 14, padding: '10px 8px', background: 'rgba(127,127,127,0.08)',
              border: '1px solid rgba(167,139,250,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
            }}
          >
            <img src={p.photo} alt={p.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
            <div style={{ fontSize: 10.5, fontWeight: 700, ...autoContrastText, textAlign: 'center', lineHeight: 1.2 }}>{p.name}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed' }}>⚽ {p.goals}</div>
            {p.assists > 0 && <div style={{ fontSize: 9.5, ...autoContrastText, opacity: 0.5 }}>{p.assists} assists</div>}
          </button>
        ))}
      </div>
      {selected && <PlayerDetailModal player={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
