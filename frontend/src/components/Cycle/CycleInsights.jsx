import React, { useEffect, useState } from 'react'
import { IconX, IconSparkle } from '../Icons'
import { listDailyLogs } from '../../lib/cycle'
import { computeInsights } from '../../lib/cycleInsights'

const DISMISSED_KEY = 'cycle_dismissed_insights'

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')) }
  catch { return new Set() }
}
function saveDismissed(set) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set])) } catch {}
}

export default function CycleInsights({ userId, periodRecords, stats, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(loadDismissed)

  useEffect(() => {
    listDailyLogs(userId).then(l => { setLogs(l); setLoading(false) }).catch(() => setLoading(false))
  }, [userId])

  const insights = computeInsights({ periodRecords, dailyLogs: logs, stats }).filter(i => !dismissed.has(i.id))

  const dismiss = (id) => {
    const next = new Set(dismissed); next.add(id)
    setDismissed(next); saveDismissed(next)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconSparkle size={16} /> Your Patterns
        </h2>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer' }}><IconX size={15} /></button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 18px 90px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '30px 0' }}>Looking at your history…</div>}

        {!loading && insights.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🌱</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Not enough data yet</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Keep logging your daily check-ins and recording periods — patterns will show up here over time.
            </div>
          </div>
        )}

        {insights.map(insight => (
          <div key={insight.id} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,139,250,0.2)',
            borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 10,
            animation: 'fadeIn 0.3s ease',
          }}>
            <span style={{ color: '#c4b5fd', flexShrink: 0, marginTop: 1 }}><IconSparkle size={14} /></span>
            <div style={{ flex: 1, fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>{insight.text}</div>
            <button onClick={() => dismiss(insight.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', flexShrink: 0 }}>
              <IconX size={13} />
            </button>
          </div>
        ))}

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 8, lineHeight: 1.6 }}>
          These are observations from your own recorded data — not medical advice or a diagnosis.
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity:0; transform: translateY(4px);} to {opacity:1; transform:none;} }`}</style>
    </div>
  )
}
