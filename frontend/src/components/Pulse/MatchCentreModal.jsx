import React from 'react'
import { createPortal } from 'react-dom'
import { useMatchDetail } from '../../hooks/useMatchDetail'

const EVENT_ICON = {
  Goal: '⚽', Card: '🟨', subst: '🔄', Var: '📺',
}

export default function MatchCentreModal({ match, homeTeam, awayTeam, homeScore, awayScore, onClose }) {
  const { detail, loading, error } = useMatchDetail(match, true)

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Match Centre</div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ padding: '16px 16px 8px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{homeTeam} {homeScore} - {awayScore} {awayTeam}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', padding: 30, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Loading match details…</div>}
        {error && <div style={{ textAlign: 'center', padding: 30, fontSize: 13, color: '#f87171' }}>Match details aren't available for this fixture.</div>}

        {detail && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {detail.events?.length > 0 && (
              <Section title="Match Events">
                {detail.events.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < detail.events.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div style={{ width: 34, fontSize: 11.5, fontWeight: 800, color: '#c4b5fd', flexShrink: 0 }}>
                      {e.minute}{e.extraMinute ? `+${e.extraMinute}` : ''}'
                    </div>
                    <div style={{ fontSize: 15, flexShrink: 0 }}>{EVENT_ICON[e.type] || '•'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{e.player || e.detail}</div>
                      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>
                        {e.team}{e.assist ? ` · assist: ${e.assist}` : ''}{e.player ? ` · ${e.detail}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </Section>
            )}

            {detail.statistics?.length === 2 && (
              <Section title="Statistics">
                <StatComparison a={detail.statistics[0]} b={detail.statistics[1]} />
              </Section>
            )}

            {detail.lineups?.length > 0 && (
              <Section title="Lineups">
                {detail.lineups.map((l, i) => (
                  <div key={i} style={{ marginBottom: i < detail.lineups.length - 1 ? 16 : 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: '#c4b5fd', marginBottom: 6 }}>
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
              </Section>
            )}

            {!detail.events?.length && !detail.statistics?.length && !detail.lineups?.length && (
              <div style={{ textAlign: 'center', padding: 30, fontSize: 12.5, color: 'rgba(255,255,255,0.4)' }}>
                No match details available yet for this fixture.
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function StatComparison({ a, b }) {
  const keys = a.stats.map(s => s.type)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {keys.map((key, i) => {
        const aVal = a.stats.find(s => s.type === key)?.value
        const bVal = b.stats.find(s => s.type === key)?.value
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#fff', fontWeight: 700, marginBottom: 3 }}>
              <span>{aVal}</span><span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{key}</span><span>{bVal}</span>
            </div>
          </div>
        )
      })}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 4 }}>
        {a.team} vs {b.team}
      </div>
    </div>
  )
}
