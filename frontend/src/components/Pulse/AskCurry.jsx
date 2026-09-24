// src/components/Pulse/AskCurry.jsx
//
// Curry's chat surface — v2.
//
// DESIGN NOTES
// ─────────────────────────────────────────────
// Matched back to Mattchat's actual brand (dark navy base, violet
// accent #6C63FF / #A78BFA — the same colors CurryOrb.jsx already
// uses), not a departure from it. Two structural changes from v1:
//
// 1. No boxed chat container. The old bordered/backgrounded scroll
//    panel made this read as an embedded widget floating on top of the
//    app rather than part of it. Messages now sit directly on the
//    page background — the surrounding Pulse chrome shows through.
//    Only actual UI controls (input bar, action cards) still get a
//    surface, because those are interactive, not just "reading" content.
//
// 2. ChatGPT-pattern message layout: assistant replies are plain text
//    (no bubble), user messages keep a bubble (right-aligned, violet
//    gradient). Every message gets a hover-revealed action row —
//    Edit + Copy on user turns, Copy + Regenerate + feedback + Share on
//    assistant turns — and the latest assistant reply offers 2–3
//    tappable follow-up questions, the way modern assistants surface
//    "people also ask" style suggestions instead of leaving you staring
//    at a blank input.
//
// Two modes, unchanged:
//   - Chat: as above, plus client-side streaming reveal on assistant
//     replies (backend returns one full response — this reveals it
//     progressively for a more alive feel).
//   - Voice: push-to-talk loop; orb reflects live mic amplitude while
//     listening and speaks the reply aloud. Falls back to chat-only if
//     the browser doesn't support mic access (useCurryVoice.supported).

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import CurryOrbGraphic from './CurryOrbGraphic'
import { useCurryChat } from '../../hooks/useCurryChat'
import { useCurryVoice } from '../../hooks/useCurryVoice'
import { DEKUT_CATEGORIES, getServiceById } from '../../data/dekutServices'
import { useDekutUsage } from '../../hooks/useDekutUsage'
import { openDekutService } from '../../utils/dekutOpenService'
import ActionCard from './CurryCateringCards'

// ── Design tokens — matched to CurryOrb.jsx / Mattchat's brand theme ──
const TEXT_PRIMARY = '#f5f5fa'
const TEXT_SECONDARY = 'rgba(245,245,250,0.6)'
const TEXT_TERTIARY = 'rgba(245,245,250,0.4)'
const BORDER = 'rgba(245,245,250,0.14)'
const BORDER_STRONG = 'rgba(245,245,250,0.22)'
const SURFACE = 'rgba(245,245,250,0.055)'
const SURFACE_RAISED = 'rgba(245,245,250,0.08)'
const VIOLET = '#6C63FF'
const VIOLET_LIGHT = '#A78BFA'
const CYAN = '#22D3EE'
const AMBER = '#F59E0B'
const CORAL = '#FB7185'
const USER_GRADIENT = `linear-gradient(135deg, ${VIOLET_LIGHT}, ${VIOLET})`
const GLASS_BLUR = 'blur(16px) saturate(140%)'

// ── Minimal inline icon set for the new message-action row ─────────────
// Self-contained (not routed through DekutIcon) so this doesn't depend
// on icon keys that may not exist in your icon registry yet.
function MiniIcon({ children, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}
const IconCopy = (p) => <MiniIcon {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></MiniIcon>
const IconCheck = (p) => <MiniIcon {...p}><path d="M20 6 9 17l-5-5" /></MiniIcon>
const IconEdit = (p) => <MiniIcon {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></MiniIcon>
const IconRefresh = (p) => <MiniIcon {...p}><path d="M21 12a9 9 0 0 1-15.3 6.4L3 15" /><path d="M3 12a9 9 0 0 1 15.3-6.4L21 9" /><path d="M21 3v6h-6" /><path d="M3 21v-6h6" /></MiniIcon>
const IconThumbUp = (p) => <MiniIcon {...p}><path d="M7 10v11" /><path d="M15 5.88 14 10h6.3a1.7 1.7 0 0 1 1.62 2.2l-2.13 7A2 2 0 0 1 17.86 21H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 .58-1.41L11 5a1.7 1.7 0 0 1 2.83.05L15 5.88Z" /></MiniIcon>
const IconThumbDown = (p) => <MiniIcon {...p}><path d="M17 14V3" /><path d="M9 18.12 10 14H3.7a1.7 1.7 0 0 1-1.62-2.2l2.13-7A2 2 0 0 1 6.14 3H17a2 2 0 0 1 2 2v7a2 2 0 0 1-.58 1.41L13 19a1.7 1.7 0 0 1-2.83-.05L9 18.12Z" /></MiniIcon>
const IconShare = (p) => <MiniIcon {...p}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5 15.4 17.5" /><path d="M15.4 6.5 8.6 10.5" /></MiniIcon>

function ActionBtn({ onClick, active, activeColor, label, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="curry-action-btn"
      style={{
        background: 'transparent', border: 'none', cursor: disabled ? 'default' : 'pointer',
        padding: 5, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: active ? activeColor : TEXT_TERTIARY, transition: 'color 140ms ease, background 140ms ease',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

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
          background: VIOLET_LIGHT, animation: 'curryCursor 0.9s steps(1) infinite',
        }} />
      )}
    </>
  )
}

function SourceChips({ sources }) {
  if (!sources || sources.length === 0) return null
  const labels = [...new Set(sources.map((s) => s.authority || 'DeKUT Official Website'))]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
      {labels.map((label, i) => (
        <span key={i} style={{
          fontSize: 10.5, fontWeight: 600, color: TEXT_SECONDARY,
          border: `1px solid ${BORDER}`, borderRadius: 999, padding: '3px 9px',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: '50%', background: CYAN, flexShrink: 0 }} />
          {label}
        </span>
      ))}
    </div>
  )
}

// ── Follow-up suggestions ──────────────────────────────────────────────
// Contextual "people also ask" style chips under the latest reply.
// Picks from a domain-specific pool when the reply carries a known
// action type, otherwise falls back to a general FAQ pool — and never
// repeats the question that was just asked.
const GENERAL_FOLLOWUPS = [
  "How do I register my units?",
  "Where is the library?",
  "When does registration close?",
  "What's on the menu today?",
  "How do I file a complaint?",
  "Where do I collect my student ID?",
]
const FOLLOWUPS_BY_ACTION = {
  SHOW_MENU: ["How much is chapati?", "What's in Mess B?", "Order me the usual"],
  CATERING_ORDER_PLACED: ["Check my order status", "Order something else", "What's on the menu tomorrow?"],
  SHOW_LOCATION: ["How do I get there from the library?", "What else is nearby?"],
  SHOW_ROUTE: ["Is there a faster way?", "What's nearby the destination?"],
  OPEN_SUPPORT: ["Check my ticket status", "How long do tickets usually take?"],
}
const PENDING_ACTION_TYPES = new Set([
  'CATERING_DETAILS_REQUIRED', 'CATERING_CONFIRM_REQUIRED', 'CATERING_USE_SAVED_REQUIRED', 'CONFIRM_REQUIRED',
])

function getFollowups(message, lastAskedText) {
  if (!message || message.error || PENDING_ACTION_TYPES.has(message.action?.type)) return []
  const pool = FOLLOWUPS_BY_ACTION[message.action?.type] || GENERAL_FOLLOWUPS
  const asked = (lastAskedText || '').trim().toLowerCase()
  return pool.filter((q) => q.toLowerCase() !== asked).slice(0, 3)
}

function FollowupChips({ questions, onPick }) {
  if (!questions || questions.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 11 }}>
      {questions.map((q) => (
        <button
          key={q}
          onClick={() => onPick(q)}
          className="curry-followup-chip"
          style={{
            background: SURFACE, backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
            border: `1px solid ${BORDER}`, borderRadius: 999, padding: '7px 13px',
            fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'border-color 160ms ease, background 160ms ease, transform 160ms ease',
          }}
        >
          {q}
        </button>
      ))}
    </div>
  )
}

function CopyIconButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handle = useCallback((e) => {
    e.stopPropagation()
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1300)
    })
  }, [text])
  return (
    <ActionBtn onClick={handle} active={copied} activeColor={CYAN} label={copied ? 'Copied' : 'Copy'}>
      {copied ? <IconCheck /> : <IconCopy />}
    </ActionBtn>
  )
}

function ShareButton({ text }) {
  const [done, setDone] = useState(false)
  const handle = useCallback(async (e) => {
    e.stopPropagation()
    if (navigator.share) {
      try { await navigator.share({ text }); return } catch { /* cancelled — fall through to copy */ }
    }
    navigator.clipboard?.writeText(text).then(() => {
      setDone(true)
      setTimeout(() => setDone(false), 1300)
    })
  }, [text])
  return (
    <ActionBtn onClick={handle} active={done} activeColor={CYAN} label={done ? 'Copied to share' : 'Share'}>
      {done ? <IconCheck /> : <IconShare />}
    </ActionBtn>
  )
}

// ── Assistant message — plain text, no bubble, ChatGPT-style action row ─
function AssistantMessage({ message, isLast, sending, onOpenService, onConfirm, onIntent, onRegenerate, onFollowup, lastUserText }) {
  const [feedback, setFeedback] = useState(null) // 'up' | 'down' | null — local UX signal only, not yet persisted server-side
  const followups = isLast && !sending ? getFollowups(message, lastUserText) : []

  return (
    <div className="curry-msg-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, animation: 'curryMsgIn 260ms cubic-bezier(0.16,1,0.3,1)' }}>
      <div style={{ width: 24, height: 24, flexShrink: 0, marginTop: 2 }}>
        <CurryOrbGraphic size={24} state="idle" animate={false} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, lineHeight: 1.6, color: message.error ? CORAL : TEXT_PRIMARY,
          whiteSpace: 'pre-line',
        }}>
          {message.error ? message.text : <StreamingText text={message.text} />}
        </div>

        <SourceChips sources={message.sources} />

        <ActionCard
          action={message.action}
          message={message}
          sending={sending}
          onOpenService={onOpenService}
          onConfirm={onConfirm}
          onIntent={onIntent}
        />

        {!message.error && message.text && (
          <div className="curry-action-row" style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 6, marginLeft: -5 }}>
            <CopyIconButton text={message.text} />
            {isLast && (
              <ActionBtn onClick={onRegenerate} label="Regenerate response" disabled={sending}>
                <IconRefresh />
              </ActionBtn>
            )}
            <ActionBtn
              onClick={() => setFeedback((f) => (f === 'up' ? null : 'up'))}
              active={feedback === 'up'} activeColor="#4ADE80" label="Good response"
            >
              <IconThumbUp />
            </ActionBtn>
            <ActionBtn
              onClick={() => setFeedback((f) => (f === 'down' ? null : 'down'))}
              active={feedback === 'down'} activeColor={CORAL} label="Bad response"
            >
              <IconThumbDown />
            </ActionBtn>
            <ShareButton text={message.text} />
          </div>
        )}

        <FollowupChips questions={followups} onPick={onFollowup} />
      </div>
    </div>
  )
}

// ── User message — bubble, hover-reveal Edit + Copy, inline edit mode ──
function UserMessage({ message, onEdit, sending }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.text)
  const taRef = useRef(null)

  useEffect(() => {
    if (editing) { taRef.current?.focus(); taRef.current?.setSelectionRange(draft.length, draft.length) }
    
  }, [editing])

  const save = () => {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === message.text) { setEditing(false); setDraft(message.text); return }
    onEdit(message.id, trimmed)
    setEditing(false)
  }
  const cancel = () => { setDraft(message.text); setEditing(false) }

  return (
    <div className="curry-msg-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', animation: 'curryMsgIn 260ms cubic-bezier(0.16,1,0.3,1)' }}>
      {editing ? (
        <div style={{ width: '100%', maxWidth: '84%' }}>
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
              if (e.key === 'Escape') cancel()
            }}
            rows={Math.min(6, Math.max(1, draft.split('\n').length))}
            style={{
              width: '100%', resize: 'none', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.55,
              color: TEXT_PRIMARY, background: SURFACE_RAISED, border: `1px solid ${VIOLET_LIGHT}`,
              borderRadius: '16px 16px 4px 16px', padding: '11px 14px', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button onClick={cancel} style={{ fontSize: 12, fontWeight: 600, color: TEXT_SECONDARY, background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px 10px' }}>
              Cancel
            </button>
            <button onClick={save} style={{
              fontSize: 12, fontWeight: 700, color: '#fff', background: USER_GRADIENT, border: 'none',
              borderRadius: 8, cursor: 'pointer', padding: '6px 13px',
            }}>
              Save &amp; submit
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{
            maxWidth: '80%', background: USER_GRADIENT, color: '#fff',
            borderRadius: '16px 16px 4px 16px', padding: '11px 14px', fontSize: 13.5, lineHeight: 1.55, fontWeight: 500,
            boxShadow: `0 4px 16px -6px rgba(108,99,255,0.5)`,
          }}>
            <div style={{ whiteSpace: 'pre-line' }}>{message.text}</div>
          </div>
          <div className="curry-action-row" style={{ display: 'flex', gap: 2, marginTop: 4, marginRight: 2 }}>
            {message.edited && <span style={{ fontSize: 10.5, color: TEXT_TERTIARY, alignSelf: 'center', marginRight: 4 }}>edited</span>}
            <ActionBtn onClick={() => setEditing(true)} label="Edit message" disabled={sending}><IconEdit /></ActionBtn>
            <CopyIconButton text={message.text} />
          </div>
        </>
      )}
    </div>
  )
}

// The empty-state hero. Ambient rings behind the orb extend its own
// visual language; quick actions vary in emphasis rather than a uniform
// identical grid.
const QUICK_ACTIONS = [
  { text: "What's on the menu today?", icon: 'utensils', color: VIOLET_LIGHT, big: true },
  { text: "Where is RC18?", icon: 'file', color: CYAN },
  { text: "How do I register my units?", icon: 'cap', color: VIOLET },
  { text: "When does registration close?", icon: 'calendar', color: '#4ADE80' },
  { text: "I want to submit a complaint", icon: 'file', color: CORAL },
  { text: "I'm a first-year student", icon: 'star', color: AMBER },
]

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
            border: `1px dashed rgba(167,139,250,${0.16 - i * 0.04})`,
          }} />
        ))}
      </div>

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <CurryOrbGraphic size={84} state="idle" animate />
      </div>

      <div style={{ position: 'relative', fontSize: 17, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 6 }}>Hey! I'm Curry.</div>
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
              background: qa.big ? `linear-gradient(120deg, rgba(167,139,250,0.16), rgba(108,99,255,0.06))` : SURFACE,
              backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
              border: `1px solid ${qa.big ? 'rgba(167,139,250,0.32)' : BORDER}`,
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
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, animation: 'curryMsgIn 200ms ease' }}>
      <div style={{ width: 24, height: 24, flexShrink: 0, marginTop: 2 }}>
        <CurryOrbGraphic size={24} state="thinking" animate />
      </div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', paddingTop: 6 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 5.5, height: 5.5, borderRadius: '50%', background: VIOLET_LIGHT,
            animation: `curryBounce 1.1s ${i * 0.15}s infinite ease-in-out`,
          }} />
        ))}
      </div>
    </div>
  )
}

function VoiceMode({ voice }) {
  const { supported, listening, thinking, speaking, volume, transcript, error, cancelSpeech } = voice
  const handleOrbTap = () => { if (speaking) cancelSpeech() }

  if (!supported) {
    return (
      <div style={{ textAlign: 'center', padding: '44px 20px', color: TEXT_SECONDARY, fontSize: 13 }}>
        Voice mode isn't supported in this browser — it needs microphone access.
      </div>
    )
  }

  const orbState = listening ? 'listening' : thinking ? 'thinking' : speaking ? 'speaking' : 'idle'
  const glowColor = {
    idle: 'rgba(167,139,250,0.3)', listening: 'rgba(34,211,238,0.4)',
    thinking: 'rgba(245,158,11,0.4)', speaking: 'rgba(251,113,133,0.4)',
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
        fontSize: 13.5, color: (!listening && !thinking && !speaking && error) ? CORAL : TEXT_PRIMARY,
        textAlign: 'center', maxWidth: 300, lineHeight: 1.55, minHeight: 40, fontWeight: 500,
      }}>
        {caption}
      </div>
    </div>
  )
}

export default function AskCurry({ userId, onNavigate, onClose }) {
  const { messages, sending, sendMessage, sendIntent, confirmAction, declineAction, editUserMessage, regenerateLast } = useCurryChat({ userId })
  const voice = useCurryVoice()
  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [mode, setMode] = useState('chat') // 'chat' | 'voice'
  const scrollRef = useRef(null)
  const usage = useDekutUsage('dekut')
  const handleVoiceTurnRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const awaitingNumberRef = useRef(null) // { draft, messageId } while we're waiting to hear a number

  const WORD_DIGITS = { zero: 0, oh: 0, o: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 }
  const spokenToDigits = (s) => {
    const fromWords = s.toLowerCase().split(/[\s,.-]+/).map((w) => (w in WORD_DIGITS ? WORD_DIGITS[w] : /^\d+$/.test(w) ? w : '')).join('')
    return fromWords.replace(/\D/g, '')
  }

  const handleVoiceTurn = useCallback(async (text) => {
    const said = text.trim().toLowerCase()
    const isYes = /^(yes|yeah|yep|sure|go ahead|okay|ok|confirm|place it|do it)\b/.test(said)
    const isNo = /^(no|nope|not now|cancel|stop)\b/.test(said)

    // Waiting for a number: this turn IS the number.
    if (awaitingNumberRef.current) {
      const { draft, messageId } = awaitingNumberRef.current
      if (/\b(cancel|never mind|forget it)\b/.test(said)) {
        awaitingNumberRef.current = null
        declineAction(messageId)
        return 'Okay, cancelled.'
      }
      const digits = spokenToDigits(text)
      const ok = /^(0[17]\d{8}|254[17]\d{8}|[17]\d{8})$/.test(digits)
      if (!ok) return "I didn't catch a full number. Say it again, digit by digit."
      awaitingNumberRef.current = null
      return sendIntent(
        { intent: 'catering_order_with_number', draft, customer_phone: digits },
        `Send it to ${digits}`,
        messageId
      )
    }

    const last = messages[messages.length - 1]
    const action = last?.role === 'assistant' && !last?.confirmed ? last?.action : null

    if (action?.type === 'CATERING_USE_SAVED_REQUIRED' && (isYes || isNo)) {
      if (isYes) {
        return sendIntent({ intent: 'catering_use_saved', draft: action.draft, use_saved: true }, 'Yes, use my number', last.id)
      }
      awaitingNumberRef.current = { draft: action.draft, messageId: last.id }
      return 'Sure. Which number should I send it to? Say it digit by digit.'
    }
    if ((action?.type === 'CATERING_CONFIRM_REQUIRED' || action?.type === 'CONFIRM_REQUIRED') && (isYes || isNo)) {
      if (isYes) return confirmAction(last.id, action)
      declineAction(last.id)
      return 'Okay, cancelled.'
    }
    return sendMessage(text)
  }, [messages, sendMessage, sendIntent, confirmAction, declineAction])

  const callLatestVoiceTurn = useCallback((text) => handleVoiceTurnRef.current(text), [])

  useEffect(() => {
    const last = messages[messages.length - 1]
   const navTypes = ['SHOW_MENU', 'CATERING_DETAILS_REQUIRED']
    if (mode === 'voice' && last?.role === 'assistant' && navTypes.includes(last.action?.type)) {
      setMode('chat')
    }
  }, [messages, mode])

  useEffect(() => {
    if (mode === 'voice') {
      voice.start(callLatestVoiceTurn)
    } else {
      voice.stop()
      awaitingNumberRef.current = null
    }
    return () => voice.stop()
   
  }, [mode])

  const handleSend = (text) => {
    const value = (text ?? input).trim()
    if (!value) return
    sendMessage(value)
    setInput('')
  }

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

  const handleIntent = (payload, options = {}) => {
    sendIntent(payload, options.userText ?? null, options.replaceMessageId ?? null)
  }

  // Last user text, for excluding it from follow-up suggestions.
  const lastUserText = [...messages].reverse().find((m) => m.role === 'user')?.text ?? ''
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id ?? null

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div aria-hidden="true" style={{ width: 38, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CurryOrbGraphic size={38} state="idle" animate={false} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT_PRIMARY }}>Curry</div>
            <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>Your DeKUT campus assistant</div>
          </div>
        </div>
        {typeof onClose === 'function' && (
          <button onClick={onClose} aria-label="Close Ask Curry" className="curry-icon-btn" style={{
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, width: 34, height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            transition: 'border-color 160ms ease, background 160ms ease',
          }}>
            <DekutIcon type="x" size={16} color={TEXT_PRIMARY} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {voice.supported && (
        <div style={{
          position: 'relative', display: 'flex', background: SURFACE, backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
          border: `1px solid ${BORDER}`, borderRadius: 999, padding: 3, marginTop: 14, width: 200,
        }}>
          <div aria-hidden="true" style={{
            position: 'absolute', top: 3, bottom: 3, left: mode === 'chat' ? 3 : 'calc(50% + 0px)',
            width: 'calc(50% - 6px)', borderRadius: 999,
            background: USER_GRADIENT, boxShadow: '0 2px 10px -4px rgba(108,99,255,0.55)',
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
                background: 'transparent', color: mode === t.id ? '#fff' : TEXT_SECONDARY,
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
          {/* No boxed container — messages sit directly on the app background */}
          <div ref={scrollRef} className="curry-scroll" style={{
            flex: 1, minHeight: 260, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 16,
            padding: '18px 2px 6px', margin: '4px 0 10px',
          }}>
            {messages.length === 0 && <CurryHero onQuickAction={handleSend} />}

            {messages.map((m) => (
              m.role === 'user' ? (
                <UserMessage key={m.id} message={m} onEdit={editUserMessage} sending={sending} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  message={m}
                  isLast={m.id === lastAssistantId}
                  sending={sending}
                  onOpenService={handleOpenService}
                  onConfirm={handleConfirm}
                  onIntent={handleIntent}
                  onRegenerate={regenerateLast}
                  onFollowup={handleSend}
                  lastUserText={lastUserText}
                />
              )
            ))}
            {sending && <TypingIndicator />}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, borderRadius: 14, padding: '10px 13px',
            background: SURFACE_RAISED, backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
            border: `1px solid ${inputFocused ? 'rgba(167,139,250,0.55)' : BORDER}`,
            boxShadow: inputFocused ? `0 0 0 3px rgba(108,99,255,0.16)` : 'none',
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
                background: ICON_GRADIENTS?.cpu || USER_GRADIENT, border: 'none', borderRadius: 9, width: 30, height: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: sending || !input.trim() ? 'default' : 'pointer',
                opacity: sending || !input.trim() ? 0.5 : 1, flexShrink: 0,
                transition: 'opacity 160ms ease, transform 120ms ease',
              }}
            >
              <DekutIcon type="chevronRight" size={15} color="#fff" strokeWidth={2.4} />
            </button>
          </div>

          <div style={{ marginTop: 10, borderRadius: 14, border: `1px dashed ${BORDER}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>Curry not finding what you need?</div>
            </div>
            <a href="mailto:studentadmin@dkut.ac.ke" style={{ fontSize: 11.5, fontWeight: 700, color: VIOLET_LIGHT, textDecoration: 'none', flexShrink: 0 }}>
              Email ICT
            </a>
          </div>
        </>
      )}

      <style>{`
        @keyframes curryMsgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes curryBounce { 0%, 80%, 100% { opacity: 0.35; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
        @keyframes curryCursor { 0%, 45% { opacity: 1; } 50%, 100% { opacity: 0; } }

        .curry-msg-row .curry-action-row { opacity: 0.001; transition: opacity 140ms ease; }
        .curry-msg-row:hover .curry-action-row,
        .curry-msg-row:focus-within .curry-action-row { opacity: 1; }
        .curry-action-btn:hover { background: rgba(245,245,250,0.08); color: ${TEXT_PRIMARY}; }

        .curry-followup-chip:hover { border-color: rgba(167,139,250,0.5); background: rgba(245,245,250,0.09); transform: translateY(-1px); }

        .curry-quick-action:hover {
          transform: translateY(-2px);
          border-color: rgba(167,139,250,0.55);
          box-shadow: 0 10px 24px -12px rgba(108,99,255,0.4);
        }
        .curry-quick-action:focus-visible,
        .curry-icon-btn:focus-visible,
        .curry-send-btn:focus-visible,
        .curry-action-btn:focus-visible,
        .curry-followup-chip:focus-visible,
        button:focus-visible,
        input:focus-visible,
        textarea:focus-visible {
          outline: 2px solid ${VIOLET_LIGHT};
          outline-offset: 2px;
        }

        .curry-icon-btn:hover { border-color: ${BORDER_STRONG}; background: ${SURFACE_RAISED}; }
        .curry-send-btn:not(:disabled):active { transform: scale(0.94); }

        .curry-scroll::-webkit-scrollbar { width: 6px; }
        .curry-scroll::-webkit-scrollbar-thumb { background: rgba(245,245,250,0.14); border-radius: 999px; }
        .curry-scroll::-webkit-scrollbar-track { background: transparent; }

        @media (hover: none) {
          .curry-msg-row .curry-action-row { opacity: 0.7; }
        }
        @media (prefers-reduced-motion: reduce) {
          .curry-msg-row, .curry-quick-action { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  )
}
