import React, { useEffect, useState } from 'react'
import { IconX, IconHeart, IconMessageSquare, IconBell } from '../Icons'
import { listPeopleITrust, getSharedCycleStatus } from '../../lib/cycleTrust'

const PRESET_MESSAGES = [
  'Hey ❤️ just checking in. Need anything?',
  'Thinking of you today 🌸',
  "Let me know if you need anything at all",
]

export default function TrustedPersonDashboard({ onOpenConversation, onClose }) {
  const [links, setLinks] = useState([])
  const [statuses, setStatuses] = useState({}) // ownerId -> status
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const rows = await listPeopleITrust()
        setLinks(rows)
        const entries = await Promise.all(rows.map(async r => {
          try { return [r.owner_id, await getSharedCycleStatus(r.owner_id)] }
          catch { return [r.owner_id, { ok: false }] }
        }))
        setStatuses(Object.fromEntries(entries))
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    })()
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: '#fff', margin: 0 }}>People you support</h2>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer' }}><IconX size={15} /></button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 18px 90px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: 30 }}>Loading…</div>}

        {!loading && links.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.5)', fontSize: 13.5 }}>
            Nobody has added you as a trusted person yet.
          </div>
        )}

        {!loading && links.map(link => {
          const status = statuses[link.owner_id]
          const name = link.owner?.username || 'Someone'
          return (
            <div key={link.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                {!status?.ok || !status?.available
                  ? `You're connected with ${name}`
                  : link.permission_level === 2
                  ? (status.approachingPeriod ? `${name}'s cycle may be approaching` : `${name} is doing okay`)
                  : `${name}'s cycle`}
              </div>

              {status?.available && link.permission_level === 3 && (
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {status.estimatedNextPeriod && <div>Estimated next period: {status.estimatedNextPeriod}</div>}
                  {status.phase && <div>Current phase: {status.phase.charAt(0).toUpperCase() + status.phase.slice(1)}</div>}
                </div>
              )}

              {(!status?.available) && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  Nothing to show right now — they may have privacy mode on, or haven't added enough data yet.
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PRESET_MESSAGES.map((msg, i) => (
                  <button
                    key={i}
                    onClick={() => onOpenConversation?.(link.owner_id, msg)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(167,139,250,0.12)',
                      border: '1px solid rgba(167,139,250,0.3)', borderRadius: 20, padding: '7px 12px',
                      color: '#c4b5fd', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <IconHeart size={11} /> {msg}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
