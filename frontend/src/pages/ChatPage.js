import React, { useState, useRef, useEffect } from 'react'
import { useChat, useConversations } from '../hooks/useChat'
import { getOrCreateConversation, signOut, supabase } from '../lib/supabase'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import VoiceRecorder from '../components/VoiceRecorder'
import VoiceMessage from '../components/VoiceMessage'
import PollCreator from '../components/PollCreator'
import PollMessage from '../components/PollMessage'

function Avatar({ name, size = 38 }) {
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const colors = ['#EEEDFE:#3C3489', '#E1F5EE:#085041', '#FAECE7:#712B13', '#E6F1FB:#0C447C', '#FAEEDA:#633806']
  const idx = name ? name.charCodeAt(0) % colors.length : 0
  const [bg, fg] = colors[idx].split(':')
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 500, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function formatMsgTime(ts) {
  const d = new Date(ts)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d')
}

function DateDivider({ date }) {
  const d = new Date(date)
  const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy')
  return <div className="date-divider">{label}</div>
}

function MessageBubble({ msg, isMe }) {
  // Poll message
  if (msg.message_type === 'poll') {
    return (
      <div className={`msg-row ${isMe ? 'mine' : ''}`}>
        {!isMe && <Avatar name={msg.profiles?.username} size={28} />}
        <div>
          {!isMe && <div className="msg-sender">{msg.profiles?.username}</div>}
          <PollMessage message={msg} currentUserId={msg._currentUserId} />
          <div className="msg-time">{formatMsgTime(msg.created_at)}</div>
        </div>
      </div>
    )
  }

  // Voice note message
  if (msg.message_type === 'voice') {
    return (
      <div className={`msg-row ${isMe ? 'mine' : ''}`}>
        {!isMe && <Avatar name={msg.profiles?.username} size={28} />}
        <div>
          {!isMe && <div className="msg-sender">{msg.profiles?.username}</div>}
          <VoiceMessage message={msg} isMe={isMe} />
          <div className="msg-time">{formatMsgTime(msg.created_at)}</div>
        </div>
      </div>
    )
  }

  // Regular text message
  return (
    <div className={`msg-row ${isMe ? 'mine' : ''}`}>
      {!isMe && <Avatar name={msg.profiles?.username} size={28} />}
      <div>
        {!isMe && <div className="msg-sender">{msg.profiles?.username}</div>}
        <div className={`msg-bubble ${msg.is_email ? 'email-msg' : ''}`}>
          {msg.is_email && <span className="email-tag">📧 via email</span>}
          {msg.content}
        </div>
        <div className="msg-time">{formatMsgTime(msg.created_at)}</div>
      </div>
    </div>
  )
}

export default function ChatPage({ session }) {
  const [activeConvo, setActiveConvo] = useState(null)
  const [newEmail, setNewEmail] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [inputText, setInputText] = useState('')
  const [search, setSearch] = useState('')
  const [profile, setProfile] = useState(null)
  const [showVoice, setShowVoice] = useState(false)
  const [showPoll, setShowPoll] = useState(false)
  const messagesEndRef = useRef(null)
  const typingTimer = useRef(null)

  const userId = session.user.id
  const { conversations, loading: convLoading, reload } = useConversations(userId)
  const { messages, loading: msgLoading, typing, sendMessage, broadcastTyping } = useChat(activeConvo?.id, userId)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', userId).single()
      .then(({ data }) => setProfile(data))
  }, [userId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (activeConvo) window.history.pushState({ chatOpen: true }, '')
  }, [activeConvo])

  useEffect(() => {
    const handlePopState = () => setActiveConvo(null)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // ── close voice recorder and poll creator when switching conversations ───────
  useEffect(() => {
    setShowVoice(false)
    setShowPoll(false)
  }, [activeConvo])

  const deleteConversation = async (convoId) => {
    const confirmed = window.confirm('Delete this conversation? This cannot be undone.')
    if (!confirmed) return
    await supabase.from('messages').delete().eq('conversation_id', convoId)
    await supabase.from('conversation_members').delete().eq('conversation_id', convoId)
    await supabase.from('conversations').delete().eq('id', convoId)
    if (activeConvo?.id === convoId) setActiveConvo(null)
    await reload()
  }

  const startNewChat = async (e) => {
    e.preventDefault()
    try {
      const convoId = await getOrCreateConversation(userId, newEmail)
      await reload()
      const found = conversations.find(c => c.id === convoId)
      if (found) setActiveConvo(found)
      setShowNewChat(false)
      setNewEmail('')
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSend = async () => {
    if (!inputText.trim() || !activeConvo) return
    broadcastTyping(false)
    await sendMessage(inputText)
    setInputText('')
  }

  const handleTyping = (e) => {
    setInputText(e.target.value)
    broadcastTyping(true)
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => broadcastTyping(false), 1500)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const getConvoName = (c) => {
    if (c.is_group) return c.name
    const other = c.conversation_members?.find(m => m.user_id !== userId)
    return other?.profiles?.username || other?.profiles?.email || 'Unknown'
  }

  const filtered = conversations.filter(c =>
    getConvoName(c).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={`app ${activeConvo ? 'chat-open' : ''}`}>
      <div className="sidebar">
        <div className="sidebar-header">
          <div>
            <img src="/logo.png" alt="Mattchat" className="sidebar-logo-img" />
            <div className="user-email">{profile?.username || session.user.email}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="icon-btn" onClick={() => setShowNewChat(true)} title="New chat">＋</button>
            <button className="icon-btn" onClick={signOut} title="Sign out">⏏</button>
          </div>
        </div>

        <div className="search-box">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…" />
        </div>

        {showNewChat && (
          <form className="new-chat-form" onSubmit={startNewChat}>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Friend's email address" required autoFocus />
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Start chat</button>
              <button type="button" className="btn-ghost" onClick={() => setShowNewChat(false)}>Cancel</button>
            </div>
          </form>
        )}

        <div className="contact-list">
          {convLoading && <div className="loading-state">Loading…</div>}
          {filtered.map(c => (
            <div key={c.id} className={`contact ${activeConvo?.id === c.id ? 'active' : ''}`} onClick={() => setActiveConvo(c)}>
              <Avatar name={getConvoName(c)} />
              <div className="contact-info">
                <div className="contact-name">{getConvoName(c)}</div>
                <div className="contact-preview">{c.last_message || 'No messages yet'}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <div className="contact-time">{c.updated_at ? formatMsgTime(c.updated_at) : ''}</div>
                <button
                  className="delete-chat-btn"
                  onClick={e => { e.stopPropagation(); deleteConversation(c.id) }}
                  title="Delete chat"
                >🗑️</button>
              </div>
            </div>
          ))}
          {!convLoading && filtered.length === 0 && (
            <div className="empty-state">
              <p>No conversations yet.</p>
              <button className="btn-primary" onClick={() => setShowNewChat(true)}>Start one →</button>
            </div>
          )}
        </div>
      </div>

      {activeConvo ? (
        <div className="chat-area">
          <div className="chat-header">
            <button className="back-btn" onClick={() => setActiveConvo(null)}>←</button>
            <Avatar name={getConvoName(activeConvo)} size={34} />
            <div style={{ flex: 1 }}>
              <div className="chat-header-name">{getConvoName(activeConvo)}</div>
              <div className="chat-header-sub">
                {typing.length > 0 ? `${getConvoName(activeConvo)} is typing…` : 'Online'}
              </div>
            </div>
            <div className="email-badge" title="Mattchat email address">
              📧 matt+{getConvoName(activeConvo).toLowerCase().replace(/\s/g, '')}@yourdomain.com
            </div>
          </div>

          <div className="messages">
            {msgLoading && <div className="loading-state">Loading messages…</div>}
            {messages.map((msg, i) => {
              const prev = messages[i - 1]
              const showDate = !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString()
              return (
                <React.Fragment key={msg.id}>
                  {showDate && <DateDivider date={msg.created_at} />}
                  <MessageBubble msg={{ ...msg, _currentUserId: userId }} isMe={msg.sender_id === userId} />
                </React.Fragment>
              )
            })}
            {typing.length > 0 && (
              <div className="typing-indicator"><span></span><span></span><span></span></div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── INPUT AREA ── */}
          <div className="input-area" style={{ position: 'relative' }}>
            {/* Poll creator floats above input */}
            {showPoll && (
              <PollCreator
                conversationId={activeConvo.id}
                senderId={userId}
                onSent={() => setShowPoll(false)}
                onCancel={() => setShowPoll(false)}
              />
            )}

            {showVoice ? (
              <VoiceRecorder
                conversationId={activeConvo.id}
                senderId={userId}
                onSent={() => setShowVoice(false)}
                onCancel={() => setShowVoice(false)}
              />
            ) : (
              <>
                <button
                  className="attach-btn"
                  onClick={() => setShowVoice(true)}
                  title="Voice note"
                  style={{ fontSize: 20 }}
                >🎙️</button>
                <button
                  className="attach-btn"
                  onClick={() => setShowPoll(v => !v)}
                  title="Create poll"
                  style={{ fontSize: 20 }}
                >📊</button>
                <textarea
                  value={inputText}
                  onChange={handleTyping}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message…"
                  rows={1}
                />
                <button className="send-btn" onClick={handleSend} disabled={!inputText.trim()}>➤</button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="chat-area empty-chat">
          <img src="/logo.png" alt="" className="empty-chat-watermark" />
          <div className="empty-chat-content">
            <h2>Welcome to Mattchat</h2>
            <p>Select a conversation or start a new one.<br />Friends can also message you by email!</p>
            <button className="btn-primary" onClick={() => setShowNewChat(true)}>Start a conversation →</button>
          </div>
        </div>
      )}
    </div>
  )
}
