import React, { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { buildPresets, formatWhen, ensureScheduleStyles } from '../lib/scheduleTime'

ensureScheduleStyles()

// Which element counts as "the send button". The legacy composer uses .send-btn;
// add data-send-btn to the send button in any other composer (e.g. the Afterglow Capsule).
const SEND_SELECTOR = '.send-btn, [data-send-btn], button[aria-label="Send"], button[title="Send"]'
const HOLD_MS = 500
const MOVE_TOLERANCE = 10

// Spread the returned props on a wrapper around the composer. Holding the
// send button (or right-clicking it) calls onOpen(buttonRect). The click that
// ends a long-press is swallowed so it doesn't also send the message.
export function useSendLongPress(onOpen) {
  const timer = useRef(null)
  const fired = useRef(false)
  const origin = useRef(null)
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  const cancel = () => { clearTimeout(timer.current); timer.current = null }
  const findSend = (target) => target?.closest?.(SEND_SELECTOR)

  return {
    onPointerDown: (e) => {
      const btn = findSend(e.target)
      if (!btn || (e.pointerType === 'mouse' && e.button !== 0)) return
      fired.current = false
      origin.current = { x: e.clientX, y: e.clientY }
      cancel()
      timer.current = setTimeout(() => {
        timer.current = null
        fired.current = true
        onOpenRef.current?.(btn.getBoundingClientRect())
      }, HOLD_MS)
    },
    onPointerMove: (e) => {
      if (!timer.current || !origin.current) return
      if (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > MOVE_TOLERANCE) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture: (e) => {
      if (fired.current && findSend(e.target)) { e.preventDefault(); e.stopPropagation() }
      fired.current = false
    },
    onContextMenu: (e) => {
      const btn = findSend(e.target)
      if (!btn) return
      e.preventDefault()
      cancel()
      onOpenRef.current?.(btn.getBoundingClientRect())
    },
  }
}

export default function SendLaterMenu({ anchorRect, onPick, onCustom, onClose }) {
  const presets = useMemo(() => buildPresets(new Date()), [])
  const menuRef = useRef(null)

  // Focus the first option so Enter schedules it right away.
  useEffect(() => { menuRef.current?.querySelector('button')?.focus() }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const MENU_W = 260
  const left = Math.max(8, Math.min(anchorRect.right - MENU_W, window.innerWidth - MENU_W - 8))
  const bottom = Math.max(8, window.innerHeight - anchorRect.top + 8)

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...menuRef.current.querySelectorAll('button')]
    const i = items.indexOf(document.activeElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  return createPortal(
    <>
      <div className="slm-scrim" onClick={onClose} />
      <div ref={menuRef} className="slm-menu" role="menu" aria-label="Send later" style={{ left, bottom }} onKeyDown={onKeyDown}>
        <div className="slm-head">Send later</div>
        {presets.map((p) => (
          <button key={p.id} className="slm-item" role="menuitem" onClick={() => onPick(p.date)}>
            <span className="slm-label">{p.label}</span>
            <span className="slm-time">{formatWhen(p.date)}</span>
          </button>
        ))}
        <div className="slm-sep" />
        <button className="slm-item" role="menuitem" onClick={onCustom}>
          <span className="slm-label">Pick date &amp; time…</span>
        </button>
      </div>
    </>,
    document.body
  )
}

export function ScheduleToast({ text }) {
  return <div className="slm-toast" role="status">✓ {text}</div>
}

const SLM_CSS = `
  .send-btn, [data-send-btn] { -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; }
  .slm-scrim { position:fixed; inset:0; z-index:3100; }
  .slm-menu { position:fixed; z-index:3101; width:260px; padding:6px; box-sizing:border-box; border-radius:16px;
    background:var(--bg-surface-1,#14141f); color:var(--text-primary,#f2f0f8);
    border:1px solid var(--border,rgba(167,139,250,.18)); box-shadow:0 18px 48px rgba(0,0,0,.4);
    animation:slmPop .16s ease; }
  @keyframes slmPop { from { opacity:0; transform:translateY(6px) scale(.98); } to { opacity:1; transform:none; } }
  .slm-head { padding:8px 10px 6px; font-size:10.5px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--text-muted,#9d97b5); }
  .slm-item { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:10px; border:none; border-radius:10px;
    background:none; color:inherit; font:inherit; text-align:left; cursor:pointer; }
  .slm-item:hover, .slm-item:focus-visible { background:rgba(167,139,250,.14); outline:none; }
  .slm-label { font-size:13.5px; font-weight:700; }
  .slm-time { font-size:11.5px; color:var(--text-muted,#9d97b5); white-space:nowrap; }
  .slm-sep { height:1px; margin:5px 4px; background:var(--border,rgba(255,255,255,.08)); }
  .slm-toast { position:fixed; left:50%; bottom:96px; transform:translateX(-50%); z-index:3500; max-width:calc(100vw - 32px);
    padding:10px 16px; border-radius:14px; font-size:13px; font-weight:600; color:#fff; background:#2a2840;
    border:1px solid rgba(167,139,250,.3); box-shadow:0 10px 28px rgba(0,0,0,.4); animation:slmToast .22s ease; }
  @keyframes slmToast { from { opacity:0; transform:translate(-50%,8px); } to { opacity:1; transform:translate(-50%,0); } }
  @media (prefers-reduced-motion: reduce) { .slm-menu, .slm-toast { animation:none; } }
`
if (typeof document !== 'undefined' && !document.getElementById('send-later-styles')) {
  const el = document.createElement('style')
  el.id = 'send-later-styles'
  el.textContent = SLM_CSS
  document.head.appendChild(el)
}
