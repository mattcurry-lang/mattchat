import React, { useEffect, useState } from 'react'
import { IconX, IconHeart, IconCheck } from '../Icons'
import { listPeopleITrust, getSharedCycleStatus, listPendingTrustedInvites, respondToTrustedInvite } from '../../lib/cycleTrust'
import { getPartnerRingProps } from '../../lib/partnerSupport'
import CycleRing from './CycleRing'
import PartnerSupportCard from './PartnerSupportCard'
import { sendPartnerNudge } from '../../lib/cycleTrust'
import { NUDGE_COLOR_PRESETS, loadSavedNudgeColor, saveNudgeColor, getReadableTextColor } from '../../lib/nudgeColor'

const PRESET_MESSAGES = [
  'Hey ❤️ just checking in. Need anything?',
  'Thinking of you today 🌸',
  "Let me know if you need anything at all",
]

export default function TrustedPersonDashboard({ userId, onOpenConversation, onSwitchToOwnDashboard, showOwnDashboardSwitch, onClose }) {
  const [links, setLinks] = useState([])
  const [pending, setPending] = useState([])
  const [statuses, setStatuses] = useState({})
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(null)
  const [sendingNudge, setSendingNudge] = useState(null)
  const [nudgeColors, setNudgeColors] = useState({}) 
const [customPickerFor, setCustomPickerFor] = useState(null)  


  const load = async () => {
    try {
      const [rows, pendingRows] = await Promise.all([listPeopleITrust(), listPendingTrustedInvites()])
      setLinks(rows)
      setPending(pendingRows)
      const entries = await Promise.all(rows.map(async r => {
        try { return [r.owner_id, await getSharedCycleStatus(r.owner_id)] }
        catch { return [r.owner_id, { ok: false }] }
      }))
      setStatuses(Object.fromEntries(entries))
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const respond = async (linkId, accept) => {
    setResponding(linkId)
    try {
      await respondToTrustedInvite(linkId, accept)
      await load()
    } catch (e) {
      alert(e.message)
    }
    setResponding(null)
  }
 const sendNudge = async (link, text) => {
  setSendingNudge({ linkId: link.id, text })
  try {
    const color = nudgeColors[link.id] || '#6c63ff'
    const conversationId = await sendPartnerNudge(userId, link.owner_id, text, color)
    await new Promise(r => setTimeout(r, 650))
    onOpenConversation?.(conversationId)
  } catch (e) {
    console.error('sendNudge failed:', e)
    alert("Couldn't send that — please try again.")
    setSendingNudge(null)
  }
}

  useEffect(() => {
  if (links.length === 0) return
  setNudgeColors(prev => {
    const next = { ...prev }
    links.forEach(l => { if (!next[l.id]) next[l.id] = loadSavedNudgeColor(l.id) })
    return next
  })
}, [links])

const setLinkColor = (linkId, hex) => {
  setNudgeColors(prev => ({ ...prev, [linkId]: hex }))
  saveNudgeColor(linkId, hex)
}
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: '#fff', margin: 0 }}>People you support</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {showOwnDashboardSwitch && (
            <button
              onClick={onSwitchToOwnDashboard}
              style={{
                background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 20,
                padding: '6px 14px', color: '#c4b5fd', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              My Cycle
            </button>
          )}
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer' }}><IconX size={15} /></button>
        </div>
      </div>

      <div className="partner-dash-container">
        {loading && <div className="partner-dash-span-all" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: 30 }}>Loading…</div>}

        {!loading && pending.length > 0 && (
          <div className="partner-dash-span-all" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Pending requests
            </div>
            {pending.map(p => (
              <div key={p.id} style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  {p.owner?.username || 'Someone'} wants to add you to their Trusted Circle
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
            ))}
          </div>
        )}

        {!loading && links.length === 0 && pending.length === 0 && (
          <div className="partner-dash-span-all" style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.5)', fontSize: 13.5 }}>
            Nobody has added you as a trusted person yet.
          </div>
        )}

        {!loading && links.map(link => {
          const status = statuses[link.owner_id]
          const name = link.owner?.username || 'Someone'
          const ringProps = getPartnerRingProps(status)

          return (
            <div key={link.id} className="partner-dash-span-all" style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '18px 20px',
            }}>
              <div className="partner-dash-connection">
                {/* LEFT — ring + status headline */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', alignSelf: 'flex-start' }}>
                    {!status?.ok || !status?.available
                      ? `You're connected with ${name}`
                      : `${name}'s cycle`}
                  </div>

                  {ringProps ? (
                    <CycleRing
                      progressFraction={ringProps.progressFraction}
                      dayLabel={ringProps.dayLabel}
                      subLabel={ringProps.subLabel}
                    />
                  ) : status?.available && link.permission_level === 2 ? (
                    <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: status.approachingPeriod ? '#c4b5fd' : '#fff', marginBottom: 6 }}>
                        {status.approachingPeriod ? `${name}'s period may be approaching` : `${name} is doing okay`}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '20px 16px' }}>
                      Nothing to show right now — they may have privacy mode on, or haven't added enough data yet.
                    </div>
                  )}
                </div>

                {/* RIGHT — support tips, gift ideas, message buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {status?.available && (
                    <PartnerSupportCard
                      phase={link.permission_level === 3 ? status.phase : null}
                      approachingPeriod={link.permission_level === 2 ? status.approachingPeriod : null}
                    />
                  )}
                                    {/* Color picker for the nudge bubble */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Bubble color — pick what she'd love
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      {NUDGE_COLOR_PRESETS.map(preset => {
                        const isActive = (nudgeColors[link.id] || '#6c63ff') === preset.hex
                        return (
                          <button
                            key={preset.id}
                            onClick={() => setLinkColor(link.id, preset.hex)}
                            title={preset.label}
                            style={{
                              width: 28, height: 28, borderRadius: '50%', background: preset.hex,
                              border: isActive ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.15)',
                              cursor: 'pointer', boxShadow: isActive ? `0 0 10px ${preset.hex}` : 'none',
                              transition: 'all 0.15s ease',
                            }}
                          />
                        )
                      })}
                      <button
                        onClick={() => setCustomPickerFor(customPickerFor === link.id ? null : link.id)}
                        title="Custom color"
                        style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                          border: '2px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                        }}
                      />
                      {customPickerFor === link.id && (
                        <input
                          type="color"
                          value={nudgeColors[link.id] || '#6c63ff'}
                          onChange={(e) => setLinkColor(link.id, e.target.value)}
                          style={{ width: 32, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                        />
                      )}
                    </div>
                  </div>
                                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PRESET_MESSAGES.map((msg, i) => {
                      const isSendingThis = sendingNudge?.linkId === link.id && sendingNudge?.text === msg
                      const color = nudgeColors[link.id] || '#6c63ff'
                      return (
                        <button
                          key={i}
                          onClick={() => sendNudge(link, msg)}
                          disabled={!!sendingNudge}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: isSendingThis ? color : 'rgba(167,139,250,0.12)',
                            border: `1px solid ${isSendingThis ? color : 'rgba(167,139,250,0.3)'}`,
                            borderRadius: 20, padding: '7px 12px',
                            color: isSendingThis ? getReadableTextColor(color) : '#c4b5fd',
                            fontSize: 12, fontWeight: 600,
                            cursor: sendingNudge ? 'default' : 'pointer', fontFamily: 'inherit',
                            opacity: sendingNudge && !isSendingThis ? 0.4 : 1,
                            boxShadow: isSendingThis ? `0 0 16px ${color}99` : 'none',
                            transition: 'all 0.25s ease',
                          }}
                        >
                          <IconHeart size={11} /> {isSendingThis ? 'Sent ✨' : msg}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        .partner-dash-container {
          max-width: 480px;
          margin: 0 auto;
          padding: 0 18px 90px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .partner-dash-connection {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        @media (min-width: 1024px) {
          .partner-dash-container {
            max-width: 1180px;
            padding: 0 40px 90px;
          }
          .partner-dash-connection {
            flex-direction: row;
            align-items: flex-start;
            gap: 28px;
          }
          .partner-dash-connection > div:first-child { flex: 0 0 320px; }
          .partner-dash-connection > div:last-child { flex: 1; }
        }
      `}</style>
    </div>
  )
}
