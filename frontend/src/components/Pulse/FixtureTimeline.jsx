import React from 'react'

function formatShortDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

// past: array of recentFixtures (has scores), upcoming: array of upcomingFixtures (no scores yet)
export default function FixtureTimeline({ past = [], upcoming = [], onSelectMatch }) {
  const items = [
    ...past.slice().reverse().map(f => ({ ...f, kind: 'past' })),
    ...upcoming.map(f => ({ ...f, kind: 'upcoming' })),
  ]
  if (items.length === 0) return null

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', opacity: 0.9, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Fixtures
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        {items.map((f, i) => {
          const isPast = f.kind === 'past'
          const teamScore = isPast ? (f.isHome ? f.homeScore : f.awayScore) : null
          const oppScore = isPast ? (f.isHome ? f.awayScore : f.homeScore) : null
          const resultColor = isPast
            ? (teamScore > oppScore ? '#22c55e' : teamScore < oppScore ? '#ef4444' : '#a1a1aa')
            : 'rgba(255,255,255,0.3)'

          return (
            <button
              key={f.id || i}
              onClick={() => onSelectMatch?.(f)}
              style={{
                flexShrink: 0, width: 108, borderRadius: 14, padding: '10px 8px',
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${isPast ? resultColor + '55' : 'rgba(167,139,250,0.2)'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                {formatShortDate(f.utcDate)}
              </div>
              <img src={f.opponentCrest} alt={f.opponent} style={{ width: 26, height: 26, objectFit: 'contain' }} />
              <div style={{ fontSize: 10.5, color: '#fff', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
                {f.isHome ? 'vs' : '@'} {f.opponent}
              </div>
              {isPast ? (
                <div style={{ fontSize: 12, fontWeight: 800, color: resultColor }}>
                  {f.homeScore}-{f.awayScore}
                </div>
              ) : (
                <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.35)' }}>Upcoming</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
