import React, { useState } from 'react'
import Avatar from './Avatar'
import { forwardMessageToConversation, forwardMessageToEmail } from '../lib/supabase'
import { IconX, IconMessageSquare, IconMail, IconCamera } from './Icons'

// `message` is now the FULL message object — not just its .content
// string — so a media forward can actually carry the file. See
// forwardMessageToConversation in lib/supabase.js for the media-copy
// logic this now depends on.
export default function ForwardModal({
  session, message, conversations, getConvoName, currentUserId,
  emailAccounts, onClose, onForwarded,
}) {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('chat') // 'chat' | 'email'
  const [emailTo, setEmailTo] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState(null)

  const isMedia = message?.message_type === 'media' && message.media_assets?.[0]
  const isUnsupportedType = message?.message_type && message.message_type !== 'media' && message.message_type !== 'text' && message.message_type !== undefined && typeof message !== 'string' && !isMedia
  // Plain strings (legacy call sites still passing .content directly)
  // and 'text' messages both forward fine as text — only block genuinely
  // unhandled structured types like 'moment', 'poll', 'task', etc.
  const blocked = isUnsupportedType && !['text', undefined].includes(message.message_type) && message.message_type !== 'media'
  const asset = isMedia ? message.media_assets[0] : null
  const textContent = typeof message === 'string' ? message : (message?.content || '')

  const filtered = conversations.filter(c =>
    getConvoName(c).toLowerCase().includes(search.toLowerCase())
  )

  const handleForwardToChat = async (convo) => {
    setSending(true); setError('')
    try {
      await forwardMessageToConversation(convo.id, currentUserId, message)
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
      // Email forwarding is text-only — Curry's send-email action sends a
      // plain-text body, so a media forward here only carries the caption
      // (or filename as a fallback), never the actual file. The UI below
      // makes that explicit rather than silently dropping the media.
      const body = isMedia ? (textContent || `[${asset.media_type}: ${asset.filename}]`) : textContent
      await forwardMessageToEmail(session, emailTo.trim(), body)
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

        {isMedia ? (
          <div className="modal-preview" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCamera size={14} />
            <span>{asset.media_type === 'image' ? 'Photo' : asset.media_type === 'video' ? 'Video' : asset.media_type === 'audio' ? 'Audio' : 'File'}{textContent ? ` — "${textContent}"` : ''}</span>
          </div>
        ) : (
          <div className="modal-preview" style={{ maxHeight: 70, overflow: 'hidden' }}>{textContent}</div>
        )}

        {blocked ? (
          <div className="modal-error">This message type can't be forwarded yet.</div>
        ) : (
          <>
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

            {isMedia && mode === 'email' && (
              <div className="modal-preview" style={{ fontSize: 11.5 }}>
                Note: email forwarding only sends the caption/filename as text — the {asset.media_type} itself won't be attached.
              </div>
            )}

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
          </>
        )}

        {error && <div className="modal-error">{error}</div>}
      </div>
    </div>
  )
}
