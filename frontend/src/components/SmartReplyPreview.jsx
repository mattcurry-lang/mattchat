import { useState, useEffect, useRef } from 'react'
import { callCurryAI } from './CurryAI'

// Inline smart-reply preview for the chat list. Only activates for
// conversations that have unread messages (the ones that actually
// need a reply) — fetching a suggestion for every single conversation
// on every render would be wasteful and slow. Each conversation's
// suggestion is fetched once and cached in the parent's state (see
// useSmartReplyCache below), so switching tabs / re-rendering the
// list doesn't re-fire the request.
//
// Usage: replace the plain `<div className="contact-preview">` text
// with <SmartReplyPreview /> for rows where unread > 0.

export function useSmartReplyCache() {
  const [cache, setCache] = useState({}) // convoId -> { loading, text, error }
  const inFlightRef = useRef(new Set())

  const fetchSuggestion = async (session, convo) => {
    const convoId = convo.id
    if (inFlightRef.current.has(convoId) || cache[convoId]) return
    inFlightRef.current.add(convoId)
    setCache(prev => ({ ...prev, [convoId]: { loading: true } }))

    try {
      const lastMsg = convo.last_message || ''
      const data = await callCurryAI('chat', {
        message: `Someone just sent me this message: "${lastMsg}"\n\nSuggest ONE short, natural reply I could send back. Return ONLY the reply text, nothing else, no quotes.`,
      }, session)
      const text = data.ok ? data.response.replace(/<action>[\s\S]*?<\/action>/g, '').trim() : null
      setCache(prev => ({ ...prev, [convoId]: { loading: false, text } }))
    } catch {
      setCache(prev => ({ ...prev, [convoId]: { loading: false, error: true } }))
    }
    inFlightRef.current.delete(convoId)
  }

  const clear = (convoId) => setCache(prev => {
    const next = { ...prev }
    delete next[convoId]
    return next
  })

  return { cache, fetchSuggestion, clear }
}

export default function SmartReplyPreview({ session, convo, entry, onFetch, onSend, fallbackText }) {
  useEffect(() => {
    if (!entry) onFetch(session, convo)
  }, [convo.id])

  if (!entry || entry.loading) {
    return <div className="contact-preview unread">{fallbackText || 'New message'}</div>
  }

  if (entry.error || !entry.text) {
    return <div className="contact-preview unread">{fallbackText || convo.last_message || 'New message'}</div>
  }

  return (
    <div style={s.row} onClick={e => e.stopPropagation()}>
      <span style={s.icon}>💡</span>
      <span style={s.replyText}>"{entry.text}"</span>
      <button style={s.sendBtn} onClick={() => onSend(entry.text)} title="Send this reply">➤</button>
    </div>
  )
}

const s = {
  row: {
    display: 'flex', alignItems: 'center', gap: 6, marginTop: 2,
    background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)',
    borderRadius: 10, padding: '4px 8px',
  },
  icon: { fontSize: 11, flexShrink: 0 },
  replyText: {
    fontSize: 12, color: '#c4b5fd', fontWeight: 500, fontStyle: 'italic',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
  },
  sendBtn: {
    background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: '50%',
    width: 20, height: 20, color: '#fff', fontSize: 10, cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
}
