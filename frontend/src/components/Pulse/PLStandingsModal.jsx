import React from 'react'
import { createPortal } from 'react-dom'
import { usePLStandings } from '../../hooks/usePLStandings'

export default function PLStandingsModal({ highlightTeamId, onClose }) {
  const { table, loading, error } = usePLStandings()

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'var(--bg-surface-1, #0f0f1a)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-surface-1, #14141f)', flexShrink: 0,
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Premier League Table</div>
        <button onClick={onClose} style={{ background: 'var(--bg-surface-2)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: 'var(--text-primary)', cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 32px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 30, fontSize: 13, color: 'var(--text-muted)' }}>Loading table…</div>}
        {error && <div style={{ textAlign: 'center', padding: 30, fontSize: 13, color: '#f87171' }}>Couldn't load the table right now.</div>}

        {!loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '28px 1fr 32px 32px 32px 32px 44px 44px',
              gap: 6, padding: '6px 8px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: 0.3,
            }}>
              <div>#</div><div>Club</div><div>P</div><div>W</div><div>D</div><div>L</div><div>GD</div><div>Pts</div>
            </div>

            {table.map(row => {
              const isMine = highlightTeamId && row.teamId === String(highlightTeamId)
              return (
                <div
                  key={row.teamId}
                  style={{
                    display: 'grid', gridTemplateColumns: '28px 1fr 32px 32px 32px 32px 44px 44px',
                    gap: 6, alignItems: 'center', padding: '8px 8px', borderRadius: 10,
                    background: isMine ? 'rgba(167,139,250,0.14)' : 'transparent',
                    border: isMine ? '1px solid rgba(167,139,250,0.3)' : '1px solid transparent',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{row.position}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <img src={row.crest} alt="" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: isMine ? 800 : 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.shortName || row.name}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.played}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.won}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.draw}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.lost}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{row.points}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
