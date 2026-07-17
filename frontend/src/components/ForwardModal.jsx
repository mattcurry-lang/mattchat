import React, { useState } from 'react'
import Avatar from './Avatar'
import { forwardMessageToConversation, forwardMessageToEmail } from '../lib/supabase'
import { IconX, IconMessageSquare, IconMail } from './Icons'

// Lets the user forward a message either to one of their existing
// conversations, or as a real email (reusing the connected Gmail
// account via Curry's send-email action).
export default function ForwardModal({
  session, content, conversations, getConvoName, currentUserId,
  emailAccounts, onClose, onForwarded,
}) {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('chat') // 'chat' | 'email'
  const [emailTo, setEmailTo] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState(null)

  const filtered = conversations.filter(c =>
    getConvoName(c).toLowerCase().includes(search.toLowerCase())
  )

  const handleForwardToChat = async (convo) => {
    setSending(true); setError('')
    try {
      await forwardMessageToConversation(convo.id, currentUserId, content)
      setSentTo(getConvoName(convo))
      onForwarded?.(convo.id)
      setTimeout(onClose, 900)
    } catch (e) {
      setError(e.message)
    }
    setSending(false)
  }

  const handleForwardToEmail = async () => {
    if (!emailTo.trim()) return
    setSending(true); setError('')
    try {
      await forwardMessageToEmail(session, emailTo.trim(), content)
      setSentTo(emailTo.trim())
      setTimeout(onClose, 1200)
    } catch (e) {
      setError(e.message)
    }
    setSending(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Forward message</span>
          <button className="modal-close" onClick={onClose}><IconX size={13} /></button>
        </div>

        <div className="modal-preview" style={{ maxHeight: 70, overflow: 'hidden' }}>{content}</div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={mode === 'chat' ? 'btn-primary' : 'btn-ghost'}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => setMode('chat')}
          ><IconMessageSquare size={14} /> To a chat</button>
          <button
            className={mode === 'email' ? 'btn-primary' : 'btn-ghost'}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => setMode('email')}
          ><IconMail size={14} /> To email</button>
        </div>

        {sentTo ? (
          <div className="auth-success">Forwarded to {sentTo}</div>
        ) : mode === 'chat' ? (
          <>
            <input
              className="modal-input"
              placeholder="Search conversations…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map(c => (
                <button
                  key={c.id}
                  className="contact"
                  style={{ width: '100%', border: 'none', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1 }}
                  onClick={() => !sending && handleForwardToChat(c)}
                  disabled={sending}
                >
                  <Avatar name={getConvoName(c)} size={40} />
                  <div className="contact-info">
                    <div className="contact-name">{getConvoName(c)}</div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && <div className="empty-state">No matching conversations</div>}
            </div>
          </>
        ) : (
          <>
            {emailAccounts.length === 0 && (
              <div className="modal-error">No Gmail account connected yet — connect one from the profile menu first.</div>
            )}
            <input
              className="modal-input"
              type="email"
              placeholder="recipient@example.com"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              autoFocus
            />
            <button className="btn-primary" onClick={handleForwardToEmail} disabled={sending || !emailTo.trim()}>
              {sending ? 'Sending…' : 'Send email'}
            </button>
          </>
        )}

        {error && <div className="modal-error">{error}</div>}
      </div>
    </div>
  )
}
