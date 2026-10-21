import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { parseZoomLink } from '../lib/zoom'
import { checkZoomServer } from '../hooks/useCall'

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

function ServerReport({ d }) {
  const rows = []
  const bad = (t) => rows.push({ ok: false, t })
  const good = (t) => rows.push({ ok: true, t })
  if (d.deployed === false) {
    bad(d.error || 'The create-zoom-room function is not deployed. Run: supabase functions deploy create-zoom-room')
  } else {
    const missing = Object.entries(d.secrets || {}).filter(([, v]) => !v).map(([k]) => k)
    if (missing.length) bad(`Missing Supabase secrets: ${missing.join(', ')}`); else good('All four Zoom secrets are set')
    if (d.table && !d.table.ok) bad(`The zoom_rooms table is missing. Run docs/zoom_rooms.sql (${d.table.error})`); else if (d.table) good('zoom_rooms table exists')
    if (d.token) {
      if (d.token.ok) good('Zoom accepted the app credentials'); else bad(`Zoom rejected the credentials: ${d.token.error}`)
      if (d.token.ok && d.canCreateMeetings === false) bad('Your Zoom app has no “meeting write” scope. Add it under Scopes and re-activate the app.')
      else if (d.token.ok) good('The app is allowed to create meetings')
    }
    if (d.error && !rows.some((r) => !r.ok)) bad(d.error)
  }
  const allGood = rows.length > 0 && rows.every((r) => r.ok)
  return (
    <div style={{ background: C.surface, borderRadius: 12, padding: '10px 12px', margin: '0 0 12px', fontSize: 12, lineHeight: 1.6 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ color: r.ok ? C.ok : C.bad, display: 'flex', gap: 6 }}><span>{r.ok ? '✓' : '✗'}</span><span style={{ color: r.ok ? C.ok : C.text }}>{r.t}</span></div>
      ))}
      {allGood && <div style={{ color: C.text, marginTop: 4 }}>Automatic rooms are ready. Close this and tap the Zoom button again.</div>}
    </div>
  )
}

/**
 * First-time setup (and "change my link") for Zoom calls.
 * onSave(link) saves; onSaveAndCall(link) saves and starts the call in the same click,
 * which keeps the browser from blocking the Zoom window.
 */
export default function ZoomLinkSheet({ initialLink = '', contactName, onSave, onSaveAndCall, onClose }) {
  const [value, setValue] = useState(initialLink)
  const inputRef = useRef(null)
  const [diag, setDiag] = useState(null)       // null | 'checking' | result
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
          One quick setup: copy your <b style={{ color: C.text }}>Zoom Personal Link</b> and paste it below. Takes about 20 seconds.
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button onClick={() => window.open('https://zoom.us/profile', '_blank', 'noopener,noreferrer')}
            style={{ flex: 1, height: 40, borderRadius: 12, border: `1px solid ${C.line}`, background: C.surface, color: C.text, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
            1 · Open my Zoom page
          </button>
          <button onClick={async () => { try { setValue(await navigator.clipboard.readText()) } catch { inputRef.current?.focus() } }}
            style={{ flex: 1, height: 40, borderRadius: 12, border: `1px solid ${C.line}`, background: C.surface, color: C.text, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
            2 · Paste copied link
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, marginBottom: 10 }}>
          On that page, copy the <b style={{ color: C.text }}>Personal Link</b> (or the invitation link under Personal Meeting ID). Not signed in? Zoom will ask you to log in first.
        </div>

        <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://zoom.us/j/1234567890"
          spellCheck={false} autoCapitalize="off" autoCorrect="off"
          onKeyDown={(e) => { if (e.key === 'Enter' && clean) (onSaveAndCall || onSave)(clean) }}
          style={{ width: '100%', boxSizing: 'border-box', background: C.surface, border: `1px solid ${invalid ? C.bad : clean ? 'rgba(74,222,128,0.5)' : C.line}`, borderRadius: 12, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
        <div style={{ minHeight: 18, marginTop: 6, fontSize: 12, fontWeight: 600, color: invalid ? C.bad : C.ok }}>
          {invalid ? 'That doesn’t look like a Zoom meeting link (zoom.us/j/… or zoom.us/my/…).' : clean ? '✓ Looks good' : ''}
        </div>

        <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, margin: '8px 0 16px', background: C.surface, borderRadius: 12, padding: '10px 12px' }}>
          Tip: paste the full link (not just the number), so nobody has to type a passcode. Free Zoom accounts end each meeting after 40 minutes; paid accounts don’t. The link stays on this device.
        </div>

        <button onClick={async () => { setDiag('checking'); setDiag(await checkZoomServer()) }}
          style={{ background: 'transparent', border: 'none', color: C.zoom, fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 10, fontFamily: 'inherit' }}>
          {diag === 'checking' ? 'Checking…' : 'Why isn’t this automatic? Check the server →'}
        </button>
        {diag && diag !== 'checking' && <ServerReport d={diag} />}

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
