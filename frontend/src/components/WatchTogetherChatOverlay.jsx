 
import React, { useState, useRef, useEffect } from 'react'

const BUBBLE_LIFETIME_MS = 6000

// Three-dot typing indicator — deliberately NOT the standard bounce
// used in the regular chat: each dot travels a small orbit and
// pulses in size/opacity together, so it reads as "alive" without
// being a copy of the chat-list version.
function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 2px' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="wt-typing-dot"
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'linear-gradient(135deg,#a78bfa,#34d399)',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </div>
  )
}

// Paper-plane "send" icon that morphs into a chat-bubble "compose"
// icon depending on state — no emoji, just stroked SVG that
// rotates/scales on state change via CSS.
function SendGlyph({ sending }) {
  return (
    <span className={`wt-send-glyph ${sending ? 'is-sending' : ''}`} style={{ display: 'inline-flex', width: 15, height: 15 }}>
      <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
        <path
          d="M3.4 20.6L21 12 3.4 3.4l-.1 6.7L15 12 3.3 13.9l.1 6.7z"
          fill="currentColor"
        />
      </svg>
    </span>
  )
}

function ComposeGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
      <path
        d="M20 12c0 4.42-3.58 8-8 8-1.13 0-2.2-.23-3.18-.66L4 20l1.06-4.24A7.94 7.94 0 0 1 4 12c0-4.42 3.58-8 8-8s8 3.58 8 8Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
      />
    </svg>
  )
}

export default function WatchTogetherChatOverlay({ messages, currentUserId, onSend, mini, typingUsers = [], onTyping }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [visible, setVisible] = useState([])
  const [justSent, setJustSent] = useState(false)
  const inputRef = useRef(null)

  // Show each new message, fade it out after BUBBLE_LIFETIME_MS
  useEffect(() => {
    if (!messages.length) return
    const latest = messages[messages.length - 1]
    setVisible((prev) => [...prev, { ...latest, _key: `${latest.userId}-${latest.ts}` }])
    const t = setTimeout(() => {
      setVisible((prev) => prev.filter((m) => m._key !== `${latest.userId}-${latest.ts}`))
    }, BUBBLE_LIFETIME_MS)
    return () => clearTimeout(t)
  }, [messages])

  const handleDraftChange = (e) => {
    const v = e.target.value
    setDraft(v)
    onTyping?.(v.length > 0)
  }

  const handleSend = () => {
    if (!draft.trim()) return
    onSend(draft.trim())
    setDraft('')
    onTyping?.(false)
    setJustSent(true)
    setTimeout(() => setJustSent(false), 260)
  }

  const handleClose = () => {
    setOpen(false)
    onTyping?.(false)
  }

  if (mini) return null // overlay only shows in full watch-together mode

  const othersTyping = typingUsers.filter((u) => u.userId !== currentUserId)

  return (
    <>
      {/* Floating message stack — bottom-left, above the video controls */}
      <div style={{
        position: 'absolute', left: 16, bottom: 70, zIndex: 605,
        display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '65%',
        pointerEvents: 'none',
      }}>
        {visible.map((m) => {
          const mine = m.userId === currentUserId
          return (
            <div
              key={m._key}
              className="wt-msg-float"
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

        {othersTyping.length > 0 && (
          <div
            className="wt-msg-float"
            style={{
              alignSelf: 'flex-start',
              background: 'rgba(20,20,30,0.7)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 18, padding: '7px 12px',
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: '#d1d5db' }}>
              {othersTyping.length === 1 ? othersTyping[0].username : `${othersTyping.length} people`}
            </span>
            <TypingDots />
          </div>
        )}
      </div>

      {/* Send button / expanding input — bottom right */}
      <div style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 606, display: 'flex', alignItems: 'center', gap: 8 }}>
        {open && (
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); if (e.key === 'Escape') handleClose() }}
            onBlur={() => { if (!draft) onTyping?.(false) }}
            placeholder="Say something…"
            style={{
              background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(167,139,250,0.4)',
              borderRadius: 20, color: '#fff', fontSize: 13, padding: '8px 14px',
              outline: 'none', width: 180,
            }}
          />
        )}
        <button
          onClick={() => { if (open) handleSend(); else setOpen(true) }}
          className={`wt-send-btn ${justSent ? 'wt-pulse' : ''}`}
          style={{
            background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none',
            borderRadius: 24, color: '#fff', fontSize: 12.5, fontWeight: 700,
            padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(102,126,234,0.4)', display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          {open ? <SendGlyph sending={justSent} /> : <ComposeGlyph />}
          {open ? 'Send' : 'Send message'}
        </button>
      </div>

      <style>{`
        @keyframes wtMsgFloatIn {
          0%   { opacity: 0; transform: translateY(22px) scale(0.9); }
          60%  { opacity: 1; transform: translateY(-3px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .wt-msg-float { animation: wtMsgFloatIn 0.42s cubic-bezier(0.22,1.2,0.36,1); }

        @keyframes wtTypingDot {
          0%, 60%, 100% { transform: translateY(0) scale(0.85); opacity: 0.5; }
          30% { transform: translateY(-4px) scale(1.15); opacity: 1; }
        }
        .wt-typing-dot { display: inline-block; animation: wtTypingDot 1.1s ease-in-out infinite; }

        @keyframes wtBtnPulse {
          0%   { transform: scale(1); }
          40%  { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
        .wt-pulse { animation: wtBtnPulse 0.26s ease-out; }

        .wt-send-glyph { transition: transform 0.2s ease; transform-origin: center; }
        .wt-send-btn:active .wt-send-glyph { transform: translateX(2px) rotate(-8deg); }
      `}</style>
    </>
  )
}
