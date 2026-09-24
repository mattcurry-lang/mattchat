// src/components/QuickActionsMenu.jsx
//
// One floating action button that expands into a small menu —
// replaces the separate floating CurryLauncher orb(s) + the
// chat-list "new chat" affordance with a single consolidated control.
import React, { useEffect, useRef, useState } from 'react'
import { IconPlus, IconSparkle, IconMessageSquare } from './Icons'

const VIOLET = '#6C63FF'
const VIOLET_LIGHT = '#A78BFA'

function MenuItem({ icon, label, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="qam-item"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#f5f5fa',
        textAlign: 'left', borderRadius: 10,
      }}
    >
      <span style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(167,139,250,0.16)', color: VIOLET_LIGHT,
      }}>{icon}</span>
      {label}
      {badge && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fb7185', marginLeft: 'auto' }} />}
    </button>
  )
}

export default function QuickActionsMenu({ hidden, onNewChat, onOpenCurryAI, onOpenDekutCurry, dekutBadge }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (hidden) return null
  const pick = (fn) => { setOpen(false); fn?.() }

  return (
    <div ref={wrapRef} style={{ position: 'fixed', right: 20, bottom: 88, zIndex: 500 }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 10px)', right: 0, minWidth: 220,
          background: 'rgba(20,20,31,0.92)', backdropFilter: 'blur(16px) saturate(140%)',
          WebkitBackdropFilter: 'blur(16px) saturate(140%)',
          border: '1px solid rgba(245,245,250,0.14)', borderRadius: 16, padding: 6,
          boxShadow: '0 16px 40px -10px rgba(0,0,0,0.6)',
          animation: 'qamIn 140ms cubic-bezier(0.16,1,0.3,1)',
        }}>
          <MenuItem icon={<IconMessageSquare size={15} />} label="New chat" onClick={() => pick(onNewChat)} />
          <MenuItem icon={<IconSparkle size={15} />} label="Curry AI" onClick={() => pick(onOpenCurryAI)} />
          <MenuItem icon={<span style={{ fontSize: 14 }}>🎓</span>} label="Ask Curry (DeKUT)" badge={dekutBadge} onClick={() => pick(onOpenDekutCurry)} />
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Quick actions"
        aria-expanded={open}
        style={{
          width: 54, height: 54, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px -6px rgba(108,99,255,0.55)',
          color: '#fff', transition: 'transform 160ms ease',
          transform: open ? 'rotate(45deg)' : 'none',
        }}
      >
        <IconPlus size={22} />
      </button>
      <style>{`
        @keyframes qamIn { from { opacity: 0; transform: translateY(6px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .qam-item:hover { background: rgba(245,245,250,0.08); }
      `}</style>
    </div>
  )
}
