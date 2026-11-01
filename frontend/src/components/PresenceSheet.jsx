import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../hooks/useIsMobile'

// Shared shell + palette for the note composer and the reply sheet. Self-contained dark glass,
// so it looks right whatever the app theme is (same approach as the share sheet).
export const C = {
  bg: '#15121f', surface: 'rgba(255,255,255,0.06)', surface2: 'rgba(255,255,255,0.11)', line: 'rgba(255,255,255,0.12)',
  text: '#f6f4ff', muted: 'rgba(246,244,255,0.62)', accent: '#a78bfa', accent2: '#6c63ff', ok: '#4ade80', bad: '#f87171',
}

export const chipStyle = (on) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 12.5, fontWeight: 700, color: on ? '#fff' : C.text, whiteSpace: 'nowrap',
  background: on ? `linear-gradient(135deg, ${C.accent}, ${C.accent2})` : C.surface, border: `1px solid ${on ? 'transparent' : C.line}`,
})

export const sectionLabel = { fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: C.muted, margin: '16px 2px 8px' }

export default function PresenceSheet({ label, onClose, children }) {
  const isMobile = useIsMobile()
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(5,4,12,0.62)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={label}
        style={{
          width: '100%', maxWidth: isMobile ? 560 : 440, maxHeight: isMobile ? '92vh' : '86vh', overflowY: 'auto', background: C.bg, color: C.text,
          border: `1px solid ${C.line}`, borderBottom: isMobile ? 'none' : `1px solid ${C.line}`, borderRadius: isMobile ? '24px 24px 0 0' : 24,
          boxShadow: '0 30px 80px rgba(0,0,0,0.55)', padding: '18px 18px calc(18px + env(safe-area-inset-bottom, 0px))', fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {isMobile && <div style={{ width: 38, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.28)', margin: '-6px auto 12px' }} />}
        {children}
      </div>
    </div>,
    document.body,
  )
}
