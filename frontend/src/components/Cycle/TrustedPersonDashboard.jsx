import React, { useEffect, useState } from 'react'
import { IconX, IconHeart, IconCheck } from '../Icons'
import {
  listPeopleITrust,
  getSharedCycleStatus,
  listPendingTrustedInvites,
  respondToTrustedInvite
} from '../../lib/cycleTrust'

const PRESET_MESSAGES = [
  'Hey ❤️ just checking in. Need anything?',
  'Thinking of you today 🌸',
  'Let me know if you need anything at all',
]
function StatBlock({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb', marginTop: 2 }}>{value}</div>
    </div>
  )
}
export default function TrustedPersonDashboard({ onOpenConversation, onClose }) {
  const [links, setLinks] = useState([])
  const [pending, setPending] = useState([])
  const [statuses, setStatuses] = useState({})
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(null)

  const load = async () => {
    try {
      const [rows, pendingRows] = await Promise.all([
        listPeopleITrust(),
        listPendingTrustedInvites()
      ])
      setLinks(rows || [])
      setPending(pendingRows || [])

      const entries = await Promise.all(
        (rows || []).map(async r => {
          try {
            return [r.owner_id, await getSharedCycleStatus(r.owner_id)]
          } catch {
            return [r.owner_id, { ok: false }]
          }
        })
      )
      setStatuses(Object.fromEntries(entries))
    } catch (e) {
      console.error('Error loading trusted circle data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const respond = async (linkId, accept) => {
    setResponding(linkId)
    try {
      await respondToTrustedInvite(linkId, accept)
      await load()
    } catch (e) {
      alert(e.message || 'Action failed')
    } finally {
      setResponding(null)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: '#fff', margin: 0 }}>People you support</h2>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconX size={15} />
        </button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 18px 90px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: 30 }}>Loading…</div>}

        {/* PENDING REQUESTS SECTION */}
        {!loading && pending.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Pending requests
            </div>
            {pending.map(p => {
              const ownerName = p.owner?.username || p.profiles?.username || 'Someone'
              return (
                <div key={p.id} style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {ownerName} wants to add you to their Trusted Circle
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    You'll be able to see whatever cycle info they choose to share — you can change this or leave anytime.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => respond(p.id, true)}
                      disabled={responding === p.id}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg,#6c63ff,#a78bfa)', border: 'none', borderRadius: 12, padding: '9px 12px', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: responding === p.id ? 0.6 : 1 }}
                    >
                      <IconCheck size={13} /> Accept
                    </button>
                    <button
                      onClick={() => respond(p.id, false)}
                      disabled={responding === p.id}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '9px 12px', color: 'rgba(255,255,255,0.6)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: responding === p.id ? 0.6 : 1 }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {!loading && links.length === 0 && pending.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.5)', fontSize: 13.5 }}>
            Nobody has added you as a trusted person yet.
          </div>
        )}

        {/* CONNECTED SECTION */}
        {!loading && links.length > 0 && (
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: pending.length > 0 ? 6 : 0 }}>
            Connected
          </div>
        )}

        {!loading && links.map(link => {
          const status = statuses[link.owner_id]
          const name = link.owner?.username || link.profiles?.username || 'Someone'
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
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
    <StatBlock label="Cycle day" value={`Day ${status.dayOfCycle}`} />
    <StatBlock label="Phase" value={status.phase.charAt(0).toUpperCase() + status.phase.slice(1)} />
    <StatBlock label="Estimated next period" value={status.estimatedNextPeriod} />
    <StatBlock label="Cycle length" value={`${status.cycleLength} days`} />
  </div>
)}

              {!status?.available && (
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
