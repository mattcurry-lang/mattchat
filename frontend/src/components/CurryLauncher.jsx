// Single floating entry point for both Curry assistants, replacing
// FloatingCurryOrb. Tapping the orb reveals a drop-up menu:
//   - Curry AI     → personal assistant (voice + chat companion)
//   - DeKUT Curry  → campus assistant (AskCurry)
// One FAB instead of two/three removes the corner clutter and gives
// both assistants equal, discoverable billing.

import { useState, useRef, useEffect } from 'react'
import { IconSparkle } from './Icons'
import CurryOrbGraphic from './Pulse/CurryOrbGraphic'

export default function CurryLauncher({ onOpenCurryAI, onOpenDekutCurry, hidden }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => { if (hidden) setOpen(false) }, [hidden])

  if (hidden) return null

  const items = [
    {
      id: 'curry-ai', label: 'Curry AI', sublabel: 'Your personal assistant',
      onClick: () => { setOpen(false); onOpenCurryAI?.() },
      icon: <IconSparkle size={16} style={{ color: '#fff' }} />,
      bg: 'linear-gradient(135deg,#667eea,#764ba2)',
    },
    {
      id: 'dekut-curry', label: 'DeKUT Curry', sublabel: 'Your campus assistant',
      onClick: () => { setOpen(false); onOpenDekutCurry?.() },
      icon: <CurryOrbGraphic size={22} state="idle" animate={false} />,
      bg: 'rgba(167,139,250,0.12)',
    },
  ]

  return (
    <div ref={rootRef} style={{ position: 'fixed', right: 20, bottom: 156, zIndex: 60 }}>
      <div style={{
        position: 'absolute', bottom: 68, right: 0,
        display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
        pointerEvents: open ? 'auto' : 'none',
      }}>
        {items.map((item, i) => (
          <button key={item.id} onClick={item.onClick} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(20,20,31,0.96)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 999, padding: '8px 14px 8px 8px', cursor: 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            opacity: open ? 1 : 0,
            transform: open ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.9)',
            transition: `opacity 160ms ease ${i * 40}ms, transform 160ms ease ${i * 40}ms`,
          }}>
            <span style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{item.icon}</span>
            <span style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f0f0f0' }}>{item.label}</div>
              <div style={{ fontSize: 10.5, color: '#9ca3af' }}>{item.sublabel}</div>
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setOpen(v => !v)}
        title="Talk to Curry"
        style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
          backgroundSize: '200% 200%',
          boxShadow: '0 4px 20px rgba(102,126,234,0.5), 0 0 40px rgba(118,75,162,0.3)',
          transform: open ? 'scale(0.92) rotate(45deg)' : 'scale(1) rotate(0deg)',
          transition: 'transform 0.2s ease',
          animation: open ? 'none' : 'orbFloatPulse 3s ease-in-out infinite',
        }}
      >
        <span style={{ display: 'flex', color: '#fff', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }}>
          <IconSparkle size={22} />
        </span>
        {!open && <><div style={ring1} /><div style={ring2} /></>}
      </button>
    </div>
  )
}

const ring1 = { position: 'absolute', inset: -6, borderRadius: '50%', border: '1.5px solid rgba(167,139,250,0.4)', animation: 'orbRingExpand 2.5s ease-out infinite', pointerEvents: 'none' }
const ring2 = { position: 'absolute', inset: -6, borderRadius: '50%', border: '1.5px solid rgba(240,147,251,0.3)', animation: 'orbRingExpand 2.5s ease-out 1.2s infinite', pointerEvents: 'none' }

if (typeof document !== 'undefined' && !document.getElementById('curry-launcher-styles')) {
  const el = document.createElement('style')
  el.id = 'curry-launcher-styles'
  el.textContent = `
    @keyframes orbFloatPulse { 0%,100% { background-position:0% 50%; } 50% { background-position:100% 50%; } }
    @keyframes orbRingExpand { 0% { transform:scale(1); opacity:0.8; } 100% { transform:scale(1.6); opacity:0; } }
  `
  document.head.appendChild(el)
}
