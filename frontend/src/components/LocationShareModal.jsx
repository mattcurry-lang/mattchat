// REPLACES src/components/media/LocationShareModal.jsx
//
// Same one-shot behaviour as before ("Send Location" still sends a single
// snapshot and nothing else). New: in 1:1 chats you can ALSO choose to share
// live for a set time. Nothing is shared until the person taps the button.
// onConfirm(coords, { liveMinutes })  — liveMinutes is null for a snapshot.

import { useState, useEffect } from 'react'
import { IconX } from '../Icons'

const LIVE_OPTIONS = [
  { minutes: null, label: 'Just this once' },
  { minutes: 15, label: '15 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 480, label: '8 hours' },
]

export default function LocationShareModal({ isOpen, onClose, onConfirm, allowLive = false }) {
  const [status, setStatus] = useState('idle') // idle | locating | ready | denied | error
  const [coords, setCoords] = useState(null)
  const [liveMinutes, setLiveMinutes] = useState(null)

  useEffect(() => {
    if (!isOpen) { setStatus('idle'); setCoords(null); setLiveMinutes(null); return }
    if (!navigator.geolocation) { setStatus('error'); return }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setStatus('ready')
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [isOpen])

  if (!isOpen) return null

  const mapSrc = coords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.01}%2C${coords.lat - 0.008}%2C${coords.lng + 0.01}%2C${coords.lat + 0.008}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`
    : null

  const liveLabel = LIVE_OPTIONS.find((o) => o.minutes === liveMinutes)?.label
  const buttonText = liveMinutes ? `Send and share live for ${liveLabel}` : 'Send Location'

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Share Location</span>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close"><IconX size={16} /></button>
        </div>

        <div style={previewWrapStyle}>
          {status === 'locating' && <div style={centerMsgStyle}>Finding your location…</div>}
          {status === 'denied' && <div style={centerMsgStyle}>Location access was denied — enable it in your browser settings to share your location.</div>}
          {status === 'error' && <div style={centerMsgStyle}>Couldn't get your location. Try again.</div>}
          {status === 'ready' && mapSrc && (
            <iframe title="Location preview" src={mapSrc} style={{ width: '100%', height: 220, border: 'none' }} />
          )}
        </div>

        {status === 'ready' && coords && (
          <div style={coordsRowStyle}>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</div>
        )}

        {allowLive && status === 'ready' && (
          <div>
            <div role="radiogroup" aria-label="How long to share" style={chipsStyle}>
              {LIVE_OPTIONS.map((o) => {
                const on = o.minutes === liveMinutes
                return (
                  <button
                    key={String(o.minutes)} role="radio" aria-checked={on}
                    onClick={() => setLiveMinutes(o.minutes)}
                    style={{ ...chipStyle, ...(on ? chipOnStyle : null) }}
                  >{o.label}</button>
                )
              })}
            </div>
            {liveMinutes ? (
              <div style={hintStyle}>They will see where you are while Mattchat is open on your phone. It ends by itself, and you can stop any time.</div>
            ) : null}
          </div>
        )}

        <button
          onClick={() => coords && onConfirm(coords, { liveMinutes })}
          disabled={status !== 'ready'}
          style={{ ...sendBtnStyle, opacity: status === 'ready' ? 1 : 0.5, cursor: status === 'ready' ? 'pointer' : 'default' }}
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
const sheetStyle = { width: '100%', maxWidth: 420, background: 'var(--bg-surface-1, #14141f)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }
const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const closeBtnStyle = { background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const previewWrapStyle = { borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const centerMsgStyle = { fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }
const coordsRowStyle = { fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }
const chipsStyle = { display: 'flex', flexWrap: 'wrap', gap: 8 }
const chipStyle = { minHeight: 38, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(255,255,255,0.04)', color: '#f2f0f8', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const chipOnStyle = { background: 'rgba(108,99,255,0.35)', borderColor: '#a78bfa' }
const hintStyle = { marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-muted)' }
const sendBtnStyle = { background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 700, fontSize: 13.5, padding: '12px', fontFamily: 'inherit' }
