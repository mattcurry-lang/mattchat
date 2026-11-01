import React, { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import PresenceSheet, { C, chipStyle, sectionLabel } from './PresenceSheet'
import { QUICK_REACTIONS, QUICK_REPLIES, timeLeft } from '../lib/presence'

/**
 * React or reply to a friend's note. One tap on an emoji or a quick reply sends it straight into
 * your chat with them, quoting the note, so the conversation just continues there.
 */
export default function NoteReplySheet({ item, onSend, onOpenChat, onClose }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const first = (item.name || 'them').split(' ')[0]
  const left = item.hasNote ? timeLeft(item.noteExpiresAt) : ''

  const send = async (value) => {
    const v = (value ?? text).trim()
    if (!v || busy) return
    setBusy(true); setError('')
    let ok = false
    try { ok = await onSend(v) } catch { ok = false }
    setBusy(false)
    if (!ok) setError('Couldn’t send that. Check your connection and try again.')
  }

  return (
    <PresenceSheet label={`${first}'s note`} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={item.name} size={46} photoUrl={item.avatarUrl} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{item.name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{item.hasNote ? 'Note' : 'Status'}{left ? ` · ${left}` : ''}</div>
        </div>
      </div>

      <div style={{ margin: '16px 0 4px', padding: '16px 18px', borderRadius: 20, background: C.surface2, border: `1px solid ${C.line}`, fontSize: 17, fontWeight: 700, lineHeight: 1.35, wordBreak: 'break-word' }}>
        {item.bubbleText}
      </div>

      <div style={sectionLabel}>React</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {QUICK_REACTIONS.map((r) => (
          <button key={r} onClick={() => send(r)} disabled={busy} aria-label={`React ${r}`}
            style={{ flex: 1, height: 46, borderRadius: 14, border: `1px solid ${C.line}`, background: C.surface, fontSize: 22, cursor: 'pointer' }}>{r}</button>
        ))}
      </div>

      <div style={sectionLabel}>Quick reply</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {QUICK_REPLIES.map((q) => <button key={q} style={chipStyle(false)} disabled={busy} onClick={() => send(q)}>{q}</button>)}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input
          ref={inputRef} value={text} placeholder={`Reply to ${first}…`} aria-label="Reply"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          style={{ flex: 1, minWidth: 0, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 999, padding: '12px 16px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
        />
        <button onClick={() => send()} disabled={!text.trim() || busy} aria-label="Send reply"
          style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: text.trim() && !busy ? 'pointer' : 'not-allowed', color: '#fff', fontSize: 18, fontWeight: 800, opacity: text.trim() ? 1 : 0.45,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})` }}>↑</button>
      </div>

      {error && <div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: C.bad, fontWeight: 600 }}>{error}</div>}

      <button onClick={onOpenChat} style={{ marginTop: 14, background: 'none', border: 'none', color: C.accent, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
        Open chat with {first} →
      </button>
    </PresenceSheet>
  )
}
