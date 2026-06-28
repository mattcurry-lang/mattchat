import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useChat, useConversations } from '../hooks/useChat'
import { getOrCreateConversation, signOut, supabase } from '../lib/supabase'
import { format, isToday, isYesterday } from 'date-fns'
import Avatar from '../components/Avatar'
import VoiceRecorder from '../components/VoiceRecorder'
import VoiceMessage from '../components/VoiceMessage'
import PollCreator from '../components/PollCreator'
import PollMessage from '../components/PollMessage'
import TaskCreator from '../components/TaskCreator'
import TaskMessage from '../components/TaskMessage'
import PinnedBar from '../components/PinnedBar'
import ScheduleMessageModal from '../components/ScheduleMessageModal'
import ScheduledMessagesList from '../components/ScheduledMessagesList'
import MessageSearch from '../components/MessageSearch'
import CurryAIChat, { CurryAssistant } from '../components/CurryAI'
import { useHeyCurry } from '../components/HeyCurryListener'
import { usePresence } from '../hooks/usePresence'
import { useCall } from '../hooks/useCall'
import CallOverlay from '../components/CallOverlay'
import IncomingCallModal from '../components/IncomingCallModal'

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
  if (msg.message_type === 'task') {
    return (
      <div className={`msg-row ${isMe ? 'mine' : ''}`}>
        {!isMe && <Avatar name={msg.profiles?.username} size={28} />}
        <div>
          {!isMe && <div className="msg-sender">{msg.profiles?.username}</div>}
          <TaskMessage message={msg} currentUserId={msg._currentUserId} />
          <div className="msg-time">{formatMsgTime(msg.created_at)}</div>
        </div>
      </div>
    )
  }
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

function ThreeDotMenu({ onPoll, onTask, onSchedule, onSearch, onShare, onClose }) {
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.threedot-wrapper')) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const items = [
    { icon: '📊', label: 'Create Poll', action: onPoll },
    { icon: '✅', label: 'Task List', action: onTask },
    { icon: '🕐', label: 'Schedule Message', action: onSchedule },
    { icon: '🔍', label: 'Search Messages', action: onSearch },
    { icon: '📧', label: 'Share Contact Link', action: onShare },
  ]

  return (
    <div style={{
      position: 'absolute', top: '100%', right: 0,
      marginTop: 6, zIndex: 200,
      background: 'rgba(255,255,255,0.98)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      boxShadow: 'var(--shadow-lg)',
      overflow: 'hidden',
      animation: 'menuPop 0.18s cubic-bezier(0.34,1.56,0.64,1)',
      minWidth: 200,
    }}>
      {items.map(({ icon, label, action }) => (
        <button
          key={label}
          onClick={() => { action(); onClose() }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '11px 16px',
            background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13.5, fontWeight: 500,
            color: 'var(--text-primary)',
            transition: 'background 0.12s',
            textAlign: 'left',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</span>
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Call buttons in header ────────────────────────────────────
function CallButtons({ onVoiceCall, onVideoCall, disabled }) {
  return (
    <>
      <button
        className="icon-btn"
        onClick={onVoiceCall}
        disabled={disabled}
        title="Voice call"
        style={{
          fontSize: 17,
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        📞
      </button>
      <button
        className="icon-btn"
        onClick={onVideoCall}
        disabled={disabled}
        title="Video call"
        style={{
          fontSize: 17,
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        📹
      </button>
    </>
  )
}

const CURRY_AI_CONTACT = { id: 'curry-ai', isCurryAI: true }

function getOtherUserId(convo, myUserId) {
  const other = convo?.conversation_members?.find(m => m.user_id !== myUserId)
  return other?.user_id || null
}

export default function ChatPage({ session }) {
  const [activeConvo, setActiveConvo] = useState(null)
  const [newEmail, setNewEmail]       = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [inputText, setInputText]     = useState('')
  const [search, setSearch]           = useState('')
  const [profile, setProfile]         = useState(null)
  const [showVoice, setShowVoice]     = useState(false)
  const [showPoll, setShowPoll]       = useState(false)
  const [showTask, setShowTask]       = useState(false)
  const [pinnedRefresh, setPinnedRefresh] = useState(0)
  const [showScheduler, setShowScheduler]         = useState(false)
  const [showScheduledList, setShowScheduledList] = useState(false)
  const [showSearch, setShowSearch]               = useState(false)
  const [showCurryAssistant, setShowCurryAssistant] = useState(false)
  const [showThreeDot, setShowThreeDot] = useState(false)
  const [hasScheduled, setHasScheduled] = useState(false)

  const msgRefs        = useRef({})
  const messagesEndRef = useRef(null)
  const typingTimer    = useRef(null)

  const userId = session.user.id

  // ── Presence ──────────────────────────────────────────────
  const isOnline = usePresence(userId)

  // ── Call state ────────────────────────────────────────────
  const {
    callStatus,
    activeCall,
    callToken,
    callError,
    startCall,
    answerCall,
    declineCall,
    endCall,
  } = useCall(userId, activeConvo?.id && !activeConvo.isCurryAI ? activeConvo.id : null)

  const { conversations, loading: convLoading, reload } = useConversations(userId)
  const { messages, loading: msgLoading, typing, sendMessage, broadcastTyping } = useChat(
    activeConvo?.id && !activeConvo.isCurryAI ? activeConvo.id : null,
    userId
  )

  const otherUserId = activeConvo && !activeConvo.isCurryAI
    ? getOtherUserId(activeConvo, userId)
    : null

  const onHeyCurryActivated = useCallback(() => {
    setActiveConvo(CURRY_AI_CONTACT)
  }, [])
  useHeyCurry(onHeyCurryActivated)

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

  useEffect(() => {
    setShowVoice(false)
    setShowPoll(false)
    setShowTask(false)
    setShowScheduler(false)
    setShowScheduledList(false)
    setShowSearch(false)
    setShowCurryAssistant(false)
    setShowThreeDot(false)
    setHasScheduled(false)
  }, [activeConvo])

  useEffect(() => {
    if (!activeConvo?.id || activeConvo.isCurryAI) return
    async function checkScheduled() {
      const { data } = await supabase
        .from('scheduled_messages')
        .select('id')
        .eq('conversation_id', activeConvo.id)
        .eq('sender_id', userId)
        .eq('status', 'pending')
        .limit(1)
      setHasScheduled((data || []).length > 0)
    }
    checkScheduled()
    const sub = supabase
      .channel(`sched-check:${activeConvo.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'scheduled_messages',
        filter: `conversation_id=eq.${activeConvo.id}`,
      }, checkScheduled)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [activeConvo, userId])

  useEffect(() => {
    const interval = setInterval(() => {
      supabase.functions.invoke('send-scheduled-messages')
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const deleteConversation = async (convoId) => {
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return
    await supabase.from('messages').delete().eq('conversation_id', convoId)
    await supabase.from('conversation_members').delete().eq('conversation_id', convoId)
    await supabase.from('conversations').delete().eq('id', convoId)
    if (activeConvo?.id === convoId) setActiveConvo(null)
    await reload()
  }

  const pinMessage = async (msgId) => {
    const { error } = await supabase.from('pinned_messages').insert({
      conversation_id: activeConvo.id, message_id: msgId, pinned_by: userId,
    })
    if (error) alert('Already pinned or could not pin message')
    else setPinnedRefresh(v => v + 1)
  }

  const scrollToMessage = (msgId) => {
    msgRefs.current[msgId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
    } catch (err) { alert(err.message) }
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

  const handleShare = () => {
    const link = `https://mattchat-nine.vercel.app/email/${profile?.username || ''}`
    navigator.clipboard.writeText(link)
    alert('Contact link copied!')
  }

  const getConvoName = (c) => {
    if (c.isCurryAI) return 'Curry AI'
    if (c.is_group) return c.name
    const other = c.conversation_members?.find(m => m.user_id !== userId)
    return other?.profiles?.username || other?.profiles?.email || 'Unknown'
  }

  const filtered = conversations.filter(c =>
    getConvoName(c).toLowerCase().includes(search.toLowerCase())
  )

  const headerStatus = () => {
    if (callStatus === 'calling')    return '📞 Calling…'
    if (callStatus === 'connecting') return '📞 Connecting…'
    if (callStatus === 'in-call')    return '🟢 On a call'
    if (typing.length > 0)           return `${getConvoName(activeConvo)} is typing…`
    if (otherUserId && isOnline(otherUserId)) return 'Online'
    return ''
  }

  // Are we in any active call state
  const callActive = ['calling', 'connecting', 'in-call'].includes(callStatus)

  return (
    <div className={`app ${activeConvo ? 'chat-open' : ''}`}>

      {/* ── INCOMING CALL MODAL ── */}
      {callStatus === 'incoming' && activeCall && (
        <IncomingCallModal
          callerName={getConvoName(activeConvo || { conversation_members: [] })}
          callType={activeCall.callType}
          onAnswer={answerCall}
          onDecline={declineCall}
        />
      )}

      {/* ── IN-CALL OVERLAY ── */}
      {(callStatus === 'connecting' || callStatus === 'in-call') && activeCall && (
        <CallOverlay
          roomUrl={activeCall.roomUrl}
          token={callToken}
          callType={activeCall.callType}
          callerName={activeConvo ? getConvoName(activeConvo) : ''}
          onEnd={endCall}
        />
      )}

      {/* ── SIDEBAR ── */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div>
            <img src="/logo.png" alt="Mattchat" className="sidebar-logo-img" />
            <div className="user-email">{profile?.username || session.user.email}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
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
          {/* Curry AI */}
          <div
            className={`contact ${activeConvo?.isCurryAI ? 'active' : ''}`}
            onClick={() => setActiveConvo(CURRY_AI_CONTACT)}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg,#667eea,#764ba2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>✨</div>
            <div className="contact-info">
              <div className="contact-name" style={{ color: '#6366f1' }}>✨ Curry AI</div>
              <div className="contact-preview">Your personal AI assistant</div>
            </div>
          </div>

          {convLoading && <div className="loading-state">Loading…</div>}

          {filtered.map(c => {
            const otherId = getOtherUserId(c, userId)
            const online  = otherId ? isOnline(otherId) : false
            return (
              <div
                key={c.id}
                className={`contact ${activeConvo?.id === c.id ? 'active' : ''}`}
                onClick={() => setActiveConvo(c)}
              >
                <Avatar name={getConvoName(c)} online={online} />
                <div className="contact-info">
                  <div className="contact-name">{getConvoName(c)}</div>
                  <div className="contact-preview">{c.last_message || 'No messages yet'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div className="contact-time">{c.updated_at ? formatMsgTime(c.updated_at) : ''}</div>
                  <button
                    className="delete-chat-btn"
                    onClick={e => { e.stopPropagation(); deleteConversation(c.id) }}
                  >🗑️</button>
                </div>
              </div>
            )
          })}

          {!convLoading && filtered.length === 0 && (
            <div className="empty-state">
              <p>No conversations yet.</p>
              <button className="btn-primary" onClick={() => setShowNewChat(true)}>Start one →</button>
            </div>
          )}
        </div>
      </div>

      {/* ── CHAT AREA ── */}
      {activeConvo ? (
        activeConvo.isCurryAI ? (
          <div className="chat-area" style={{ background: 'linear-gradient(180deg,#0f0f1a 0%,#1a1a2e 100%)' }}>
            <div className="chat-header" style={{ background: '#1e1e2e', borderBottom: '1px solid #2a2a3e' }}>
              <button className="back-btn" onClick={() => setActiveConvo(null)}>←</button>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg,#667eea,#764ba2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>✨</div>
              <div style={{ flex: 1 }}>
                <div className="chat-header-name" style={{ color: '#fff' }}>✨ Curry AI</div>
                <div className="chat-header-sub" style={{ color: '#667eea' }}>Always learning, always here</div>
              </div>
            </div>
            <CurryAIChat session={session} />
          </div>
        ) : (
          <div className="chat-area">
            {/* Header */}
            <div className="chat-header">
              <button className="back-btn" onClick={() => setActiveConvo(null)}>←</button>
              <Avatar
                name={getConvoName(activeConvo)}
                size={36}
                online={otherUserId ? isOnline(otherUserId) : false}
              />
              <div style={{ flex: 1 }}>
                <div className="chat-header-name">{getConvoName(activeConvo)}</div>
                <div className="chat-header-sub" style={{
                  color: callActive ? '#10b981'
                    : typing.length > 0 ? 'var(--text-muted)'
                    : '#10b981',
                  minHeight: 16,
                }}>
                  {headerStatus()}
                </div>
              </div>

              {/* Right side actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

                {/* ── CALL BUTTONS ── */}
                {callStatus === 'idle' && (
                  <CallButtons
                    onVoiceCall={() => startCall('audio')}
                    onVideoCall={() => startCall('video')}
                    disabled={false}
                  />
                )}

                {/* Show "end call" in header when calling/in-call */}
                {callActive && (
                  <button
                    onClick={endCall}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 'var(--r-full)',
                      padding: '5px 12px', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12,
                      fontWeight: 700, color: '#ef4444',
                    }}
                  >
                    📵 End call
                  </button>
                )}

                <button
                  className="icon-btn"
                  onClick={() => setShowCurryAssistant(v => !v)}
                  title="Curry AI assistant"
                >✨</button>

                {hasScheduled && (
                  <button
                    onClick={() => setShowScheduledList(true)}
                    title="View scheduled messages"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: 'var(--r-full)',
                      padding: '5px 10px', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12,
                      fontWeight: 700, color: 'var(--accent-2)',
                      transition: 'all var(--transition)',
                      animation: 'scheduledPulse 2s ease infinite',
                    }}
                  >
                    🕐 <span style={{ fontSize: 11 }}>Scheduled</span>
                  </button>
                )}

                <div className="threedot-wrapper" style={{ position: 'relative' }}>
                  <button
                    className="icon-btn"
                    onClick={() => setShowThreeDot(v => !v)}
                    title="More options"
                    style={{
                      fontSize: 18, fontWeight: 700, letterSpacing: 1,
                      color: showThreeDot ? 'var(--accent-2)' : undefined,
                      background: showThreeDot ? 'rgba(99,102,241,0.08)' : undefined,
                    }}
                  >⋮</button>
                  {showThreeDot && (
                    <ThreeDotMenu
                      onPoll={() => { setShowPoll(v => !v); setShowTask(false) }}
                      onTask={() => { setShowTask(v => !v); setShowPoll(false) }}
                      onSchedule={() => setShowScheduler(true)}
                      onSearch={() => setShowSearch(true)}
                      onShare={handleShare}
                      onClose={() => setShowThreeDot(false)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Call error banner */}
            {callError && (
              <div style={{
                padding: '8px 16px', background: 'rgba(239,68,68,0.08)',
                borderBottom: '1px solid rgba(239,68,68,0.2)',
                fontSize: 13, color: '#ef4444', fontWeight: 500,
              }}>
                ⚠️ {callError}
                <button
                  onClick={() => {}}
                  style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12 }}
                >✕</button>
              </div>
            )}

            {/* Calling banner — shown when we initiated and waiting */}
            {callStatus === 'calling' && (
              <div style={{
                padding: '10px 16px',
                background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(99,102,241,0.08))',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 13, fontWeight: 600, color: 'var(--accent-2)',
              }}>
                <span style={{ animation: 'pulse 1s infinite' }}>📞</span>
                Calling {getConvoName(activeConvo)}…
                <button
                  onClick={endCall}
                  style={{
                    marginLeft: 'auto', background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 20, padding: '4px 12px',
                    fontSize: 12, fontWeight: 700, color: '#ef4444',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >Cancel</button>
              </div>
            )}

            <PinnedBar key={pinnedRefresh} conversationId={activeConvo?.id} onScrollTo={scrollToMessage} />

            {/* Messages */}
            <div className="messages">
              {msgLoading && <div className="loading-state">Loading messages…</div>}
              {messages.map((msg, i) => {
                const prev = messages[i - 1]
                const showDate = !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString()
                return (
                  <React.Fragment key={msg.id}>
                    {showDate && <DateDivider date={msg.created_at} />}
                    <div
                      ref={el => msgRefs.current[msg.id] = el}
                      onContextMenu={e => { e.preventDefault(); pinMessage(msg.id) }}
                      title="Right-click to pin"
                    >
                      <MessageBubble
                        msg={{ ...msg, _currentUserId: userId }}
                        isMe={msg.sender_id === userId}
                      />
                    </div>
                  </React.Fragment>
                )
              })}
              {typing.length > 0 && (
                <div className="typing-indicator"><span /><span /><span /></div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="input-area" style={{ flexDirection: 'column', alignItems: 'stretch', padding: 0 }}>
              {showCurryAssistant && (
                <CurryAssistant
                  session={session}
                  conversationId={activeConvo.id}
                  messages={messages}
                  onSuggestReply={(text) => setInputText(text)}
                  onClose={() => setShowCurryAssistant(false)}
                />
              )}
              {showPoll && (
                <div style={{ padding: '0 16px' }}>
                  <PollCreator
                    conversationId={activeConvo.id}
                    senderId={userId}
                    onSent={() => setShowPoll(false)}
                    onCancel={() => setShowPoll(false)}
                  />
                </div>
              )}
              {showTask && (
                <div style={{ padding: '0 16px' }}>
                  <TaskCreator
                    conversationId={activeConvo.id}
                    senderId={userId}
                    onSent={() => setShowTask(false)}
                    onCancel={() => setShowTask(false)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '12px 16px' }}>
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
                    <textarea
                      value={inputText}
                      onChange={handleTyping}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message…"
                      rows={1}
                    />
                    <button
                      className="send-btn"
                      onClick={handleSend}
                      disabled={!inputText.trim()}
                    >➤</button>
                  </>
                )}
              </div>
            </div>

            {showScheduler && (
              <ScheduleMessageModal
                conversationId={activeConvo.id}
                senderId={userId}
                onClose={(success) => {
                  setShowScheduler(false)
                  if (success) { alert('Message scheduled ✓'); setHasScheduled(true) }
                }}
              />
            )}
            {showScheduledList && (
              <ScheduledMessagesList
                conversationId={activeConvo.id}
                currentUserId={userId}
                onClose={() => setShowScheduledList(false)}
              />
            )}
            {showSearch && (
              <MessageSearch
                conversationId={activeConvo.id}
                currentUserId={userId}
                otherUserName={getConvoName(activeConvo)}
                onScrollTo={scrollToMessage}
                onClose={() => setShowSearch(false)}
              />
            )}
          </div>
        )
      ) : (
        <div className="chat-area empty-chat">
          <img src="/logo.png" alt="" className="empty-chat-watermark" />
          <div className="empty-chat-content">
            <h2>Welcome to Mattchat</h2>
            <p>Select a conversation or start a new one.<br />Say <strong>"Hey Curry"</strong> to activate your AI assistant!</p>
            <button className="btn-primary" onClick={() => setShowNewChat(true)}>Start a conversation →</button>
          </div>
        </div>
      )}
    </div>
  )
}
