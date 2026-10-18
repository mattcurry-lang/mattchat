import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { parseZoomLink } from '../lib/zoom'

const C = {
  bg: '#15121f', surface: 'rgba(255,255,255,0.06)', line: 'rgba(255,255,255,0.12)', text: '#f6f4ff',
  muted: 'rgba(246,244,255,0.62)', zoom: '#2d8cff', zoom2: '#0b5cff', ok: '#4ade80', bad: '#f87171',
}

/** Small Zoom camera badge used on buttons and screens. */
export function ZoomGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="6" fill={C.zoom} />
      <path fill="#fff" d="M5.5 8.6c0-.6.5-1.1 1.1-1.1h6.3c.6 0 1.1.5 1.1 1.1v4.2c0 .6-.5 1.1-1.1 1.1H6.6c-.6 0-1.1-.5-1.1-1.1V8.6zm9.2 1.2 3.1-1.9c.3-.2.7 0 .7.4v6.3c0 .4-.4.6-.7.4l-3.1-1.9V9.8z" transform="translate(0 1.5)" />
    </svg>
  )
}

export default function ZoomLinkSheet({ initialLink = '', contactName, onSave, onSaveAndCall, onClose }) {
  const [value, setValue] = useState(initialLink)
  const inputRef = useRef(null)
  const clean = parseZoomLink(value)
  const touched = value.trim().length > 0
  const invalid = touched && !clean

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const btn = (primary) => ({
    height: 44, padding: '0 20px', borderRadius: 999, border: primary ? 'none' : `1px solid ${C.line}`, cursor: clean ? 'pointer' : 'not-allowed',
    fontWeight: 800, fontSize: 14, fontFamily: 'inherit', color: '#fff', opacity: clean ? 1 : 0.5,
    background: primary ? `linear-gradient(135deg, ${C.zoom}, ${C.zoom2})` : 'transparent',
    boxShadow: primary && clean ? '0 10px 24px rgba(11,92,255,0.4)' : 'none',
  })

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(5,4,12,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Zoom calls"
        style={{ width: '100%', maxWidth: 440, background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 22, padding: 22, boxShadow: '0 30px 80px rgba(0,0,0,0.55)', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <ZoomGlyph size={38} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{contactName ? `Call ${contactName} on Zoom` : 'Call on Zoom'}</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>Mattchat rings them, Zoom carries the call.</div>
          </div>
        </div>

        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, margin: '14px 0 10px' }}>
          Paste your <b style={{ color: C.text }}>Zoom Personal Meeting link</b> once. In Zoom: <b style={{ color: C.text }}>Meetings → Personal Room → Copy invitation link</b>.
        </div>

        <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://zoom.us/j/1234567890"
          spellCheck={false} autoCapitalize="off" autoCorrect="off"
          onKeyDown={(e) => { if (e.key === 'Enter' && clean) (onSaveAndCall || onSave)(clean) }}
          style={{ width: '100%', boxSizing: 'border-box', background: C.surface, border: `1px solid ${invalid ? C.bad : clean ? 'rgba(74,222,128,0.5)' : C.line}`, borderRadius: 12, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
        <div style={{ minHeight: 18, marginTop: 6, fontSize: 12, fontWeight: 600, color: invalid ? C.bad : C.ok }}>
          {invalid ? 'That doesn’t look like a Zoom meeting link (zoom.us/j/… or zoom.us/my/…).' : clean ? '✓ Looks good' : ''}
        </div>

        <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, margin: '8px 0 16px', background: C.surface, borderRadius: 12, padding: '10px 12px' }}>
          Good to know: you start the meeting from your own Zoom account. Free Zoom accounts end each meeting after 40 minutes; paid accounts don’t have that limit.
          The link stays on this device.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onClose} style={{ ...btn(false), cursor: 'pointer', opacity: 1, color: C.muted }}>Cancel</button>
          {onSave && <button disabled={!clean} onClick={() => clean && onSave(clean)} style={btn(false)}>Save</button>}
          {onSaveAndCall && <button disabled={!clean} onClick={() => clean && onSaveAndCall(clean)} style={btn(true)}>Save &amp; call</button>}
        </div>
      </div>
    </div>,
    document.body
  )
}
