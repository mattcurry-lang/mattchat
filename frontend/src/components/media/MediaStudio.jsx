// MediaStudio.jsx
// Entry point bottom sheet (mobile) / panel (desktop) that replaces the
// basic attachment button. Opens MediaPicker/CameraCapture/FilePicker etc.
// depending on what the user taps. Does not itself upload anything.
//
// THEME NOTE: this sheet's surface (sheetStyle) is intentionally
// always dark regardless of app theme, so text colors are hardcoded
// constants, not theme vars — same fix pattern as the DeKUT fullscreen
// overlay sweep. Only non-text surfaces (backdrop, borders, badges)
// still use var(--x, fallback).
//
// Row-list layout (icon + label per row) instead of the old icon grid.
// Screenshot option added — ScreenshotCapture already exists and was
// already wired up in MediaAttachmentFlow.jsx (activePicker === 'screenshot'),
// it just had no entry point in this menu until now.

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  IconCamera, IconImagePlus, IconFilm, IconFolder, IconMusic,
  IconPin, IconUser, IconSparkle, IconMaximize,
} from '../Icons'

const OPTIONS = [
  { id: 'camera', label: 'Camera', Icon: IconCamera },
  { id: 'photos', label: 'Photos', Icon: IconImagePlus },
  { id: 'videos', label: 'Videos', Icon: IconFilm },
  { id: 'documents', label: 'Documents', Icon: IconFolder },
  { id: 'audio', label: 'Audio', Icon: IconMusic },
  { id: 'screenshot', label: 'Screenshot', Icon: IconMaximize },
  { id: 'location', label: 'Location', Icon: IconPin },
  { id: 'contact', label: 'Contact', Icon: IconUser },
  { id: 'moment', label: 'Create Moment', Icon: IconSparkle },
]

export default function MediaStudio({ isOpen, onClose, onSelectOption }) {
  const sheetRef = useRef(null)

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

            <div style={listStyle}>
              {OPTIONS.map(({ id, label, Icon }) => (
                <motion.button
                  key={id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { onSelectOption(id); onClose() }}
                  style={rowStyle}
                >
                  <span style={iconBadgeStyle}>
                    <Icon size={19} style={{ color: 'var(--accent, #a78bfa)' }} />
                  </span>
                  <span style={rowLabelStyle}>{label}</span>
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

// ---- styles: CSS variables with dual-theme-safe fallbacks ----

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
  margin: '4px 0 10px',
  textAlign: 'center',
  fontSize: 16,
  fontWeight: 700,
  // Hardcoded, not theme-driven: this sheet's surface is always dark
  // (see sheetStyle), so trusting --text-primary risks light-mode's
  // dark text landing on a dark background. Same fix as the DeKUT
  // fullscreen overlay sweep — contrast-safe constant instead of a var.
  color: '#f4f2f8',
}

const listStyle = {
  display: 'flex',
  flexDirection: 'column',
  padding: '4px 8px',
}

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  width: '100%',
  padding: '11px 12px',
  borderRadius: 14,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
}

const iconBadgeStyle = {
  flexShrink: 0,
  width: 38, height: 38,
  borderRadius: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--surface-card, rgba(148,120,255,0.12))',
  border: '1px solid var(--border-subtle, rgba(148,120,255,0.18))',
}

const rowLabelStyle = {
  fontSize: 14.5,
  fontWeight: 600,
  // Hardcoded — same reasoning as titleStyle above.
  color: '#f4f2f8',
}

const cancelStyle = {
  display: 'block',
  width: 'calc(100% - 40px)',
  margin: '14px 20px 0',
  padding: '12px 0',
  borderRadius: 14,
  border: 'none',
  background: 'var(--surface-card, rgba(148,120,255,0.10))',
  // Hardcoded, dimmer than the row labels for secondary-text feel,
  // but still safely legible against the dark sheet surface.
  color: '#c9c5d6',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
}
