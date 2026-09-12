// src/components/Pulse/AskCurry.jsx
//
// Redesigned Ask Curry: the orb (CurryOrb) is now Curry's visual
// identity throughout — header avatar, and in Voice Mode, the entire
// interaction surface. Two modes:
//
//   Text mode  — refined version of the original chat: bubbles, source
//                chips, action cards, a mic button that DICTATES into
//                the input (fills it, doesn't send — the student stays
//                in control before sending).
//   Voice mode — hands-free: tap the orb to talk, Curry answers out
//                loud and then automatically starts listening again
//                (barge-in supported — tapping the orb while Curry is
//                speaking interrupts it and starts listening). The
//                orb's animated state (listening/thinking/speaking) is
//                the headline; the transcript and Curry's last answer
//                are shown small underneath, per the standard
//                voice-UI pattern of "voice for the headline, screen
//                for the detail."
//
// Voice mode requires browser Speech Recognition support (Chrome/Edge;
// Safari partial; no Firefox) — the toggle is hidden/disabled with an
// explanation when unsupported, never silently broken.

import React, { useEffect, useRef, useState } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import CurryOrb from './CurryOrb'
import { useCurryChat } from '../../hooks/useCurryChat'
import { useVoiceMode } from '../../hooks/useVoiceMode'
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

function iconButtonStyle(active) {
  return {
    background: active ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : SURFACE,
    border: `1px solid ${active ? 'transparent' : BORDER}`,
    borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
  }
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
      return <div style={{ marginTop: 8, fontSize: 11.5, color: TEXT_SECONDARY }}>✓ {message.declined ? 'Not submitted' : 'Confirmed'}</div>
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
    <div style={{ display: 'flex', gap: 8, justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
      {!isUser && <CurryOrb state="idle" size={22} style={{ marginBottom: 2 }} />}
      <div style={{
        maxWidth: '78%',
        background: isUser ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : SURFACE,
        border: isUser ? 'none' : `1px solid ${BORDER}`,
        color: isUser ? '#fff' : message.error ? '#fca5a5' : TEXT_PRIMARY,
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        padding: '10px 13px', fontSize: 13, lineHeight: 1.5,
      }}>
        {message.text}
        {!isUser && <SourceChips sources={message.sources} />}
        {!isUser && <ActionCard action={message.action} message={message} onOpenService={onOpenService} onConfirm={onConfirm} />}
      </div>
    </div>
  )
}

// ── Voice mode ──────────────────────────────────────────────────────────

function VoiceSurface({ orbState, interimTranscript, lastExchange, onTapOrb, voiceError, onOpenService, onConfirm }) {
  return (
    <div style={{
      flex: 1, minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 18, padding: '20px 16px',
      border: `1px solid ${BORDER}`, borderRadius: 16, background: 'rgba(15,15,26,0.4)', margin: '16px 0 10px',
    }}>
      <button
        onClick={onTapOrb}
        aria-label={orbState === 'listening' ? 'Stop listening' : orbState === 'speaking' ? 'Interrupt and talk' : 'Start talking'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 12 }}
      >
        <CurryOrb state={orbState} size={150} />
      </button>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: TEXT_PRIMARY, minHeight: 18 }}>
        {orbState === 'listening' && (interimTranscript || 'Listening…')}
        {orbState === 'thinking' && 'Thinking…'}
        {orbState === 'speaking' && 'Speaking…'}
        {orbState === 'idle' && 'Tap the orb to talk'}
      </div>

      {voiceError && (
        <div style={{ fontSize: 11.5, color: '#fca5a5', textAlign: 'center', maxWidth: 280 }}>{voiceError}</div>
      )}

      {lastExchange && (
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, textAlign: 'center' }}>"{lastExchange.userText}"</div>
          <div style={{
            fontSize: 12.5, color: TEXT_PRIMARY, background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 12, padding: '10px 13px', textAlign: 'left',
          }}>
            {lastExchange.text}
            <SourceChips sources={lastExchange.sources} />
            <ActionCard action={lastExchange.action} message={lastExchange} onOpenService={onOpenService} onConfirm={onConfirm} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function AskCurry({ userId, onNavigate, onClose }) {
  const { messages, sending, sendMessage, confirmAction, declineAction } = useCurryChat({ userId })
  const voice = useVoiceMode()
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('text') // 'text' | 'voice'
  const scrollRef = useRef(null)
  const usage = useDekutUsage('dekut')
  const lastSpokenIdRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // Auto-speak Curry's newest reply while in voice mode, then
  // automatically resume listening — the hands-free loop. Never speaks
  // the same message twice (lastSpokenIdRef), and never fires while
  // still waiting on a response.
  useEffect(() => {
    if (mode !== 'voice' || sending) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant' || last.id === lastSpokenIdRef.current) return
    lastSpokenIdRef.current = last.id
    voice.speak(last.text, () => {
      voice.startListening((finalText) => sendMessage(finalText))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, sending, mode])

  const handleSend = (text) => {
    const value = (text ?? input).trim()
    if (!value) return
    sendMessage(value)
    setInput('')
  }

  const handleDictateIntoInput = () => {
    voice.startListening((finalText) => setInput((prev) => (prev ? `${prev} ${finalText}` : finalText)))
  }

  const handleTapOrb = () => {
    if (voice.speaking) { voice.stopSpeaking(); voice.startListening((finalText) => sendMessage(finalText)); return }
    if (voice.listening) { voice.stopListening(); return }
    voice.startListening((finalText) => sendMessage(finalText))
  }

  const toggleMode = () => {
    voice.stopListening()
    voice.stopSpeaking()
    setMode((m) => (m === 'text' ? 'voice' : 'text'))
  }

  const handleOpenService = (serviceId) => {
    const service = getServiceById(serviceId, DEKUT_CATEGORIES)
    if (service) openDekutService(service, { usage, onNavigate })
  }

  const handleConfirm = (messageId, action) => {
    if (action) confirmAction(messageId, action)
    else declineAction(messageId)
  }

  const orbState = sending ? 'thinking' : voice.speaking ? 'speaking' : voice.listening ? 'listening' : 'idle'
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const lastExchange = mode === 'voice' && lastAssistant ? { ...lastAssistant, userText: lastUser?.text } : null

  return (
    <div className="curry-mount" style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .curry-mount { animation: curryMountIn 260ms cubic-bezier(0.16, 1, 0.3, 1); }
        }
        @keyframes curryMountIn {
          from { opacity: 0; transform: scale(0.97) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CurryOrb state={mode === 'voice' ? orbState : 'idle'} size={32} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT_PRIMARY }}>Curry</div>
            <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, maxWidth: 300 }}>
              {mode === 'voice'
                ? { listening: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking…', idle: 'Tap the orb to talk' }[orbState]
                : "Answers from verified DeKUT info and can open services for you."}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {voice.speechRecognitionSupported && (
            <button onClick={toggleMode} aria-label={mode === 'voice' ? 'Switch to text mode' : 'Switch to voice mode'} title={mode === 'voice' ? 'Switch to text' : 'Switch to voice mode'} style={iconButtonStyle(mode === 'voice')}>
              <DekutIcon type={mode === 'voice' ? 'search' : 'cpu'} size={16} color={mode === 'voice' ? '#fff' : TEXT_SECONDARY} strokeWidth={2} />
            </button>
          )}
          {typeof onClose === 'function' && (
            <button onClick={onClose} aria-label="Close Ask Curry" style={iconButtonStyle(false)}>
              <DekutIcon type="x" size={16} color={TEXT_PRIMARY} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      {mode === 'voice' ? (
        <VoiceSurface
          orbState={orbState}
          interimTranscript={voice.interimTranscript}
          lastExchange={lastExchange}
          onTapOrb={handleTapOrb}
          voiceError={voice.error}
          onOpenService={handleOpenService}
          onConfirm={handleConfirm}
        />
      ) : (
        <div ref={scrollRef} style={{
          flex: 1, minHeight: 260, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 10,
          border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14,
          background: 'rgba(15,15,26,0.4)', margin: '16px 0 10px',
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <CurryOrb state="idle" size={56} style={{ margin: '0 auto 10px' }} />
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
          {sending && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <CurryOrb state="thinking" size={22} />
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '14px 14px 14px 4px', padding: '11px 14px', fontSize: 12, color: TEXT_SECONDARY }}>
                Thinking…
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'text' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '9px 12px', background: SURFACE }}>
          {voice.speechRecognitionSupported && (
            <button onClick={handleDictateIntoInput} aria-label="Dictate" title="Dictate into the box" style={iconButtonStyle(voice.listening)}>
              <DekutIcon type="cpu" size={15} color={voice.listening ? '#fff' : TEXT_SECONDARY} strokeWidth={2} />
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={voice.listening ? 'Listening…' : 'Ask Curry anything about DeKUT...'}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: TEXT_PRIMARY, width: '100%', fontFamily: 'inherit' }}
          />
          <button onClick={() => handleSend()} disabled={sending || !input.trim()} aria-label="Send" style={{
            ...iconButtonStyle(false), background: ICON_GRADIENTS.cpu,
            opacity: sending || !input.trim() ? 0.5 : 1, cursor: sending || !input.trim() ? 'default' : 'pointer',
          }}>
            <DekutIcon type="chevronRight" size={15} color="#fff" strokeWidth={2.4} />
          </button>
        </div>
      )}

      <div style={{ marginTop: 10, borderRadius: 14, border: `1px dashed ${BORDER}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>Curry not finding what you need?</div>
        </div>
        <a href="mailto:studentadmin@dkut.ac.ke" style={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', textDecoration: 'none', flexShrink: 0 }}>
          Email ICT
        </a>
      </div>
    </div>
  )
}
