// src/components/Pulse/AskCurry.jsx
//
// "Ask Curry" — Phase 2: replies can now carry a structured `action`
// from the tool registry (spec §23). This component renders that as an
// inline card: a button to actually open the service for OPEN_* / SHOW_*
// actions, or a Yes/No confirm prompt for CONFIRM_REQUIRED (consequential
// actions Curry proposed but hasn't executed yet, e.g. filing a ticket).
//
// ACTION_SERVICE_ID below maps a tool action type to a service id in
// your registry (src/data/dekutServices.js) — adjust these ids to match
// whatever they actually are; the ones here are best guesses based on
// the existing DEFAULT_FEATURED_IDS / DekutHubCard.jsx naming pattern.
//
// onNavigate: forwarded through, same contract as DeKUTHubCard.jsx /
// DekutFAQ.jsx — lets internal services route in-app.
// userId: passed to useCurryChat for ticket/history association.
// onClose: renders a close button when present (mounted full-screen).

import React, { useEffect, useRef, useState } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import { useCurryChat } from '../../hooks/useCurryChat'
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

// type -> service id. Update to match your real registry ids.
const ACTION_SERVICE_ID = {
  OPEN_STUDENT_PORTAL: 'portal',
  OPEN_ELEARNING: 'elearning',
  OPEN_LIBRARY: 'library',
  OPEN_CATERING: 'catering',
  OPEN_SUPPORT: 'support',
  SHOW_ROUTE: 'room-finder',
  SHOW_LOCATION: 'room-finder',
}

const ACTION_LABEL = {
  OPEN_STUDENT_PORTAL: 'Open Student Portal',
  OPEN_ELEARNING: 'Open eLearning',
  OPEN_LIBRARY: 'Open Library',
  OPEN_CATERING: 'Open Catering',
  OPEN_SUPPORT: 'Get Support',
  SHOW_ROUTE: 'Show on Campus Map',
  SHOW_LOCATION: 'Show on Campus Map',
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
        <button
          onClick={() => onConfirm(message.id, action)}
          style={{
            fontSize: 11.5, fontWeight: 700, color: '#fff', fontFamily: 'inherit',
            border: 'none', borderRadius: 9, padding: '7px 14px', cursor: 'pointer',
            background: 'linear-gradient(135deg,#a78bfa,#6c63ff)',
          }}
        >
          Yes, submit it
        </button>
        <button
          onClick={() => onConfirm(message.id, null)}
          style={{
            fontSize: 11.5, fontWeight: 700, color: TEXT_SECONDARY, fontFamily: 'inherit',
            border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 14px', cursor: 'pointer', background: 'none',
          }}
        >
          Not now
        </button>
      </div>
    )
  }

  const serviceId = ACTION_SERVICE_ID[action.type]
  const label = ACTION_LABEL[action.type]
  if (!serviceId || !label) return null

  return (
    <button
      onClick={() => onOpenService(serviceId)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
        fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', fontFamily: 'inherit',
        border: `1px solid rgba(167,139,250,0.4)`, borderRadius: 9, padding: '7px 12px',
        cursor: 'pointer', background: 'rgba(167,139,250,0.08)',
      }}
    >
      {label} <DekutIcon type="chevronRight" size={12} color="#c4b5fd" strokeWidth={2.2} />
    </button>
  )
}

function MessageBubble({ message, onOpenService, onConfirm }) {
  const isUser = message.role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '82%',
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

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '14px 14px 14px 4px', padding: '11px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: TEXT_SECONDARY, animation: `curryBounce 1.1s ${i * 0.15}s infinite ease-in-out` }} />
        ))}
        <style>{`@keyframes curryBounce { 0%, 80%, 100% { opacity: 0.3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }`}</style>
      </div>
    </div>
  )
}

export default function AskCurry({ userId, onNavigate, onClose }) {
  const { messages, sending, sendMessage, confirmAction, declineAction } = useCurryChat({ userId })
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)
  const usage = useDekutUsage('dekut')

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

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
    else declineAction(messageId) // "Not now" — nothing was ever submitted, purely local
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: TEXT_PRIMARY, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden="true">🤖</span> Ask Curry
          </div>
          <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, marginTop: 4, maxWidth: 420 }}>
            Curry answers from verified DeKUT info and can open services for you. If it's not verified, Curry will say so.
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

      <div ref={scrollRef} style={{
        flex: 1, minHeight: 260, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto',
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
    </div>
  )
}
