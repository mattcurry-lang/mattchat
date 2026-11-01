import React, { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import PresenceSheet, { C, chipStyle, sectionLabel } from './PresenceSheet'
import { DURATIONS, NOTE_MAX, STARTERS, VIBES, buildNotePatch, expiryFor, timeLeft } from '../lib/presence'

/**
 * Write your note. Fast by design:
 *  • vibe chips fill the note AND set your status (emoji + text) in one tap
 *  • conversation starters, because a note that asks a tiny question gets answered
 *  • you choose how long it lasts (1h / 4h / today / 24h) instead of a fixed 24 hours
 *  • live preview of exactly what your friends will see
 */
export default function NoteComposerSheet({ name, avatarUrl, initial, onSave, onClose }) {
  const hadSomething = !!(initial?.note || initial?.vibeEmoji || initial?.vibeText)
  const [text, setText] = useState(initial?.note || '')
  const [vibe, setVibe] = useState(initial?.vibeEmoji || initial?.vibeText ? { emoji: initial.vibeEmoji, text: initial.vibeText } : null)
  const [vibeTouched, setVibeTouched] = useState(false)
  const [duration, setDuration] = useState('24h')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const autoText = useRef('')                       // the last text a chip filled in, so a later chip may replace it
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const vibeLabel = (v) => `${v.emoji} ${v.text}`.trim()
  const pickVibe = (v) => {
    const on = vibe && vibe.emoji === v.emoji && vibe.text === v.text
    setVibeTouched(true)
    if (on) { setVibe(null); if (text === autoText.current) { setText(''); autoText.current = '' } return }
    setVibe(v)
    if (!text.trim() || text === autoText.current) { const label = vibeLabel(v); setText(label); autoText.current = label }
  }

  const canShare = !!text.trim() || (vibeTouched && !!vibe)
  const preview = text.trim() || (vibe ? vibeLabel(vibe) : '')
  const left = timeLeft(expiryFor(duration))

  const save = async (patch) => {
    setBusy(true); setError('')
    let ok = false
    try { ok = await onSave(patch) } catch { ok = false }
    setBusy(false)
    if (ok) onClose(); else setError('Couldn’t save that. Check your connection and try again.')
  }
  const share = () => canShare && save(buildNotePatch({ text, vibe: vibeTouched ? vibe : undefined, duration }))
  const clear = () => save({ note_text: null, note_expires_at: null, status_emoji: null, status_text: null, status_expires_at: null })

  return (
    <PresenceSheet label="Your note" onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>Your note</div>
      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>Say what you’re up to. Friends can react or reply.</div>

      {/* live preview */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '18px 0 6px' }}>
        <div style={{ minHeight: 44, display: 'flex', alignItems: 'flex-end' }}>
          <div data-testid="note-preview" style={{ position: 'relative', maxWidth: 220, padding: '9px 14px', borderRadius: 18, background: C.surface2, border: `1px solid ${C.line}`, fontSize: 13.5, fontWeight: 700, textAlign: 'center', color: preview ? C.text : C.muted, wordBreak: 'break-word' }}>
            {preview || 'Your note appears here'}
            <span style={{ position: 'absolute', left: '50%', bottom: -6, width: 11, height: 11, marginLeft: -5, transform: 'rotate(45deg)', background: C.surface2, borderRight: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, borderBottomRightRadius: 3 }} />
          </div>
        </div>
        <div style={{ position: 'relative', marginTop: 10 }}>
          <Avatar name={name || 'You'} size={52} photoUrl={avatarUrl} />
          {vibe && <span style={{ position: 'absolute', top: -4, left: -8, width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, background: C.bg, border: `2px solid ${C.bg}` }}>{vibe.emoji}</span>}
        </div>
        {preview && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Disappears in {left.replace(' left', '')}</div>}
      </div>

      {/* text */}
      <div style={{ position: 'relative', marginTop: 12 }}>
        <input
          ref={inputRef} value={text} maxLength={NOTE_MAX} placeholder="Share a thought…" aria-label="Note text"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') share() }}
          style={{ width: '100%', boxSizing: 'border-box', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: '13px 52px 13px 14px', color: C.text, fontSize: 14.5, outline: 'none', fontFamily: 'inherit' }}
        />
        <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 11.5, fontWeight: 700, color: text.length >= NOTE_MAX ? C.bad : C.muted }}>{text.length}/{NOTE_MAX}</span>
      </div>

      <div style={sectionLabel}>Vibe · sets your status too</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {VIBES.map((v) => {
          const on = !!vibe && vibe.emoji === v.emoji && vibe.text === v.text
          return <button key={v.text} style={chipStyle(on)} aria-pressed={on} onClick={() => pickVibe(v)}>{v.emoji} {v.text}</button>
        })}
      </div>

      <div style={sectionLabel}>Start a conversation</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {STARTERS.map((s) => <button key={s} style={chipStyle(false)} onClick={() => { setText(s.slice(0, NOTE_MAX)); autoText.current = '' }}>{s}</button>)}
      </div>

      <div style={sectionLabel}>Disappears after</div>
      <div role="radiogroup" aria-label="How long" style={{ display: 'flex', gap: 6, background: C.surface, borderRadius: 14, padding: 4 }}>
        {DURATIONS.map((d) => {
          const on = duration === d.id
          return (
            <button key={d.id} role="radio" aria-checked={on} onClick={() => setDuration(d.id)}
              style={{ flex: 1, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, padding: '9px 0', borderRadius: 11, color: on ? '#0f0f1a' : C.muted, background: on ? '#fff' : 'transparent' }}>
              {d.label}
            </button>
          )
        })}
      </div>

      {error && <div role="alert" style={{ marginTop: 12, fontSize: 12.5, color: C.bad, fontWeight: 600 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        {hadSomething && (
          <button onClick={clear} disabled={busy} style={{ height: 48, padding: '0 18px', borderRadius: 999, border: `1px solid ${C.line}`, background: 'transparent', color: C.muted, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
        )}
        <button
          onClick={share} disabled={!canShare || busy}
          style={{ flex: 1, height: 48, borderRadius: 999, border: 'none', cursor: canShare && !busy ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: 14.5, color: '#fff', fontFamily: 'inherit', opacity: canShare ? 1 : 0.5,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, boxShadow: canShare ? '0 10px 26px rgba(108,99,255,0.45)' : 'none' }}
        >
          {busy ? 'Sharing…' : hadSomething ? 'Update note' : 'Share note'}
        </button>
      </div>
    </PresenceSheet>
  )
}
