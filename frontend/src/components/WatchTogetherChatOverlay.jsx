// components/WatchTogetherChatOverlay.jsx
import React, { useState, useRef, useEffect } from 'react'

const BUBBLE_LIFETIME_MS = 6000

export default function WatchTogetherChatOverlay({ messages, currentUserId, onSend, mini }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [visible, setVisible] = useState([])
  const inputRef = useRef(null)

  // Show each new message, fade it out after BUBBLE_LIFETIME_MS
  useEffect(() => {
    if (!messages.length) return
    const latest = messages[messages.length - 1]
    setVisible(prev => [...prev, { ...latest, _key: `${latest.userId}-${latest.ts}` }])
    const t = setTimeout(() => {
      setVisible(prev => prev.filter(m => m._key !== `${latest.userId}-${latest.ts}`))
    }, BUBBLE_LIFETIME_MS)
    return () => clearTimeout(t)
  }, [messages])

  const handleSend = () => {
    if (!draft.trim()) return
    onSend(draft.trim())
    setDraft('')
  }

  if (mini) return null // overlay only shows in full watch-together mode

  return (
    <>
      {/* Floating message stack — bottom-left, above the video controls */}
      <div style={{
        position: 'absolute', left: 16, bottom: 70, zIndex: 605,
        display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '65%',
        pointerEvents: 'none',
      }}>
        {visible.map(m => {
          const mine = m.userId === currentUserId
          return (
            <div
              key={m._key}
              className="wt-msg-in"
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                background: mine ? 'linear-gradient(135deg,#a78bfa,#7c3aed)' : 'linear-gradient(135deg,#34d399,#0ea5a3)',
                color: '#fff', fontSize: 13, fontWeight: 600,
                padding: '8px 14px', borderRadius: 18,
                boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                maxWidth: 260, wordBreak: 'break-word',
              }}
            >
              {!mine && m.username && (
                <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.8, marginBottom: 2 }}>{m.username}</div>
              )}
              {m.text}
            </div>
          )
        })}
      </div>

      {/* Send button / expanding input — bottom right */}
      <div style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 606, display: 'flex', alignItems: 'center', gap: 8 }}>
        {open && (
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); if (e.key === 'Escape') setOpen(false) }}
            placeholder="Say something…"
            style={{
              background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(167,139,250,0.4)',
              borderRadius: 20, color: '#fff', fontSize: 13, padding: '8px 14px',
              outline: 'none', width: 180,
            }}
          />
        )}
        <button
          onClick={() => { if (open) handleSend(); else { setOpen(true) } }}
          style={{
            background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none',
            borderRadius: 24, color: '#fff', fontSize: 12.5, fontWeight: 700,
            padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(102,126,234,0.4)', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          💬 {open ? 'Send' : 'Send message'}
        </button>
      </div>

      <style>{`
        @keyframes wtMsgIn {
          from { opacity: 0; transform: translateY(14px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .wt-msg-in { animation: wtMsgIn 0.28s cubic-bezier(0.34,1.56,0.64,1); }
      `}</style>
    </>
  )
}
