// MediaStudio.jsx
// Entry point bottom sheet (mobile) / panel (desktop) that replaces the
// basic attachment button. Opens MediaPicker/CameraCapture/FilePicker etc.
// depending on what the user taps. Does not itself upload anything.
//
// THEME NOTE: this uses the CSS custom properties already defined in
// Mattchat's dark/purple design system (see mattchat.md — "CSS custom
// property design system with dark/purple brand theme"). If your variable
// names differ from the ones below, do a find/replace — the fallback values
// after each `var(--x, fallback)` guarantee readable contrast in both light
// and dark mode even before that's done, so nothing renders invisible.

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const OPTIONS = [
  { id: 'camera', label: 'Camera', icon: '📷' },
  { id: 'photos', label: 'Photos', icon: '🖼️' },
  { id: 'videos', label: 'Videos', icon: '🎬' },
  { id: 'documents', label: 'Documents', icon: '📄' },
  { id: 'audio', label: 'Audio', icon: '🎵' },
  { id: 'location', label: 'Location', icon: '📍' },
  { id: 'contact', label: 'Contact', icon: '👤' },
  { id: 'moment', label: 'Create Moment', icon: '✨' },
]

export default function MediaStudio({ isOpen, onClose, onSelectOption }) {
  const sheetRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="media-studio-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(4px)',
            }}
          />
          <motion.div
            ref={sheetRef}
            className="media-studio-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            style={sheetStyle}
            role="dialog"
            aria-label="Media Studio"
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-subtle, rgba(120,120,140,0.35))', margin: '10px auto 4px' }} />
            <h3 style={titleStyle}>Share</h3>

            <div style={gridStyle}>
              {OPTIONS.map((opt) => (
                <motion.button
                  key={opt.id}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => { onSelectOption(opt.id); onClose() }}
                  style={cardStyle}
                >
                  <span style={{ fontSize: 26 }}>{opt.icon}</span>
                  <span style={cardLabelStyle}>{opt.label}</span>
                </motion.button>
              ))}
            </div>

            <button onClick={onClose} style={cancelStyle}>Cancel</button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ---- styles: CSS variables with high-contrast fallbacks for both themes ----

const sheetStyle = {
  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 61,
  maxWidth: 480, margin: '0 auto',
  background: 'var(--surface-elevated, var(--bg-secondary, #17141f))',
  borderTopLeftRadius: 24, borderTopRightRadius: 24,
  boxShadow: '0 -8px 40px rgba(0,0,0,0.35)',
  border: '1px solid var(--border-subtle, rgba(148,120,255,0.18))',
  borderBottom: 'none',
  paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
}

const titleStyle = {
  margin: '4px 0 16px',
  textAlign: 'center',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text-primary, #f2f0f8)',
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 14,
  padding: '0 20px',
}

const cardStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  padding: '14px 6px',
  borderRadius: 16,
  border: '1px solid var(--border-subtle, rgba(148,120,255,0.16))',
  background: 'var(--surface-card, rgba(148,120,255,0.08))',
  cursor: 'pointer',
}

const cardLabelStyle = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-primary, #f2f0f8)',
  textAlign: 'center',
  lineHeight: 1.2,
}

const cancelStyle = {
  display: 'block',
  width: 'calc(100% - 40px)',
  margin: '18px 20px 0',
  padding: '12px 0',
  borderRadius: 14,
  border: 'none',
  background: 'var(--surface-card, rgba(148,120,255,0.10))',
  color: 'var(--text-secondary, #c9c4dd)',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
}
