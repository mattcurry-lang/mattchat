// src/components/Pulse/AskCurry.jsx
//
// Curry's chat surface. Two modes:
//   - Chat: refined bubbles, source chips, action cards (unchanged
//     logic from Phase 2), plus a lightweight client-side "streaming"
//     reveal on assistant replies for a more alive feel — the backend
//     still returns one full response, this just reveals it
//     progressively rather than dumping it in all at once. True
//     token-by-token streaming would need the edge function to speak
//     SSE, which is a bigger backend change, not a UI one.
//   - Voice: push-to-talk. Tap the orb to listen, tap again to send;
//     the orb's color and pulse reflect real mic amplitude while
//     listening, and Curry speaks its reply aloud via the browser's
//     speech synthesis. Falls back to chat-only if the browser doesn't
//     support the Web Speech API (see useCurryVoice's `supported` flag).

import React, { useEffect, useRef, useState } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import { useCurryChat } from '../../hooks/useCurryChat'
import { useCurryVoice } from '../../hooks/useCurryVoice'
import { DEKUT_CATEGORIES, getServiceById } from '../../data/dekutServices'
import { useDekutUsage } from '../../hooks/useDekutUsage'
import { openDekutService } from '../../utils/dekutOpenService'

const TEXT_PRIMARY = '#f5f5fa'
const TEXT_SECONDARY = 'rgba(245,245,250,0.6)'
const BORDER = 'rgba(245,245,250,0.16)'
const SURFACE = 'rgba(245,245,250,0.06)'

const QUICK_ACTIONS = [
  "Where is RC18?",
  "How do I register my units?",
  "Where is the library?",
  "I'm a first-year student",
  "How do I access eLearning?",
]

const ACTION_SERVICE_ID = {
  OPEN_STUDENT_PORTAL: 'student-portal',
  OPEN_ELEARNING: 'elearning',
  OPEN_LIBRARY: 'library',
  OPEN_CATERING: 'catering',
  OPEN_SUPPORT: 'contacts',
  SHOW_ROUTE: 'room-finder',
  SHOW_LOCATION: 'room-finder',
  SHOW_CONTACT: 'contacts',
}

const ACTION_LABEL = {
  OPEN_STUDENT_PORTAL: 'Open Student Portal',
  OPEN_ELEARNING: 'Open eLearning',
  OPEN_LIBRARY: 'Open Library',
  OPEN_CATERING: 'Open Catering',
  OPEN_SUPPORT: 'Get Support',
  SHOW_ROUTE: 'Show on Campus Map',
  SHOW_LOCATION: 'Show on Campus Map',
  SHOW_CONTACT: 'View Contact Details',
}

// Reveals text progressively on mount rather than all at once. Caps
// total duration so long replies don't feel sluggish.
function StreamingText({ text }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!text) return
    const totalMs = Math.min(900, Math.max(150, text.length * 8))
    const stepMs = Math.max(8, totalMs / text.length)
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) { clearInterval(id); return c }
        return c + 1
      })
    }, stepMs)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate once per mount
  }, [])
  return <>{text.slice(0, count)}</>
}

function SourceChips({ sources }) {
  if (!sources || sources.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {sources.map((s, i) => (
        <span key={i} title={s.authority || undefined} style={{
          fontSize: 10.5, fontWeight: 600, color: TEXT_SECONDARY,
          border: `1px solid ${BORDER}`, borderRadius: 999, padding: '3px 9px',
        }}>
          {s.source || s.title}
        </span>
      ))}
    </div>
  )
}

function ActionCard({ action, message, onOpenService, onConfirm }) {
  if (!action) return null

  if (action.type === 'CONFIRM_REQUIRED') {
    if (message.confirmed) {
      return <div style={{ marginTop: 8, fontSize: 11.5, color: TEXT_SECONDARY }}>✓ Confirmed</div>
    }
    return (
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => onConfirm(message.id, action)} style={{
          fontSize: 11.5, fontWeight: 700, color: '#fff', fontFamily: 'inherit',
          border: 'none', borderRadius: 9, padding: '7px 14px', cursor: 'pointer',
          background: 'linear-gradient(135deg,#a78bfa,#6c63ff)',
        }}>
          Yes, submit it
        </button>
        <button onClick={() => onConfirm(message.id, null)} style={{
          fontSize: 11.5, fontWeight: 700, color: TEXT_SECONDARY, fontFamily: 'inherit',
          border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 14px', cursor: 'pointer', background: 'none',
        }}>
          Not now
        </button>
      </div>
    )
  }

  const serviceId = ACTION_SERVICE_ID[action.type]
  const label = ACTION_LABEL[action.type]
  if (!serviceId || !label) return null

  return (
    <button onClick={() => onOpenService(serviceId)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
      fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', fontFamily: 'inherit',
      border: '1px solid rgba(167,139,250,0.4)', borderRadius: 9, padding: '7px 12px',
      cursor: 'pointer', background: 'rgba(167,139,250,0.08)',
    }}>
      {label} <DekutIcon type="chevronRight" size={12} color="#c4b5fd" strokeWidth={2.2} />
    </button>
  )
}

function MessageBubble({ message, onOpenService, onConfirm }) {
  const isUser = message.role === 'user'
  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      animation: 'curryMsgIn 220ms ease',
    }}>
      <div style={{
        maxWidth: '82%',
        background: isUser ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : SURFACE,
        border: isUser ? 'none' : `1px solid ${BORDER}`,
        color: isUser ? '#fff' : message.error ? '#fca5a5' : TEXT_PRIMARY,
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        padding: '10px 13px', fontSize: 13, lineHeight: 1.5,
      }}>
        {isUser || message.error ? message.text : <StreamingText text={message.text} />}
        {!isUser && <SourceChips sources={message.sources} />}
        {!isUser && <ActionCard action={message.action} message={message} onOpenService={onOpenService} onConfirm={onConfirm} />}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '14px 14px 14px 4px', padding: '11px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: TEXT_SECONDARY, animation: `curryBounce 1.1s ${i * 0.15}s infinite ease-in-out` }} />
        ))}
      </div>
    </div>
  )
}

// Color/animation per voice state — this is the "ambient" cue that
// tells the student what Curry is doing without reading any text.
function voiceOrbStyle({ listening, thinking, speaking, volume }) {
  if (listening) {
    const scale = 1 + Math.min(volume, 1) * 0.35
    return {
      background: 'linear-gradient(135deg,#22d3ee,#0891b2)',
      boxShadow: `0 0 ${30 + volume * 40}px rgba(34,211,238,${0.35 + volume * 0.35})`,
      transform: `scale(${scale})`,
      transition: 'transform 60ms linear, box-shadow 60ms linear',
    }
  }
  if (thinking) {
    return {
      background: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
      animation: 'curryVoicePulse 1s ease-in-out infinite',
    }
  }
  if (speaking) {
    return {
      background: 'linear-gradient(135deg,#fb923c,#f97316)',
      animation: 'curryVoicePulse 0.7s ease-in-out infinite',
    }
  }
  return {
    background: 'linear-gradient(135deg,#a78bfa,#6c63ff)',
    animation: 'curryVoicePulse 2.6s ease-in-out infinite',
  }
}

function VoiceMode({ voice, sending, onFinalTranscript, lastAssistantText }) {
  const { supported, listening, speaking, volume, transcript, start, stop, cancelSpeech } = voice

  const handleOrbTap = () => {
    if (listening) { stop(); return }
    if (speaking) { cancelSpeech(); return } // barge-in: tap to interrupt Curry talking
    start(onFinalTranscript)
  }

  if (!supported) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: TEXT_SECONDARY, fontSize: 13 }}>
        Voice mode isn't supported in this browser yet — try Chrome or Edge, or use text chat below.
      </div>
    )
  }

  const caption = listening ? (transcript || 'Listening…') : speaking ? (lastAssistantText || 'Curry is speaking…') : sending ? 'Thinking…' : 'Tap to talk to Curry'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 320, gap: 24 }}>
      <button
        onClick={handleOrbTap}
        aria-label={listening ? 'Stop listening' : speaking ? 'Stop Curry speaking' : 'Start talking to Curry'}
        style={{
          width: 140, height: 140, borderRadius: '50%', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...voiceOrbStyle({ listening, thinking: sending, speaking, volume }),
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 40 }}>{listening || speaking ? '⏹' : '🎤'}</span>
      </button>
      <div style={{ fontSize: 13.5, color: TEXT_PRIMARY, textAlign: 'center', maxWidth: 300, lineHeight: 1.5, minHeight: 40 }}>
        {caption}
      </div>
      <style>{`
        @keyframes curryVoicePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  )
}

export default function AskCurry({ userId, onNavigate, onClose }) {
  const { messages, sending, sendMessage, confirmAction, declineAction } = useCurryChat({ userId })
  const voice = useCurryVoice()
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('chat') // 'chat' | 'voice'
  const scrollRef = useRef(null)
  const usage = useDekutUsage('dekut')
  const spokenIdsRef = useRef(new Set())

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // Speak each new assistant reply aloud while in voice mode — but only
  // once per message, so re-renders never trigger a second read-out.
  useEffect(() => {
    if (mode !== 'voice') return
    const last = messages[messages.length - 1]
    if (last && last.role === 'assistant' && !last.error && !spokenIdsRef.current.has(last.id)) {
      spokenIdsRef.current.add(last.id)
      voice.speak(last.text)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- voice.speak is stable enough for this
  }, [messages, mode])

  const handleSend = (text) => {
    const value = (text ?? input).trim()
    if (!value) return
    sendMessage(value)
    setInput('')
  }

  const handleOpenService = (serviceId) => {
    const service = getServiceById(serviceId, DEKUT_CATEGORIES)
    if (service) openDekutService(service, { usage, onNavigate })
  }

  const handleConfirm = (messageId, action) => {
    if (action) confirmAction(messageId, action)
    else declineAction(messageId)
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.error)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div aria-hidden="true" style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#a78bfa,#6c63ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            🤖
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT_PRIMARY }}>Curry</div>
            <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>Your DeKUT campus assistant</div>
          </div>
        </div>
        {typeof onClose === 'function' && (
          <button onClick={onClose} aria-label="Close Ask Curry" style={{
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, width: 34, height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}>
            <DekutIcon type="x" size={16} color={TEXT_PRIMARY} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {voice.supported && (
        <div style={{
          display: 'flex', gap: 4, background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 999, padding: 3, marginTop: 14, width: 'fit-content',
        }}>
          {[{ id: 'chat', label: 'Chat' }, { id: 'voice', label: 'Voice' }].map((t) => (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              style={{
                fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                border: 'none', borderRadius: 999, padding: '6px 16px',
                background: mode === t.id ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : 'transparent',
                color: mode === t.id ? '#fff' : TEXT_SECONDARY,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {mode === 'voice' ? (
        <VoiceMode voice={voice} sending={sending} onFinalTranscript={handleSend} lastAssistantText={lastAssistant?.text} />
      ) : (
        <>
          <div ref={scrollRef} style={{
            flex: 1, minHeight: 260, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 10,
            border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14,
            background: 'rgba(15,15,26,0.4)', margin: '16px 0 10px',
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                <div style={{ fontSize: 13.5, color: TEXT_PRIMARY, fontWeight: 700, marginBottom: 4 }}>Hey! I'm Curry.</div>
                <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginBottom: 14 }}>
                  I can help you navigate DeKUT, understand procedures, and get to campus services. What do you need?
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {QUICK_ACTIONS.map((q) => (
                    <button key={q} onClick={() => handleSend(q)} style={{
                      fontSize: 11.5, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: 'inherit',
                      border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 12px', background: SURFACE, cursor: 'pointer',
                    }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onOpenService={handleOpenService} onConfirm={handleConfirm} />
            ))}
            {sending && <TypingIndicator />}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '9px 12px', background: SURFACE }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Ask Curry anything about DeKUT..."
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: TEXT_PRIMARY, width: '100%', fontFamily: 'inherit' }}
            />
            <button onClick={() => handleSend()} disabled={sending || !input.trim()} aria-label="Send" style={{
              background: ICON_GRADIENTS.cpu, border: 'none', borderRadius: 9, width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: sending || !input.trim() ? 'default' : 'pointer', opacity: sending || !input.trim() ? 0.5 : 1, flexShrink: 0,
            }}>
              <DekutIcon type="chevronRight" size={15} color="#fff" strokeWidth={2.4} />
            </button>
          </div>

          <div style={{ marginTop: 10, borderRadius: 14, border: `1px dashed ${BORDER}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>Curry not finding what you need?</div>
            </div>
            <a href="mailto:studentadmin@dkut.ac.ke" style={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', textDecoration: 'none', flexShrink: 0 }}>
              Email ICT
            </a>
          </div>
        </>
      )}

      <style>{`
        @keyframes curryMsgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes curryBounce { 0%, 80%, 100% { opacity: 0.3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
      `}</style>
    </div>
  )
}
