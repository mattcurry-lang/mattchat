// src/components/Pulse/AskCurry.jsx
//
// Curry's chat surface — v3.
//
// WHAT CHANGED FROM v2
// ─────────────────────────────────────────────
// 1. BUG FIX: the hero's decorative rings were tall enough (280px) to
//    cross directly through the "Hey! I'm Curry." heading text below
//    them, garbling it. Rings now live in a fixed 140×140 box wrapped
//    tightly around just the orb — heading sits in normal flow after,
//    so it's structurally impossible for them to overlap again.
//
// 2. BUG FIX: `handleVoiceTurnRef.current = handleVoiceTurn` had been
//    dropped somewhere along the way. `callLatestVoiceTurn` calls
//    `.current(text)` on that ref — with the assignment missing, voice
//    mode would throw the instant someone spoke. Restored.
//
// 3. Chat/Voice segmented toggle removed. The input bar now mirrors
//    ChatGPT's own affordance-swap: an empty field shows a circular
//    waveform button (same role as ChatGPT's blue voice-mode launcher)
//    that becomes a send arrow the moment you start typing. Voice mode
//    gets a keyboard-icon button to return to chat — same pattern.
//
// 4. "Email ICT" moved out of a standing bottom banner into a "⋯"
//    dropdown next to the close button.
//
// 5. Follow-up chips are now picked in priority order: the specific
//    action that just resolved → keyword matches against the actual
//    reply text → general campus-FAQ pool as a last resort. Still a
//    client-side heuristic (no extra model call), but tied to what was
//    actually said instead of only the action type.
//
// 6. Typing indicator: orb (thinking state) + shimmering gradient-sweep
//    text, replacing the three bouncing dots.
//
// Two modes, same underlying behavior as before:
//   - Chat: plain-text assistant replies (no bubble), user bubble,
//     client-side streaming reveal, hover action rows (edit/copy on
//     user turns; copy/regenerate/feedback/share on assistant turns).
//   - Voice: push-to-talk loop; orb reflects live mic amplitude while
//     listening and speaks the reply aloud. Includes phone-number
//     collection by voice for catering orders (digit-by-digit, with
//     word-to-digit parsing) when the student declines their saved
//     number. Falls back to chat-only if the browser doesn't support
//     mic access (useCurryVoice.supported).

import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

// ── Minimal inline icon set — self-contained, not routed through
// DekutIcon, so it doesn't depend on icon keys that may not exist in
// your icon registry yet.
function MiniIcon({ children, size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
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
const IconWaveform = (p) => <MiniIcon {...p}><line x1="4" y1="10" x2="4" y2="14" /><line x1="8" y1="6" x2="8" y2="18" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="16" y1="6" x2="16" y2="18" /><line x1="20" y1="10" x2="20" y2="14" /></MiniIcon>
const IconKeyboard = (p) => <MiniIcon {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12" /></MiniIcon>
const IconKebab = (p) => <MiniIcon {...p} style={{ ...p.style }}><circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" /></MiniIcon>
const IconMail = (p) => <MiniIcon {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></MiniIcon>

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

// ── Header "⋯" menu — houses Email ICT (was a standing bottom banner) ──
function HeaderMenu() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="More options"
        aria-expanded={open}
        className="curry-icon-btn"
        style={{
          background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          transition: 'border-color 160ms ease, background 160ms ease', color: TEXT_PRIMARY,
        }}
      >
        <IconKebab size={16} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, minWidth: 210,
            background: SURFACE_RAISED, backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
            border: `1px solid ${BORDER}`, borderRadius: 13, padding: 6,
            boxShadow: '0 16px 36px -10px rgba(0,0,0,0.6)',
            animation: 'curryMenuIn 140ms cubic-bezier(0.16,1,0.3,1)',
          }}>
            <a
              href="mailto:studentadmin@dkut.ac.ke"
              onClick={() => setOpen(false)}
              className="curry-menu-item"
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9,
                fontSize: 12.5, fontWeight: 600, color: TEXT_PRIMARY, textDecoration: 'none',
              }}
            >
              <IconMail size={15} style={{ color: VIOLET_LIGHT, flexShrink: 0 }} />
              Email ICT support
            </a>
            <div style={{ fontSize: 10.5, color: TEXT_TERTIARY, padding: '7px 10px 4px', lineHeight: 1.4 }}>
              Curry can make mistakes — check anything important.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Returns the revealed slice + whether it's done, instead of rendering
// raw text itself — the caller pipes the slice through ReactMarkdown so
// lists/bold render properly instead of showing literal ** and 1. 2. 3.
function useStreamingReveal(text) {
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
  return { revealed: text.slice(0, count), done }
}

// Markdown-rendered message body. Streams the reveal, then hands the
// revealed slice to ReactMarkdown so **bold**, numbered/bulleted lists,
// and paragraph breaks actually render instead of showing as literal
// asterisks and inline numbers in one run-on paragraph.
function MarkdownMessage({ text }) {
  const { revealed, done } = useStreamingReveal(text)
  return (
    <span className="curry-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{revealed}</ReactMarkdown>
      {!done && (
        <span aria-hidden="true" style={{
          display: 'inline-block', width: 2, height: '1em', marginLeft: 1, verticalAlign: 'text-bottom',
          background: VIOLET_LIGHT, animation: 'curryCursor 0.9s steps(1) infinite',
        }} />
      )}
    </span>
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
// Priority order: (1) the specific action that just resolved — most
// reliable signal of what actually happened; (2) keyword matches
// against the reply's own text, so chips track content rather than only
// broad category; (3) a general campus-FAQ pool as a last resort. Never
// repeats the question that was just asked. This is a client-side
// heuristic, not a semantic/model-scored match — good enough to feel
// relevant without an extra backend round trip.
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
const KEYWORD_FOLLOWUPS = [
  { re: /regist(er|ration|ering)/i, qs: ["When does registration close?", "What if I miss the deadline?"] },
  { re: /\bexam/i, qs: ["When do exams start?", "Where do I check my exam timetable?"] },
  { re: /librar/i, qs: ["What are the library hours?", "How do I borrow a book?"] },
  { re: /complaint|ticket|feedback/i, qs: ["Check my ticket status", "How long do complaints take?"] },
  { re: /portal/i, qs: ["I can't log into the portal", "How do I reset my password?"] },
  { re: /\bfee|fresher|first[- ]year/i, qs: ["How do I pay fees?", "I'm a first-year student"] },
  { re: /mess|chapati|ugali|menu|food|catering/i, qs: ["What's in Mess B?", "Order me the usual"] },
]
const PENDING_ACTION_TYPES = new Set([
  'CATERING_DETAILS_REQUIRED', 'CATERING_CONFIRM_REQUIRED', 'CATERING_USE_SAVED_REQUIRED', 'CONFIRM_REQUIRED',
])

function getFollowups(message, lastAskedText) {
  if (!message || message.error || PENDING_ACTION_TYPES.has(message.action?.type)) return []
  const asked = (lastAskedText || '').trim().toLowerCase()
  const seen = new Set([asked])
  const picks = []
  const add = (q) => {
    const k = q.toLowerCase()
    if (!seen.has(k)) { picks.push(q); seen.add(k) }
  }

  for (const q of (FOLLOWUPS_BY_ACTION[message.action?.type] || [])) add(q)
  if (picks.length < 3) {
    for (const { re, qs } of KEYWORD_FOLLOWUPS) {
      if (picks.length >= 3) break
      if (re.test(message.text || '')) qs.forEach(add)
    }
  }
  if (picks.length < 2) GENERAL_FOLLOWUPS.forEach(add)
  return picks.slice(0, 3)
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
          
        }}>
          {message.error ? message.text : <MarkdownMessage text={message.text} />}
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

// The empty-state hero. Rings live in a fixed box wrapped tightly around
// just the orb (see header note — this is the overlap-bug fix), heading
// gets a soft gradient fill, and quick actions stagger in on mount.
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
    <div style={{ position: 'relative', textAlign: 'center', padding: '30px 4px 6px' }}>
      <div aria-hidden="true" style={{
        position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
        width: 320, height: 200, pointerEvents: 'none',
        background: `radial-gradient(ellipse, rgba(167,139,250,0.12) 0%, transparent 70%)`,
      }} />

      {/* fixed box around just the orb — rings can never reach the heading below */}
      <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 16px' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              position: 'absolute', inset: 18 + i * 24, borderRadius: '50%',
              border: `1px dashed rgba(167,139,250,${0.22 - i * 0.06})`,
            }} />
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CurryOrbGraphic size={84} state="idle" animate />
        </div>
      </div>

      <div style={{
        position: 'relative', fontSize: 19, fontWeight: 800, marginBottom: 7, letterSpacing: '-0.01em',
        backgroundImage: `linear-gradient(135deg, #fff 20%, ${VIOLET_LIGHT})`,
        WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
      }}>
        Hey! I'm Curry.
      </div>
      <div style={{ position: 'relative', fontSize: 12.5, color: TEXT_SECONDARY, marginBottom: 22, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>
        Ask me about registration, exams and academics, campus locations, catering, or file a complaint or feedback — I'll point you the right way.
      </div>

      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 9, textAlign: 'left' }}>
        {QUICK_ACTIONS.map((qa, i) => (
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
              opacity: 0, animation: `curryQaIn 420ms cubic-bezier(0.16,1,0.3,1) ${80 + i * 55}ms forwards`,
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

// Orb (thinking state) + shimmering gradient-sweep text, replacing the
// old three-dot bounce.
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, animation: 'curryMsgIn 200ms ease' }}>
      <div style={{ width: 24, height: 24, flexShrink: 0 }}>
        <CurryOrbGraphic size={24} state="thinking" animate />
      </div>
      <span className="curry-shimmer-text" style={{ fontSize: 13, fontWeight: 600 }}>
        Curry is thinking
      </span>
    </div>
  )
}

function VoiceMode({ voice, onExit }) {
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
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 320, gap: 26 }}>
      <button
        onClick={onExit}
        aria-label="Back to chat"
        className="curry-icon-btn"
        style={{
          position: 'absolute', top: 0, right: 0,
          background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: TEXT_PRIMARY,
        }}
      >
        <IconKeyboard size={16} />
      </button>
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

  // { draft, messageId } while we're waiting to hear a phone number
  // spoken digit-by-digit (student declined their saved number).
  const awaitingNumberRef = useRef(null)

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

  // Stable indirection so the voice loop (started once per mode change)
  // always calls whatever handleVoiceTurn currently is, not a stale
  // closure. This assignment was previously missing — without it,
  // callLatestVoiceTurn calls .current(text) on a ref stuck at null and
  // voice mode throws on the first spoken turn.
  handleVoiceTurnRef.current = handleVoiceTurn
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

  const lastUserText = [...messages].reverse().find((m) => m.role === 'user')?.text ?? ''
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id ?? null
  const showSend = sending || input.trim().length > 0

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HeaderMenu />
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
      </div>

      {mode === 'voice' ? (
        <VoiceMode voice={voice} onExit={() => setMode('chat')} />
      ) : (
        <>
          {/* No boxed container — messages sit directly on the app background */}
        <div ref={scrollRef} className="curry-scroll" style={{
            flex: 1, minHeight: 0, overflowY: 'auto',
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
            {/* Affordance swap, ChatGPT-style: empty field shows the voice
                launcher; typing (or a pending send) swaps it for the send
                arrow — same button slot, one or the other. */}
            {showSend ? (
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
            ) : voice.supported ? (
              <button
                onClick={() => setMode('voice')}
                aria-label="Start voice mode"
                className="curry-voice-btn"
                style={{
                  background: USER_GRADIENT, border: 'none', borderRadius: '50%', width: 30, height: 30,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                  boxShadow: '0 3px 12px -4px rgba(108,99,255,0.55)', transition: 'transform 120ms ease',
                }}
              >
                <IconWaveform size={15} style={{ color: '#fff' }} />
              </button>
            ) : null}
          </div>
        </>
      )}

      <style>{`
        @keyframes curryMsgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes curryCursor { 0%, 45% { opacity: 1; } 50%, 100% { opacity: 0; } }
        @keyframes curryQaIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes curryMenuIn { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

        @keyframes curryShimmerKf { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .curry-shimmer-text {
          background-image: linear-gradient(90deg, rgba(245,245,250,0.35) 0%, rgba(245,245,250,0.35) 38%, #fff 50%, rgba(245,245,250,0.35) 62%, rgba(245,245,250,0.35) 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: curryShimmerKf 1.8s linear infinite;
        }

        .curry-msg-row .curry-action-row { opacity: 0.001; transition: opacity 140ms ease; }
        .curry-msg-row:hover .curry-action-row,
        .curry-msg-row:focus-within .curry-action-row { opacity: 1; }
        .curry-action-btn:hover { background: rgba(245,245,250,0.08); color: ${TEXT_PRIMARY}; }

        .curry-menu-item:hover { background: rgba(245,245,250,0.08); }
        .curry-markdown p { margin: 0 0 8px; }
        .curry-markdown p:last-child { margin-bottom: 0; }
        .curry-markdown ol, .curry-markdown ul { margin: 4px 0 8px; padding-left: 1.3em; }
        .curry-markdown li { margin-bottom: 4px; }
        .curry-markdown li:last-child { margin-bottom: 0; }
        .curry-markdown strong { color: ${TEXT_PRIMARY}; font-weight: 700; }
        .curry-markdown a { color: ${VIOLET_LIGHT}; }
        .curry-markdown code { background: rgba(245,245,250,0.1); padding: 1px 5px; border-radius: 5px; font-size: 0.92em; }

        .curry-followup-chip:hover { border-color: rgba(167,139,250,0.5); background: rgba(245,245,250,0.09); transform: translateY(-1px); }

        .curry-quick-action:hover {
          transform: translateY(-2px) !important;
          border-color: rgba(167,139,250,0.55);
          box-shadow: 0 10px 24px -12px rgba(108,99,255,0.4);
        }
        .curry-voice-btn:hover { transform: scale(1.06); }
        .curry-voice-btn:active { transform: scale(0.94); }

        .curry-quick-action:focus-visible,
        .curry-icon-btn:focus-visible,
        .curry-send-btn:focus-visible,
        .curry-voice-btn:focus-visible,
        .curry-action-btn:focus-visible,
        .curry-followup-chip:focus-visible,
        .curry-menu-item:focus-visible,
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
          .curry-msg-row, .curry-quick-action, .curry-shimmer-text { animation: none !important; transition: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  )
}
