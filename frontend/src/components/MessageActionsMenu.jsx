import { useState, useRef, useEffect } from 'react'
import { callCurryAI } from './CurryAI'

// Long-press (or right-click, desktop) context menu on a message
// bubble. Adds Curry-powered actions alongside your existing
// Delete/Forward/Copy/Pin. Built entirely on the existing 'chat'
// endpoint with a crafted one-off prompt per action, so it needs
// ZERO backend changes to ship.
//
// Usage: wrap a message bubble's press handlers to call `open(x,y)`
// on long-press, render <MessageActionsMenu ... /> once per chat
// screen (not per message) and pass the currently-targeted message in.

const ACTIONS = [
  { id: 'rewrite',   label: '✨ Rewrite',  prompt: (t) => `Rewrite this message to sound more polished, keeping the same meaning and language. Return ONLY the rewritten message, nothing else:\n\n"${t}"` },
  { id: 'summarize', label: '✨ Summarize', prompt: (t) => `Summarize this message in one short sentence. Return ONLY the summary:\n\n"${t}"` },
  { id: 'translate', label: '✨ Translate', prompt: (t) => `Translate this message to English (if it's already English, translate to Spanish instead). Return ONLY the translation:\n\n"${t}"` },
  { id: 'explain',   label: '✨ Explain',   prompt: (t) => `Explain what this message means / is referring to, briefly and plainly. Return ONLY the explanation:\n\n"${t}"` },
  { id: 'reply',     label: '✨ Suggest reply', prompt: (t) => `Suggest one short, natural reply to this message. Return ONLY the reply text, nothing else:\n\n"${t}"` },
]

export function useMessageLongPress(onOpen) {
  const timerRef = useRef(null)
  const firedRef = useRef(false)

  const bind = (message) => ({
    onTouchStart: (e) => {
      firedRef.current = false
      const touch = e.touches[0]
      timerRef.current = setTimeout(() => {
        firedRef.current = true
        onOpen(message, touch.clientX, touch.clientY)
      }, 450)
    },
    onTouchEnd: () => clearTimeout(timerRef.current),
    onTouchMove: () => clearTimeout(timerRef.current),
    onContextMenu: (e) => {
      e.preventDefault()
      onOpen(message, e.clientX, e.clientY)
    },
  })

  return bind
}

export default function MessageActionsMenu({ session, message, position, onClose, onInsertReply, onPin, onDelete, onForward, onCopy }) {
  const [busyAction, setBusyAction] = useState(null)
  const [result, setResult] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [onClose])

  if (!message || !position) return null

  const text = message.content || ''

  async function runAction(action) {
    setBusyAction(action.id)
    setResult(null)
    try {
      const data = await callCurryAI('chat', { message: action.prompt(text) }, session)
      const clean = data.ok ? data.response.replace(/<action>[\s\S]*?<\/action>/g, '').trim() : 'Something went wrong.'
      setResult({ actionId: action.id, text: clean })
    } catch {
      setResult({ actionId: action.id, text: 'Network error.' })
    }
    setBusyAction(null)
  }

  // Keep menu on-screen
  const maxLeft = typeof window !== 'undefined' ? window.innerWidth - 240 : position.x
  const left = Math.min(position.x, maxLeft)

  return (
    <div ref={menuRef} style={{ ...m.menu, left, top: position.y }}>
      {!result && (
        <>
          <div style={m.section}>
            {onPin && <button style={m.item} onClick={() => { onPin(); onClose() }}>📌 Pin</button>}
            {onForward && <button style={m.item} onClick={() => { onForward(); onClose() }}>➡️ Forward</button>}
            {onCopy && <button style={m.item} onClick={() => { navigator.clipboard.writeText(text); onCopy(); onClose() }}>📋 Copy</button>}
            {onDelete && <button style={{ ...m.item, color: '#f87171' }} onClick={() => { onDelete(); onClose() }}>🗑️ Delete</button>}
          </div>
          <div style={m.divider} />
          <div style={m.section}>
            {ACTIONS.map(a => (
              <button key={a.id} style={m.item} onClick={() => runAction(a)} disabled={!!busyAction}>
                {busyAction === a.id ? '⏳ Thinking...' : a.label}
              </button>
            ))}
          </div>
        </>
      )}

      {result && (
        <div style={m.resultBox}>
          <div style={m.resultHeader}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd' }}>✨ {ACTIONS.find(a => a.id === result.actionId)?.label.replace('✨ ', '')}</span>
            <button style={m.resultClose} onClick={onClose}>✕</button>
          </div>
          <div style={m.resultText}>{result.text}</div>
          {result.actionId === 'reply' && onInsertReply && (
            <button style={m.useBtn} onClick={() => { onInsertReply(result.text); onClose() }}>Use this reply</button>
          )}
          <button style={m.backBtn} onClick={() => setResult(null)}>← Back</button>
        </div>
      )}
    </div>
  )
}

const m = {
  menu: {
    position: 'fixed', zIndex: 500, minWidth: 210, maxWidth: 260,
    background: 'rgba(24,24,38,0.98)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(167,139,250,0.25)', borderRadius: 14,
    boxShadow: '0 12px 32px rgba(0,0,0,0.45)', overflow: 'hidden',
    animation: 'menuPop 0.15s cubic-bezier(0.34,1.56,0.64,1)',
  },
  section: { padding: '6px 0' },
  divider: { height: 1, background: 'rgba(255,255,255,0.08)' },
  item: {
    display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
    padding: '9px 14px', fontSize: 13, fontWeight: 500, color: '#e2e8f0', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  resultBox: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
  resultHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  resultClose: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer' },
  resultText: { fontSize: 13, color: '#f0f0f0', lineHeight: 1.5, maxHeight: 160, overflowY: 'auto' },
  useBtn: { background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '7px 10px', cursor: 'pointer', fontFamily: 'inherit' },
  backBtn: { background: 'none', border: 'none', color: '#9ca3af', fontSize: 11.5, fontWeight: 600, padding: '2px 0', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
}
