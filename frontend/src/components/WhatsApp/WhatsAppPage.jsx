import React, { useState, useMemo, useRef, useEffect } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import Avatar from '../Avatar'
import { IconX, IconSearch } from '../Icons'
import { useWhatsAppConversations } from '../../hooks/useWhatsAppConversations'
import { useWhatsAppChat } from '../../hooks/useWhatsAppChat'
import WhatsAppMessageBubble from './WhatsAppMessageBubble'

function formatListTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'M/d/yy')
}

function DateDivider({ date }) {
  const d = new Date(date)
  const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy')
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px' }}>
        {label}
      </span>
    </div>
  )
}

function ConversationRow({ convo, active, onClick }) {
  const name = convo.contact_name || convo.contact_wa_id
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        cursor: 'pointer', borderRadius: 14,
        background: active ? 'rgba(167,139,250,0.12)' : 'transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-surface-2)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar name={name} size={46} photoUrl={convo.contact_avatar_url} />
        {convo.unread_count > 0 && (
          <span
            style={{
              position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9,
              background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', fontSize: 10.5, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              border: '2px solid var(--bg-surface-1, #14141f)',
            }}
          >
            {convo.unread_count > 9 ? '9+' : convo.unread_count}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: convo.unread_count > 0 ? 800 : 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          <span style={{ fontSize: 11, color: convo.unread_count > 0 ? '#a78bfa' : 'var(--text-muted)', fontWeight: convo.unread_count > 0 ? 700 : 500, flexShrink: 0 }}>
            {formatListTime(convo.last_message_at)}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: convo.unread_count > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
          {convo.last_message || 'No messages yet'}
        </div>
      </div>
      {convo.is_pinned && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>📌</span>}
    </div>
  )
}

function ConversationThread({ session, convo, userId, onBack }) {
  const { messages, loading, sending, sendMessage } = useWhatsAppChat(session, convo.id, userId)
  const [text, setText] = useState('')
  const endRef = useRef(null)
  const name = convo.contact_name || convo.contact_wa_id

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = async () => {
    if (!text.trim() || sending) return
    const toSend = text.trim()
    setText('')
    await sendMessage(toSend)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onBack} className="wa-back-btn" style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 0 }}>←</button>
        <Avatar name={name} size={36} photoUrl={convo.contact_avatar_url} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{convo.contact_wa_id}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>Loading messages…</div>}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>No messages yet</div>
        )}
        {messages.map((msg, i) => {
          const prev = messages[i - 1]
          const showDate = !prev || new Date(msg.timestamp).toDateString() !== new Date(prev.timestamp).toDateString()
          return (
            <React.Fragment key={msg.id}>
              {showDate && <DateDivider date={msg.timestamp} />}
              <WhatsAppMessageBubble message={msg} />
            </React.Fragment>
          )
        })}
        <div ref={endRef} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Type a message…"
          rows={1}
          style={{
            flex: 1, resize: 'none', background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '10px 16px', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
            maxHeight: 120, outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0, border: 'none',
            background: text.trim() ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'var(--bg-surface-2)',
            color: text.trim() ? '#fff' : 'var(--text-muted)', cursor: text.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  )
}

// Full-screen overlay, following the same pattern as EmailWorkspace /
// DocumentsPage / InstagramView's full-screen mode in ChatPage.jsx.
// See the integration note for the one-line trigger to add there.
export default function WhatsAppPage({ session, userId, onClose }) {
  const { conversations, loading } = useWhatsAppConversations(session, userId)
  const [activeId, setActiveId] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations
    const q = search.toLowerCase()
    return conversations.filter((c) => (c.contact_name || c.contact_wa_id || '').toLowerCase().includes(q))
  }, [conversations, search])

  const activeConvo = conversations.find((c) => c.id === activeId) || null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'var(--bg-surface-1, #0f0f1a)', display: 'flex' }}>
      {/* Mobile behavior: below 768px, the list and thread panes take
          turns filling the whole screen instead of sitting side by
          side — same collapse pattern WhatsApp itself uses. */}
      <style>{`
        @media (max-width: 768px) {
          .wa-sidebar { width: 100% !important; border-right: none !important; display: ${activeConvo ? 'none' : 'flex'} !important; }
          .wa-thread-pane { display: ${activeConvo ? 'flex' : 'none'} !important; }
          .wa-back-btn { display: inline-flex !important; }
        }
      `}</style>

      {/* Sidebar — conversation list */}
      <div
        className="wa-sidebar"
        style={{
          width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderRight: '1px solid var(--border)', background: 'var(--bg-surface-1, #0f0f1a)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 10px' }}>
          <div
            style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg,#667eea,#764ba2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16,
            }}
          >
            💬
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, flex: 1 }}>WhatsApp</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <IconX size={18} />
          </button>
        </div>

        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '8px 14px' }}>
            <IconSearch size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>
              No conversations yet. Messages sent to your WhatsApp number will show up here.
            </div>
          )}
          {filtered.map((c) => (
            <ConversationRow key={c.id} convo={c} active={c.id === activeId} onClick={() => setActiveId(c.id)} />
          ))}
        </div>
      </div>

      {/* Main pane — active conversation or empty state */}
      <div className="wa-thread-pane" style={{ display: 'flex', flex: 1, minWidth: 0 }}>
        {activeConvo ? (
          <ConversationThread session={session} convo={activeConvo} userId={userId} onBack={() => setActiveId(null)} />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 40 }}>💬</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Select a conversation to start messaging</div>
          </div>
        )}
      </div>
    </div>
  )
}
