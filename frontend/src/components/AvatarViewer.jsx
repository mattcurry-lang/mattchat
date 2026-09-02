// AvatarViewer.jsx
// Full-screen profile-photo viewer — the "tap an avatar to see it big"
// pattern from WhatsApp/Telegram/Instagram. Reusable anywhere an avatar
// is shown: your own profile menu, a contact's profile card, a group
// member list, etc. Doesn't know or care whose photo it is — just takes
// a URL and a name/subtitle to label it with.
//
// Falls back to a plain initials circle (matching Avatar.jsx's own
// fallback convention) when photoUrl is missing, rather than rendering
// a broken image or nothing at all.

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconX } from './Icons'

const IconDownload = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 3v13m0 0l-5-5m5 5l5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 20h16" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
)

function initialsFrom(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase()
}

export default function AvatarViewer({ isOpen, onClose, photoUrl, name, subtitle }) {
  // Escape to close — matches the rest of the app's overlay convention.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={overlayStyle}
          role="dialog" aria-label={`${name || 'Profile'} photo`}
        >
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close">
            <IconX size={18} />
          </button>

          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={stageStyle}
          >
            {photoUrl ? (
              <img src={photoUrl} alt={name || 'Profile photo'} style={imgStyle} />
            ) : (
              <div style={fallbackCircleStyle}>{initialsFrom(name)}</div>
            )}
          </motion.div>

          <div style={captionStyle} onClick={(e) => e.stopPropagation()}>
            {name && <div style={nameStyle}>{name}</div>}
            {subtitle && <div style={subtitleStyle}>{subtitle}</div>}
            {photoUrl && (
              <a href={photoUrl} download style={downloadBtnStyle}>
                <IconDownload size={14} /> Save photo
              </a>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---- styles ----
// Always-dark full-screen viewer regardless of app theme (same reasoning
// as the media overlays: a fixed black stage, not part of the themed
// chrome), so colors are hardcoded rather than theme vars.

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 700,
  background: 'rgba(0,0,0,0.92)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: '24px 20px',
}

const closeBtnStyle = {
  position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', right: 16,
  width: 36, height: 36, borderRadius: '50%',
  background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}

const stageStyle = {
  width: 'min(320px, 82vw)', height: 'min(320px, 82vw)',
  borderRadius: '50%', overflow: 'hidden',
  boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.6)',
  flexShrink: 0,
}

const imgStyle = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }

const fallbackCircleStyle = {
  width: '100%', height: '100%',
  background: 'linear-gradient(135deg, #7F5FFF 0%, #C86DD7 100%)',
  color: '#fff', fontSize: 72, fontWeight: 800,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const captionStyle = { marginTop: 22, textAlign: 'center' }
const nameStyle = { fontSize: 17, fontWeight: 700, color: '#fff' }
const subtitleStyle = { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 }

const downloadBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  marginTop: 14, padding: '8px 16px', borderRadius: 999,
  background: 'rgba(255,255,255,0.1)', color: '#fff',
  fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
}
