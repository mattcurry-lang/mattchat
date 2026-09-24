// src/components/Pulse/AskCurry.jsx
//
// Curry's chat surface — redesigned.
//
// DESIGN NOTES (why it looks the way it does)
// ─────────────────────────────────────────────
// Curry is named after a spice, so the palette leans into that instead
// of the generic violet-gradient-on-black look every AI chat template
// ships with: a near-black base (#0A0A0F) with a turmeric-gold /
// burnt-amber accent pair (#F2A93B → #D9622B) and warm off-white text
// (#F5F1E8) rather than cold blue-white. Glass panels use a tuned
// backdrop-blur (16–18px) with layered translucency for real depth
// instead of a flat 1px border doing all the work.
//
// Two modes, same as before:
//   - Chat: bubbles, source chips, action cards, client-side streaming
//     reveal on assistant replies (backend still returns one full
//     response — this reveals it progressively for a more alive feel).
//   - Voice: push-to-talk. Tap the orb to listen, tap again to send;
//     the orb's color/glow reflect real mic amplitude while listening,
//     and Curry speaks its reply aloud. Falls back to chat-only if the
//     browser doesn't support mic access (see useCurryVoice.supported).

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import CurryOrbGraphic from './CurryOrbGraphic'
import { useCurryChat } from '../../hooks/useCurryChat'
import { useCurryVoice } from '../../hooks/useCurryVoice'
import { DEKUT_CATEGORIES, getServiceById } from '../../data/dekutServices'
import { useDekutUsage } from '../../hooks/useDekutUsage'
import { openDekutService } from '../../utils/dekutOpenService'
import ActionCard from './CurryCateringCards'

// ── Design tokens ─────────────────────────────────────────────────────
const BASE = '#0A0A0F'
const TEXT_PRIMARY = '#F5F1E8'
const TEXT_SECONDARY = 'rgba(245,241,232,0.58)'
const TEXT_TERTIARY = 'rgba(245,241,232,0.38)'
const BORDER = 'rgba(245,241,232,0.10)'
const BORDER_STRONG = 'rgba(245,241,232,0.18)'
const SURFACE = 'rgba(245,241,232,0.045)'
const SURFACE_RAISED = 'rgba(245,241,232,0.07)'
const GOLD = '#F2A93B'
const AMBER = '#D9622B'
const TEAL = '#2DD4BF'
const ERROR = '#FF7A6B'
const USER_GRADIENT = `linear-gradient(135deg, ${GOLD}, ${AMBER})`
const GLASS_BLUR = 'blur(18px) saturate(140%)'

function SR({ children }) {
  return <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>{children}</span>
}

// Empty-state quick actions — varied visual weight instead of identical
// cards, so the grid doesn't read as a templated "SaaS card kit".
const QUICK_ACTIONS = [
  { text: "What's on the menu today?", icon: 'utensils', color: GOLD, big: true },
  { text: "Where is RC18?", icon: 'file', color: TEAL },
  { text: "How do I register my units?", icon: 'cap', color: '#B794F6' },
  { text: "When does registration close?", icon: 'calendar', color: '#4ADE80' },
  { text: "I want to submit a complaint", icon: 'file', color: ERROR },
  { text: "I'm a first-year student", icon: 'star', color: AMBER },
]

// Reveals text progressively on mount, with a blinking cursor while
// revealing, rather than all at once. Caps total duration so long
// replies don't feel sluggish.
function StreamingText({ text }) {
  const [count, setCount] = useState(0)
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!text || reduceMotion) { setCount(text?.length ?? 0); return }
    const totalMs = Math.min(900, Math.max(150, text.length * 8))
    const stepMs = Math.max(8, totalMs / text.length)
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) { clearInterval(id); return c }
        return c + 1
      })
    }, stepMs)
    return () => clearInterval(id)
     
  }, [])

  const done = count >= (text?.length ?? 0)
  return (
    <>
      {text.slice(0, count)}
      {!done && (
        <span aria-hidden="true" style={{
          display: 'inline-block', width: 2, height: '1em', marginLeft: 1, verticalAlign: 'text-bottom',
          background: GOLD, animation: 'curryCursor 0.9s steps(1) infinite',
        }} />
      )}
    </>
  )
}

function SourceChips({ sources }) {
  if (!sources || sources.length === 0) return null
  // Abstracted: never surface a raw scraped URL to the student — a clean
  // human-readable label only, deduplicated across multiple matches.
  const labels = [...new Set(sources.map((s) => s.authority || 'DeKUT Official Website'))]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
      {labels.map((label, i) => (
        <span key={i} style={{
          fontSize: 10.5, fontWeight: 600, color: TEXT_SECONDARY,
          border: `1px solid ${BORDER}`, borderRadius: 999, padding: '3px 9px',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: '50%', background: TEAL, flexShrink: 0 }} />
          {label}
        </span>
      ))}
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handle = useCallback(() => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }, [text])
  return (
    <button
      onClick={handle}
      aria-label="Copy message"
      className="curry-copy-btn"
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6,
        color: copied ? TEAL : TEXT_TERTIARY, display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 10.5, fontWeight: 600, opacity: 0, transition: 'opacity 140ms ease, color 140ms ease',
      }}
    >
      <DekutIcon type={copied ? 'check' : 'copy'} size={11} color="currentColor" strokeWidth={2.2} />
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function MessageBubble({ message, sending, onOpenService, onConfirm, onIntent }) {
  const isUser = message.role === 'user'
  const wide = ['SHOW_MENU', 'CATERING_DETAILS_REQUIRED', 'CATERING_CONFIRM_REQUIRED', 'CATERING_ORDER_PLACED'].includes(message.action?.type)
  return (
    <div
      className="curry-msg-row"
      style={{
        display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8,
        animation: 'curryMsgIn 260ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {!isUser && (
        <div style={{ width: 24, height: 24, flexShrink: 0, marginBottom: 2 }}>
          <CurryOrbGraphic size={24} state="idle" animate={false} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: wide ? '100%' : '80%', minWidth: 0, flex: wide ? '1 1 auto' : undefined }}>
        <div style={{
          background: isUser ? USER_GRADIENT : SURFACE,
          backdropFilter: isUser ? undefined : GLASS_BLUR,
          WebkitBackdropFilter: isUser ? undefined : GLASS_BLUR,
          border: isUser ? 'none' : `1px solid ${BORDER}`,
          boxShadow: isUser
            ? `0 4px 18px -6px rgba(217,98,43,0.45)`
            : 'inset 0 1px 0 rgba(255,255,255,0.03), 0 2px 10px -6px rgba(0,0,0,0.5)',
          color: isUser ? '#1A1006' : message.error ? ERROR : TEXT_PRIMARY,
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding: '11px 14px', fontSize: 13.5, lineHeight: 1.55, fontWeight: isUser ? 600 : 400,
        }}>
          <div style={{ whiteSpace: 'pre-line' }}>
            {isUser || message.error ? message.text : <StreamingText text={message.text} />}
          </div>
          {!isUser && <SourceChips sources={message.sources} />}
          {!isUser && (
            <ActionCard
              action={message.action}
              message={message}
              sending={sending}
              onOpenService={onOpenService}
              onConfirm={onConfirm}
              onIntent={onIntent}
            />
          )}
        </div>
        {!isUser && !message.error && message.text && (
          <div style={{ marginLeft: 4, marginTop: 2 }}>
            <CopyButton text={message.text} />
          </div>
        )}
      </div>
    </div>
  )
}

// The empty-state hero. Ambient rings behind the orb extend its own
// visual language; quick actions vary in emphasis (one larger "hero"
// action, five standard) rather than a uniform identical grid.
function CurryHero({ onQuickAction }) {
  return (
    <div style={{ position: 'relative', textAlign: 'center', padding: '34px 4px 6px' }}>
      <div aria-hidden="true" style={{
        position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
        width: 280, height: 280, pointerEvents: 'none',
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            position: 'absolute', inset: i * 44, borderRadius: '50%',
            border: `1px dashed rgba(242,169,59,${0.16 - i * 0.04})`,
          }} />
        ))}
        <div style={{
          position: 'absolute', inset: 60, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(242,169,59,0.14) 0%, transparent 70%)`,
        }} />
      </div>

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <CurryOrbGraphic size={84} state="idle" animate />
      </div>

      <div style={{ position: 'relative', fontSize: 18, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 6, letterSpacing: '-0.01em' }}>
        Hey! I'm Curry.
      </div>
      <div style={{ position: 'relative', fontSize: 12.5, color: TEXT_SECONDARY, marginBottom: 22, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>
        Ask me about registration, exams and academics, campus locations, catering, or file a complaint or feedback — I'll point you the right way.
      </div>

      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 9, textAlign: 'left' }}>
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.text}
            onClick={() => onQuickAction(qa.text)}
            className="curry-quick-action"
            style={{
              gridColumn: qa.big ? 'span 2' : 'span 1',
              display: 'flex', alignItems: 'center', gap: 10,
              background: qa.big ? `linear-gradient(120deg, rgba(242,169,59,0.14), rgba(217,98,43,0.06))` : SURFACE,
              backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
              border: `1px solid ${qa.big ? 'rgba(242,169,59,0.28)' : BORDER}`,
              borderRadius: 14, padding: qa.big ? '13px 14px' : '10px 12px',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              transition: 'transform 180ms cubic-bezier(0.16,1,0.3,1), border-color 180ms ease, box-shadow 180ms ease',
            }}
          >
            <div style={{
              width: qa.big ? 34 : 30, height: qa.big ? 34 : 30, borderRadius: 10, flexShrink: 0,
              background: `${qa.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <DekutIcon type={qa.icon} size={qa.big ? 17 : 15} color={qa.color} strokeWidth={2.2} />
            </div>
            <span style={{ fontSize: qa.big ? 13 : 12, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.3 }}>{qa.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: 8, animation: 'curryMsgIn 200ms ease' }}>
      <div style={{ width: 24, height: 24, flexShrink: 0, marginBottom: 2 }}>
        <CurryOrbGraphic size={24} state="thinking" animate />
      </div>
      <div style={{
        background: SURFACE, backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
        border: `1px solid ${BORDER}`, borderRadius: '16px 16px 16px 4px', padding: '12px 15px',
        display: 'flex', gap: 5, alignItems: 'center',
      }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 5.5, height: 5.5, borderRadius: '50%', background: GOLD,
            animation: `curryBounce 1.1s ${i * 0.15}s infinite ease-in-out`,
          }} />
        ))}
      </div>
    </div>
  )
}

function VoiceMode({ voice }) {
  const { supported, listening, thinking, speaking, volume, transcript, error, cancelSpeech } = voice

  // Nothing to tap during listening/thinking — the loop is automatic.
  // The only interactive moment is barge-in: tap to interrupt Curry
  // mid-sentence and jump straight back to listening.
  const handleOrbTap = () => {
    if (speaking) cancelSpeech()
  }

  if (!supported) {
    return (
      <div style={{ textAlign: 'center', padding: '44px 20px', color: TEXT_SECONDARY, fontSize: 13 }}>
        Voice mode isn't supported in this browser — it needs microphone access.
      </div>
    )
  }

  const orbState = listening ? 'listening' : thinking ? 'thinking' : speaking ? 'speaking' : 'idle'
  const glowColor = {
    idle: 'rgba(242,169,59,0.28)',
    listening: 'rgba(45,212,191,0.4)',
    thinking: 'rgba(242,169,59,0.4)',
    speaking: 'rgba(217,98,43,0.4)',
  }[orbState]
  const caption = listening
    ? 'Listening…'
    : thinking
      ? 'Thinking…'
      : speaking
        ? (transcript ? `You said: "${transcript}"` : 'Curry is speaking…')
        : error || 'Starting up…'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 320, gap: 26 }}>
      <button
        onClick={handleOrbTap}
        aria-label={speaking ? 'Stop Curry speaking' : 'Curry voice'}
        style={{
          width: 180, height: 180, borderRadius: '50%', border: 'none',
          cursor: speaking ? 'pointer' : 'default',
          background: 'transparent', boxShadow: `0 0 70px 14px ${glowColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'box-shadow 240ms ease',
        }}
      >
        <CurryOrbGraphic size={160} state={orbState} volume={volume} animate />
      </button>
      <div style={{
        fontSize: 13.5, color: (!listening && !thinking && !speaking && error) ? ERROR : TEXT_PRIMARY,
        textAlign: 'center', maxWidth: 300, lineHeight: 1.55, minHeight: 40, fontWeight: 500,
      }}>
        {caption}
      </div>
    </div>
  )
}

export default function AskCurry({ userId, onNavigate, onClose }) {
  const { messages, sending, sendMessage, sendIntent, confirmAction, declineAction } = useCurryChat({ userId })
  const voice = useCurryVoice()
  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [mode, setMode] = useState('chat') // 'chat' | 'voice'
  const scrollRef = useRef(null)
  const usage = useDekutUsage('dekut')
  const handleVoiceTurnRef = useRef(null) // always points at the latest handleVoiceTurn, so the loop never calls a stale closure

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // Sends the transcribed speech to Curry and hands the reply text back
  // to useCurryVoice, which speaks it and then resumes listening.
  const handleVoiceTurn = useCallback(async (text) => {
    const last = messages[messages.length - 1]
    const action = last?.role === 'assistant' && !last?.confirmed ? last?.action : null
    const said = text.trim().toLowerCase()
    const isYes = /^(yes|yeah|yep|sure|go ahead|okay|ok|confirm|place it|do it)\b/.test(said)
    const isNo = /^(no|nope|not now|cancel|stop)\b/.test(said)

    if (action?.type === 'CATERING_USE_SAVED_REQUIRED' && (isYes || isNo)) {
      return sendIntent(
        { intent: 'catering_use_saved', draft: action.draft, use_saved: isYes },
        isYes ? 'Yes, the usual' : 'Different details',
        last.id
      )
    }
    if ((action?.type === 'CATERING_CONFIRM_REQUIRED' || action?.type === 'CONFIRM_REQUIRED') && (isYes || isNo)) {
      if (isYes) return confirmAction(last.id, action)
      declineAction(last.id)
      return 'Okay, cancelled.'
    }
    return sendMessage(text)
  }, [messages, sendMessage, sendIntent, confirmAction, declineAction])
  handleVoiceTurnRef.current = handleVoiceTurn

  // Stable indirection so the loop (started once per mode change) always
  // calls whatever handleVoiceTurn currently is, not a stale closure.
  const callLatestVoiceTurn = useCallback((text) => handleVoiceTurnRef.current(text), [])

  useEffect(() => {
    const last = messages[messages.length - 1]
    const navTypes = ['SHOW_MENU', 'CATERING_DETAILS_REQUIRED', 'CATERING_CONFIRM_REQUIRED', 'CATERING_USE_SAVED_REQUIRED']
    if (mode === 'voice' && last?.role === 'assistant' && navTypes.includes(last.action?.type)) {
      setMode('chat')
    }
  }, [messages, mode])

  // Starts/stops the whole listen -> transcribe -> reply -> speak loop
  // as the student switches tabs — the loop itself is fully owned by
  // useCurryVoice now, this just turns it on/off.
  useEffect(() => {
    if (mode === 'voice') {
      voice.start(callLatestVoiceTurn)
    } else {
      voice.stop()
    }
    return () => voice.stop()
   
  }, [mode])

  const handleSend = (text) => {
    const value = (text ?? input).trim()
    if (!value) return
    sendMessage(value)
    setInput('')
  }

  // For SHOW_LOCATION/SHOW_ROUTE, forwards origin/destination/location
  // data as a third onNavigate argument, so whatever mounts RoomFinder
  // can pass originLocationId/destinationLocationId into DekutCampusMap
  // and it opens already routed. RoomFinder.jsx and PulsePage's
  // onNavigate handler need a small update to actually read this third
  // argument — right now it's forwarded as far as this component reaches.
  const handleOpenService = (serviceId, action) => {
    const service = getServiceById(serviceId, DEKUT_CATEGORIES)
    if (!service) return
    const routeContext = action?.type === 'SHOW_ROUTE'
      ? { originLocationId: action.origin?.id, destinationLocationId: action.destination?.id }
      : action?.type === 'SHOW_LOCATION'
        ? { destinationLocationId: action.location?.id }
        : undefined
    openDekutService(service, { usage, onNavigate: routeContext ? (route, svc) => onNavigate?.(route, svc, routeContext) : onNavigate })
  }

  const handleConfirm = (messageId, action) => {
    if (action) confirmAction(messageId, action)
    else declineAction(messageId)
  }

  // The cards call onIntent(payload, { userText, replaceMessageId }).
  // useCurryChat's sendIntent takes (payload, summary, messageId).
  const handleIntent = (payload, options = {}) => {
    sendIntent(payload, options.userText ?? null, options.replaceMessageId ?? null)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%', background: BASE, position: 'relative' }}>
      {/* ambient top glow — one deliberate lighting moment, not scattered decoration */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
        width: 420, height: 200, background: `radial-gradient(ellipse, rgba(242,169,59,0.10) 0%, transparent 72%)`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, padding: '2px 2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div aria-hidden="true" style={{ width: 38, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CurryOrbGraphic size={38} state="idle" animate={false} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}>Curry</div>
            <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>Your DeKUT campus assistant</div>
          </div>
        </div>
        {typeof onClose === 'function' && (
          <button
            onClick={onClose}
            aria-label="Close Ask Curry"
            className="curry-icon-btn"
            style={{
              background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              transition: 'border-color 160ms ease, background 160ms ease',
            }}
          >
            <DekutIcon type="x" size={16} color={TEXT_PRIMARY} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {voice.supported && (
        <div style={{
          position: 'relative', zIndex: 1, display: 'flex', background: SURFACE,
          backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
          border: `1px solid ${BORDER}`, borderRadius: 999, padding: 3, marginTop: 14, width: 200,
        }}>
          <div aria-hidden="true" style={{
            position: 'absolute', top: 3, bottom: 3, left: mode === 'chat' ? 3 : 'calc(50% + 0px)',
            width: 'calc(50% - 6px)', borderRadius: 999,
            background: USER_GRADIENT,
            boxShadow: '0 2px 10px -4px rgba(217,98,43,0.5)',
            transition: 'left 220ms cubic-bezier(0.34,1.56,0.64,1)',
          }} />
          {[{ id: 'chat', label: 'Chat' }, { id: 'voice', label: 'Voice' }].map((t) => (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              aria-pressed={mode === t.id}
              style={{
                position: 'relative', zIndex: 1, flex: 1,
                fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                border: 'none', borderRadius: 999, padding: '6px 0',
                background: 'transparent',
                color: mode === t.id ? '#1A1006' : TEXT_SECONDARY,
                transition: 'color 160ms ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {mode === 'voice' ? (
        <VoiceMode voice={voice} />
      ) : (
        <>
          <div ref={scrollRef} className="curry-scroll" style={{
            position: 'relative', zIndex: 1,
            flex: 1, minHeight: 260, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 12,
            border: `1px solid ${BORDER}`, borderRadius: 18, padding: 15,
            background: 'rgba(255,255,255,0.015)', margin: '16px 0 10px',
          }}>
            {messages.length === 0 && <CurryHero onQuickAction={handleSend} />}

            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                sending={sending}
                onOpenService={handleOpenService}
                onConfirm={handleConfirm}
                onIntent={handleIntent}
              />
            ))}
            {sending && <TypingIndicator />}
          </div>

          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center', gap: 8, borderRadius: 14, padding: '10px 13px',
            background: SURFACE_RAISED, backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
            border: `1px solid ${inputFocused ? 'rgba(242,169,59,0.55)' : BORDER}`,
            boxShadow: inputFocused ? `0 0 0 3px rgba(242,169,59,0.14)` : 'none',
            transition: 'border-color 180ms ease, box-shadow 180ms ease',
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Ask Curry anything about DeKUT..."
              aria-label="Message Curry"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: TEXT_PRIMARY, width: '100%', fontFamily: 'inherit' }}
            />
            <button
              onClick={() => handleSend()}
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="curry-send-btn"
              style={{
                background: USER_GRADIENT, border: 'none', borderRadius: 10, width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: sending || !input.trim() ? 'default' : 'pointer',
                opacity: sending || !input.trim() ? 0.4 : 1, flexShrink: 0,
                boxShadow: sending || !input.trim() ? 'none' : '0 3px 12px -4px rgba(217,98,43,0.6)',
                transition: 'opacity 160ms ease, transform 120ms ease, box-shadow 160ms ease',
              }}
            >
              <DekutIcon type="chevronRight" size={15} color="#1A1006" strokeWidth={2.6} />
            </button>
          </div>

          <div style={{
            position: 'relative', zIndex: 1, marginTop: 10, borderRadius: 14, border: `1px dashed ${BORDER}`,
            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>Curry not finding what you need?</div>
            </div>
            <a href="mailto:studentadmin@dkut.ac.ke" style={{ fontSize: 11.5, fontWeight: 700, color: GOLD, textDecoration: 'none', flexShrink: 0 }}>
              Email ICT
            </a>
          </div>
        </>
      )}

      <style>{`
        @keyframes curryMsgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes curryBounce { 0%, 80%, 100% { opacity: 0.35; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
        @keyframes curryCursor { 0%, 45% { opacity: 1; } 50%, 100% { opacity: 0; } }

        .curry-msg-row:hover .curry-copy-btn { opacity: 1; }
        .curry-copy-btn:hover { color: ${GOLD}; }

        .curry-quick-action:hover {
          transform: translateY(-2px);
          border-color: rgba(242,169,59,0.5);
          box-shadow: 0 10px 24px -12px rgba(242,169,59,0.35);
        }
        .curry-quick-action:focus-visible,
        .curry-icon-btn:focus-visible,
        .curry-send-btn:focus-visible,
        button:focus-visible,
        input:focus-visible {
          outline: 2px solid ${GOLD};
          outline-offset: 2px;
        }

        .curry-icon-btn:hover { border-color: ${BORDER_STRONG}; background: ${SURFACE_RAISED}; }
        .curry-send-btn:not(:disabled):active { transform: scale(0.94); }

        .curry-scroll::-webkit-scrollbar { width: 6px; }
        .curry-scroll::-webkit-scrollbar-thumb { background: rgba(245,241,232,0.14); border-radius: 999px; }
        .curry-scroll::-webkit-scrollbar-track { background: transparent; }

        @media (prefers-reduced-motion: reduce) {
          .curry-msg-row, .curry-quick-action { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  )
}
