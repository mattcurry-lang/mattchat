// src/components/QuickActionsMenu.jsx
//
// The "Quick actions" dropdown (new chat / Curry AI / Ask Curry (DeKUT) / Insights).
//
// Where it shows:
//   mode="full"  the full pill, always there. Use on the Home chat list, where it belongs.
//   mode="peek"  on other pages (Calls, Pulse, Status…) it doesn't cover your content. Only a slim edge
//                handle stays. Pull the pill out with ANY of these shortcuts:
//                  • tap (or drag left) the edge handle
//                  • swipe left from the right edge of the screen (phones)
//                  • press Q (desktop, when you're not typing)
//                It tucks itself away again after 6s of not touching it.
//   mode="none"  hidden completely (use over full-screen features).
//
// `hidden` is still accepted: hidden === mode="none".
import React, { useEffect, useRef, useState } from 'react'
import { IconSparkle, IconMessageSquare, IconChevronDown, IconChevronLeft, IconChart } from './Icons'

const VIOLET = '#6C63FF'
const VIOLET_LIGHT = '#A78BFA'
const AUTO_HIDE_MS = 6000
const EDGE_PX = 28          // how close to the right edge a swipe must start
const SWIPE_PX = 36         // how far left it must travel

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

export default function QuickActionsMenu({ hidden, mode: modeProp, onNewChat, onOpenCurryAI, onOpenDekutCurry, dekutBadge, onOpenInsights, insightsBadge }) {
  const mode = hidden ? 'none' : (modeProp || 'full')
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState(false)     // peek mode: the pill has been pulled out
  const [activity, setActivity] = useState(0)         // bumps on any touch of the pill, restarting the auto-hide timer
  const wrapRef = useRef(null)
  const drag = useRef(null)

  // moving between pages / modes always starts fresh
  useEffect(() => { setOpen(false); setRevealed(false) }, [mode])

  const reveal = () => {
    try { navigator.vibrate?.(15) } catch { /* not supported */ }
    setRevealed(true)
  }

  // click outside: close the menu, and tuck the pill away if it was pulled out
  useEffect(() => {
    if (!open && !revealed) return undefined
    const handler = (e) => {
      if (wrapRef.current?.contains(e.target)) return
      setOpen(false)
      setRevealed(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [open, revealed])

  // peek mode: tuck the pill away after a few idle seconds (never while the menu is open)
  useEffect(() => {
    if (mode !== 'peek' || !revealed || open) return undefined
    const id = setTimeout(() => setRevealed(false), AUTO_HIDE_MS)
    return () => clearTimeout(id)
  }, [mode, revealed, open, activity])

  // shortcut: Q (desktop). Full mode toggles the menu; peek mode pulls the pill out AND opens it.
  useEffect(() => {
    if (mode === 'none') return undefined
    const onKey = (e) => {
      if (e.key.toLowerCase() !== 'q' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat) return
      const t = e.target
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return   // you're typing
      if (document.querySelector('[aria-modal="true"]')) return                                // a dialog is open
      e.preventDefault()
      if (mode === 'peek') { setRevealed(true); setOpen(true) } else setOpen((o) => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  // shortcut: swipe left from the right screen edge (phones)
  useEffect(() => {
    if (mode !== 'peek' || revealed) return undefined
    let startX = null
    const onStart = (e) => {
      const x = e.touches[0]?.clientX
      startX = e.touches.length === 1 && x >= window.innerWidth - EDGE_PX ? x : null
    }
    const onMove = (e) => {
      if (startX == null) return
      if (startX - e.touches[0].clientX > SWIPE_PX) { startX = null; reveal() }
    }
    const onEnd = () => { startX = null }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [mode, revealed])

  if (mode === 'none') return null

  const pick = (fn) => { setOpen(false); if (mode === 'peek') setRevealed(false); fn?.() }

  // ── peek mode, collapsed: only a slim handle on the right edge ──────────────
  if (mode === 'peek' && !revealed) {
    return (
      <button
        data-qam-handle
        aria-label="Show quick actions (or press Q)"
        title="Quick actions (Q)"
        onClick={reveal}
        onPointerDown={(e) => { drag.current = e.clientX }}
        onPointerMove={(e) => { if (drag.current != null && drag.current - e.clientX > 18) { drag.current = null; reveal() } }}
        onPointerUp={() => { drag.current = null }}
        className="qam-handle"
        style={{
          position: 'fixed', right: 0, bottom: 100, zIndex: 500, width: 16, height: 56, padding: 0,
          borderRadius: '14px 0 0 14px', border: '1px solid rgba(245,245,250,0.14)', borderRight: 'none',
          background: 'rgba(20,20,31,0.5)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          color: '#f5f5fa', cursor: 'pointer', display: 'grid', placeItems: 'center', opacity: 0.5, touchAction: 'none',
          transition: 'opacity 160ms ease, width 160ms ease',
        }}
      >
        <IconChevronLeft size={12} />
        <style>{`.qam-handle:hover, .qam-handle:focus-visible { opacity: 1 !important; width: 24px !important; }`}</style>
      </button>
    )
  }

  // ── full pill (always in full mode; pulled out in peek mode) ────────────────
  return (
    <div
      ref={wrapRef}
      onPointerMove={() => setActivity((a) => a + 1)}
      onFocus={() => setActivity((a) => a + 1)}
      style={{ position: 'fixed', right: 20, bottom: 88, zIndex: 500, animation: mode === 'peek' ? 'qamSlide 200ms cubic-bezier(0.16,1,0.3,1)' : undefined }}
    >
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
          <MenuItem icon={<IconChart size={15} />} label="Insights" badge={insightsBadge} onClick={() => pick(onOpenInsights)} />
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Quick actions menu"
        aria-expanded={open}
        title="Quick actions (Q)"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 42, padding: '0 14px 0 12px', borderRadius: 21,
          border: `1px solid ${open ? 'rgba(167,139,250,0.55)' : 'rgba(245,245,250,0.14)'}`,
          cursor: 'pointer', fontFamily: 'inherit',
          background: 'rgba(20,20,31,0.85)', backdropFilter: 'blur(14px) saturate(140%)',
          WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          boxShadow: open ? '0 8px 24px -6px rgba(108,99,255,0.45)' : '0 6px 18px -8px rgba(0,0,0,0.5)',
          transition: 'border-color 160ms ease, box-shadow 160ms ease',
        }}
      >
        <span style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconSparkle size={13} style={{ color: '#fff' }} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f5f5fa' }}>Quick actions</span>
        <IconChevronDown
          size={15}
          style={{ color: '#f5f5fa', opacity: 0.6, transition: 'transform 160ms ease', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      <style>{`
        @keyframes qamIn { from { opacity: 0; transform: translateY(6px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes qamSlide { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: none; } }
        .qam-item:hover { background: rgba(245,245,250,0.08); }
        @media (prefers-reduced-motion: reduce) { [style*="qamSlide"] { animation: none !important; } }
      `}</style>
    </div>
  )
}
