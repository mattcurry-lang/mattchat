import React from 'react'
import { usePreMatchLineups } from '../../hooks/usePreMatchLineups'

export default function PreMatchLineups({ match }) {
  const { lineups, loading } = usePreMatchLineups(match)

  if (loading && !lineups) return null // no skeleton — this is a bonus section, not core content
  if (!lineups || lineups.length === 0) return null // lineup not announced yet — hide gracefully

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
        Starting Lineups
      </div>
      {lineups.map((l, i) => (
        <div key={i} style={{ marginBottom: i < lineups.length - 1 ? 12 : 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#c4b5fd', marginBottom: 6 }}>
            {l.team} {l.formation && `(${l.formation})`}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {l.startXI.map((p, j) => (
              <div key={j} style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '4px 8px' }}>
                {p.number ? `${p.number}. ` : ''}{p.name}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
