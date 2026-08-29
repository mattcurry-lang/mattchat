// LocationShareModal.jsx
// Section 1 — "Location" attachment option. One-shot geolocation grab
// (not live/continuous location — that's a materially bigger feature
// with its own privacy surface, not part of this pass). Preview uses
// OpenStreetMap's public embed, which needs no API key. Nothing sends
// until the user explicitly taps Send — permission grant only fills
// the preview.

import { useState, useEffect } from 'react'
import { IconX } from '../Icons'

export default function LocationShareModal({ isOpen, onClose, onConfirm }) {
  const [status, setStatus] = useState('idle') // idle | locating | ready | denied | error
  const [coords, setCoords] = useState(null)

  useEffect(() => {
    if (!isOpen) { setStatus('idle'); setCoords(null); return }
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

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Share Location</span>
          <button onClick={onClose} style={closeBtnStyle}><IconX size={16} /></button>
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

        <button
          onClick={() => coords && onConfirm(coords)}
          disabled={status !== 'ready'}
          style={{ ...sendBtnStyle, opacity: status === 'ready' ? 1 : 0.5, cursor: status === 'ready' ? 'pointer' : 'default' }}
        >
          Send Location
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
const sendBtnStyle = { background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 700, fontSize: 13.5, padding: '12px', fontFamily: 'inherit' }
