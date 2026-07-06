import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useChat, useConversations } from '../hooks/useChat'
import { getOrCreateConversation, hideConversationForUser, signOut, supabase, connectGmail, listEmailAccounts } from '../lib/supabase'
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
import CurryAIChat, { CurryAssistant, CurryChatToggle, callCurryAI } from '../components/CurryAI'
import { useHeyCurry } from '../components/HeyCurryListener'
import { usePresence } from '../hooks/usePresence'
import { useCall } from '../hooks/useCall'
import CallOverlay from '../components/CallOverlay'
import IncomingCallModal from '../components/IncomingCallModal'
import EmojiPicker from '../components/EmojiPicker'
import { useRingtone } from '../hooks/useRingtone'
import { useMessageStatus } from '../hooks/useMessageStatus'
import { useUnreadCounts } from '../hooks/useUnreadCounts'
import { useGlobalDelivery } from '../hooks/useGlobalDelivery'
import BottomNav from '../components/BottomNav'
import { IconSearch, IconPhone, IconVideo, IconSparkle, IconMoreVertical, IconSmile, IconMic, IconPlus } from '../components/Icons'
import { ReactableMessage } from '../components/MessageReactions'
import { useStatuses } from '../hooks/useStatuses'
import StatusRing from '../components/StatusRing'
import AddStatusModal from '../components/AddStatusModal'
import StatusViewer from '../components/StatusViewer'

// Matches "hey curry", "hey curry,", "hey curry:" at the start of a
// message (case-insensitive) — this is what routes a message to the
// in-chat Curry instead of delivering it to the other person.
const CURRY_TRIGGER = /^hey\s+curry[,:]?\s*/i

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

// Shows "Delivered" under a sent message. Once the other person has
// opened the chat and read it (tracked by useMessageStatus/readMap),
// this stays silent and the bubble itself gets a purple outline
// instead — see the `.read` class applied to .msg-bubble below.
function MessageStatus({ isMe, isRead, isDelivered }) {
  if (!isMe) return null
  const label = isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'
  const cls = isRead ? 'read' : isDelivered ? 'delivered' : 'sent'
  return <div className={`msg-status ${cls}`}>{label}</div>
}

function StickerBubble({ content, isMe }) {
  const parts = content.replace('sticker:', '').split(':')
  const emoji = parts[0] || '😊'
  const label = parts[1] || ''
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
      <div style={{ fontSize: 72, lineHeight: 1, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))', padding: '4px 8px', transition: 'transform 0.15s', cursor: 'default', display: 'inline-block' }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1) rotate(-3deg)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
      >{emoji}</div>
      {label && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2, padding: '0 8px' }}>{label}</div>}
    </div>
  )
}

function GifBubble({ content }) {
  const [loaded, setLoaded] = useState(false)
  const parts = content.replace('gif:', '').split('::')
  const url = parts[0] || ''
  const title = parts[1] || 'GIF'
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', maxWidth: 220, background: 'rgba(255,255,255,0.06)', position: 'relative' }}>
      {!loaded && (
        <div style={{ width: 220, height: 140, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎬</div>
      )}
      <img src={url} alt={title} onLoad={() => setLoaded(true)} style={{ display: loaded ? 'block' : 'none', width: '100%', maxWidth: 220 }} />
      <div style={{ position: 'absolute', bottom: 4, right: 6, background: 'rgba(0,0,0,0.6)', borderRadius: 4, fontSize: 9, fontWeight: 700, color: '#fff', padding: '2px 5px' }}>GIF</div>
    </div>
  )
}

// Curry's in-chat message — visually distinct from either person's
// bubbles (centered, purple-tinted card) so it's unmistakable that
// this came from the shared Curry, not from either human.
function CurryChatBubble({ msg }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '4px 0' }}>
      <div style={{ maxWidth: '85%', background: 'linear-gradient(135deg, rgba(102,126,234,0.16), rgba(118,75,162,0.16))', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 14, padding: '10px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
          ✨ Curry
        </div>
        <div style={{ fontSize: 14, color: '#e8e8f0', lineHeight: 1.5 }}>{msg.content}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{formatMsgTime(msg.created_at)}</div>
      </div>
    </div>
  )
}

function MessageBubble({ msg, isMe, isRead, isDelivered }) {
  if (msg.message_type === 'curry') {
    return <CurryChatBubble msg={msg} />
  }
  if (msg.content?.startsWith('missed_call:')) {
    const callType = msg.content.replace('missed_call:', '')
    return (
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          {callType === 'video' ? '📹' : '📞'} Missed {callType} call
          <span style={{ opacity: 0.6, fontWeight: 500 }}>· {formatMsgTime(msg.created_at)}</span>
        </div>
      </div>
    )
  }
  if (msg.content?.startsWith('sticker:')) {
    return (
      <div className={`msg-row ${isMe ? 'mine' : ''}`}>
        {!isMe && <Avatar name={msg.profiles?.username} size={28} />}
        <div>
          {!isMe && <div className="msg-sender">{msg.profiles?.username}</div>}
          <StickerBubble content={msg.content} isMe={isMe} />
          <div className="msg-time">{formatMsgTime(msg.created_at)}</div>
          <MessageStatus isMe={isMe} isRead={isRead} isDelivered={isDelivered} />
        </div>
      </div>
    )
  }
  if (msg.content?.startsWith('gif:')) {
    return (
      <div className={`msg-row ${isMe ? 'mine' : ''}`}>
        {!isMe && <Avatar name={msg.profiles?.username} size={28} />}
        <div>
          {!isMe && <div className="msg-sender">{msg.profiles?.username}</div>}
          <GifBubble content={msg.content} isMe={isMe} />
          <div className="msg-time">{formatMsgTime(msg.created_at)}</div>
          <MessageStatus isMe={isMe} isRead={isRead} isDelivered={isDelivered} />
        </div>
      </div>
    )
  }
  if (msg.message_type === 'task') {
    return (
      <div className={`msg-row ${isMe ? 'mine' : ''}`}>
        {!isMe && <Avatar name={msg.profiles?.username} size={28} />}
        <div>
          {!isMe && <div className="msg-sender">{msg.profiles?.username}</div>}
          <TaskMessage message={msg} currentUserId={msg._currentUserId} />
          <div className="msg-time">{formatMsgTime(msg.created_at)}</div>
          <MessageStatus isMe={isMe} isRead={isRead} isDelivered={isDelivered} />
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
          <MessageStatus isMe={isMe} isRead={isRead} isDelivered={isDelivered} />
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
          <MessageStatus isMe={isMe} isRead={isRead} isDelivered={isDelivered} />
        </div>
      </div>
    )
  }
  return (
    <div className={`msg-row ${isMe ? 'mine' : ''}`}>
      {!isMe && <Avatar name={msg.profiles?.username} size={28} />}
      <div>
        {!isMe && <div className="msg-sender">{msg.profiles?.username}</div>}
        <div className={`msg-bubble ${msg.is_email ? 'email-msg' : ''} ${isMe && isRead ? 'read' : ''}`}>
          {msg.is_email && <span className="email-tag">📧 via email</span>}
          {msg.content}
        </div>
        <div className="msg-time">{formatMsgTime(msg.created_at)}</div>
        <MessageStatus isMe={isMe} isRead={isRead} isDelivered={isDelivered} />
      </div>
    </div>
  )
}

function ThreeDotMenu({ onPoll, onTask, onSchedule, onSearch, onShare, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (!e.target.closest('.threedot-wrapper')) onClose() }
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
    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 200, background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', overflow: 'hidden', animation: 'menuPop 0.18s cubic-bezier(0.34,1.56,0.64,1)', minWidth: 200 }}>
      {items.map(({ icon, label, action }) => (
        <button key={label} onClick={() => { action(); onClose() }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)', transition: 'background 0.12s', textAlign: 'left' }}
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

function CallButtons({ onVoiceCall, onVideoCall, disabled }) {
  return (
    <>
      <button className="icon-btn dark" onClick={onVoiceCall} disabled={disabled} title="Voice call" style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}><IconPhone size={18} /></button>
      <button className="icon-btn dark" onClick={onVideoCall} disabled={disabled} title="Video call" style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}><IconVideo size={18} /></button>
    </>
  )
}

const CURRY_AI_CONTACT = { id: 'curry-ai', isCurryAI: true }

function getOtherUserId(convo, myUserId) {
  const other = convo?.conversation_members?.find(m => m.user_id !== myUserId)
  return other?.user_id || null
}

export default function ChatPage({ session }) {
  const [activeConvo, setActiveConvo]   = useState(null)
  const [newContact, setNewContact]     = useState('')
  const [showNewChat, setShowNewChat]   = useState(false)
  const [inputText, setInputText]       = useState('')
  const [search, setSearch]             = useState('')
  const [showSearchBar, setShowSearchBar] = useState(false)
  const [listFilter, setListFilter]     = useState('all') // 'all' | 'group'
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [profile, setProfile]           = useState(null)
  const [showVoice, setShowVoice]       = useState(false)
  const [showPoll, setShowPoll]         = useState(false)
  const [showTask, setShowTask]         = useState(false)
  const [pinnedRefresh, setPinnedRefresh] = useState(0)
  const [showScheduler, setShowScheduler]           = useState(false)
  const [showScheduledList, setShowScheduledList]   = useState(false)
  const [showSearch, setShowSearch]                 = useState(false)
  const [showCurryAssistant, setShowCurryAssistant] = useState(false)
  const [showThreeDot, setShowThreeDot]             = useState(false)
  const [hasScheduled, setHasScheduled]             = useState(false)
  const [showEmojiPicker, setShowEmojiPicker]       = useState(false)
  const [activeTab, setActiveTab]                   = useState('chats')
  const [sharedConvoIds, setSharedConvoIds]         = useState(new Set())
  const [curryChatBusy, setCurryChatBusy]           = useState(false)
  const [emailAccounts, setEmailAccounts]           = useState([])
  const [connectingGmail, setConnectingGmail]       = useState(false)

  const msgRefs        = useRef({})
  const messagesEndRef = useRef(null)
  const typingTimer    = useRef(null)
  const textareaRef    = useRef(null)

  const userId = session.user.id
  const isOnline = usePresence(userId)

  const { callStatus, activeCall, callToken, callError, startCall, answerCall, declineCall, endCall } =
    useCall(userId, activeConvo?.id && !activeConvo.isCurryAI ? activeConvo.id : null)

  useRingtone(['calling', 'ringing', 'incoming'].includes(callStatus))

  const { conversations, loading: convLoading, reload } = useConversations(userId)
  const { unreadCounts, clearUnread, totalUnread } = useUnreadCounts(
    userId,
    conversations.map(c => c.id)
  )
  useGlobalDelivery(userId, conversations.map(c => c.id))
  const { messages, loading: msgLoading, typing, sendMessage, broadcastTyping } = useChat(
    activeConvo?.id && !activeConvo.isCurryAI ? activeConvo.id : null,
    userId
  )
  const { readMap, deliveredMap } = useMessageStatus(
    messages,
    activeConvo?.id && !activeConvo.isCurryAI ? activeConvo.id : null,
    userId
  )
/* ═══════════════════════════════════════════════════════════
   MATTCHAT — APP.CSS
   Single-layout dark mobile-app design (story rail + bottom nav)
   ═══════════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');

/* ── Design Tokens ─────────────────────────────────────── */
:root {
  --brand:        #6c63ff;
  --brand-deep:   #4f46e5;
  --brand-light:  #a78bfa;
  --brand-soft:   rgba(108,99,255,0.1);
  --brand-grad:   linear-gradient(135deg, #6c63ff 0%, #a78bfa 100%);
  --panel-bg:     #0f0e17;
  --bg-app:       #f7f8fc;
  --bg-sidebar:   #ffffff;
  --bg-chat:      #efeae2;
  --bg-bubble-in: #ffffff;
  --bg-bubble-out:#d9fdd3;
  --bg-header:    #f0f2f5;
  --bg-surface-2: #f4f7ff;
  --text-primary:   #111827;
  --text-secondary: #4b5563;
  --text-muted:     #9ca3af;
  --text-on-brand:  #ffffff;
  --text-accent:    #6c63ff;
  --accent-1:       #6c63ff;
  --accent-2:       #6c63ff;
  --accent-grad:    linear-gradient(135deg, #6c63ff 0%, #a78bfa 100%);
  --border:       #e5e7eb;
  --shadow-sm:    0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:    0 4px 16px rgba(0,0,0,0.1);
  --shadow-lg:    0 12px 40px rgba(0,0,0,0.14);
  --online:  #38bdf8;
  --r-sm:   6px;
  --r-md:   10px;
  --r-lg:   16px;
  --r-xl:   22px;
  --r-full: 9999px;
  --ease:    cubic-bezier(0.4, 0, 0.2, 1);
  --spring:  cubic-bezier(0.34, 1.56, 0.64, 1);
  --t-fast:  0.15s;
  --t-base:  0.22s;
  --transition: 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  --font-display: 'Plus Jakarta Sans', sans-serif;
  --font-body:    'Inter', sans-serif;

  /* Dark app-shell tokens (new) */
  --dark-bg:       #14121f;
  --dark-header:   #17152a;
  --dark-card:     #1b1930;
  --dark-card-2:   #221f3b;
  --dark-border:   rgba(255,255,255,0.08);
  --dark-text:     #ffffff;
  --dark-text-2:   rgba(255,255,255,0.55);
  --dark-text-3:   rgba(255,255,255,0.35);

  --sidebar-w:  460px; /* max width of the single-column app shell */

  /* App height: 100dvh (dynamic viewport height) is the correct unit
     for mobile — it recalculates live as the browser's address
     bar/toolbar shows and hides, unlike 100vh which is fixed to the
     LARGEST possible viewport and causes content to be taller than
     what's actually visible, pushing the header off-screen. The
     100vh fallback only matters for older browsers that don't
     support dvh at all. */
  --app-height: 100vh;
  --app-height: 100dvh;
}

/* ── Reset ─────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root {
  height: 100%;
  height: var(--app-height);
  overflow: hidden;
  font-family: var(--font-body);
  background: var(--bg-app);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  font-size: 15px;
}

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }

/* ═══════════════════════════════════════════════════════════
   SPLASH
   ═══════════════════════════════════════════════════════════ */
.splash {
  height: 100vh;
  height: var(--app-height);
  display: flex; align-items: center; justify-content: center;
  background: var(--panel-bg);
}
.splash-logo-img {
  width: 80px; height: auto;
  animation: splashPop 0.5s var(--spring);
  filter: drop-shadow(0 0 24px rgba(108,99,255,0.5));
}
@keyframes splashPop {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}

/* ═══════════════════════════════════════════════════════════
   AUTH PAGE
   ═══════════════════════════════════════════════════════════ */
.auth-page { min-height: 100vh; min-height: var(--app-height); display: flex; overflow: auto; }
.auth-left { width: 45%; min-height: 100vh; min-height: var(--app-height); background: var(--panel-bg); display: flex; align-items: center; justify-content: center; padding: 60px 48px; position: relative; overflow: hidden; flex-shrink: 0; }
.auth-left::before { content: ''; position: absolute; width: 500px; height: 500px; background: radial-gradient(circle, rgba(108,99,255,0.25) 0%, transparent 65%); top: -100px; left: -100px; pointer-events: none; }
.auth-left::after { content: ''; position: absolute; width: 400px; height: 400px; background: radial-gradient(circle, rgba(167,139,250,0.15) 0%, transparent 65%); bottom: -80px; right: -80px; pointer-events: none; }
.auth-left-inner { position: relative; z-index: 1; max-width: 380px; width: 100%; }
.auth-brand { margin-bottom: 56px; }
.auth-brand-logo { width: 56px; height: auto; margin-bottom: 20px; filter: drop-shadow(0 0 20px rgba(108,99,255,0.5)); }
.auth-brand-name { font-family: var(--font-display); font-size: 42px; font-weight: 800; letter-spacing: -1.5px; line-height: 1; margin-bottom: 12px; background: linear-gradient(135deg, #ffffff 0%, rgba(167,139,250,0.9) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.auth-brand-tagline { font-size: 16px; color: rgba(255,255,255,0.45); line-height: 1.5; }
.auth-features { display: flex; flex-direction: column; gap: 18px; margin-bottom: 56px; }
.auth-feature-item { display: flex; align-items: center; gap: 14px; }
.auth-feature-icon { width: 38px; height: 38px; background: rgba(108,99,255,0.15); border: 1px solid rgba(108,99,255,0.25); border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
.auth-feature-text { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.65); }
.auth-left-footer { font-size: 12px; color: rgba(255,255,255,0.22); }
.auth-right { flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 40px; background: #ffffff; }
.auth-form-wrap { width: 100%; max-width: 400px; }
.auth-form-header { margin-bottom: 32px; }
.auth-form-title { font-family: var(--font-display); font-size: 28px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.8px; margin-bottom: 6px; }
.auth-form-sub { font-size: 14px; color: var(--text-muted); }
.auth-tabs { display: flex; background: var(--bg-app); border-radius: var(--r-md); padding: 4px; gap: 4px; margin-bottom: 28px; }
.auth-tabs button { flex: 1; padding: 9px 16px; background: none; border: none; border-radius: calc(var(--r-md) - 2px); font-size: 13.5px; font-weight: 600; font-family: var(--font-body); cursor: pointer; color: var(--text-muted); transition: all var(--t-base) var(--ease); }
.auth-tabs button.active { background: #ffffff; color: var(--brand); box-shadow: var(--shadow-sm); }
.auth-form { display: flex; flex-direction: column; gap: 0; }
.field { margin-bottom: 18px; }
.field label { display: block; font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 7px; }
.field input { width: 100%; padding: 12px 14px; border: 1.5px solid var(--border); border-radius: var(--r-md); font-size: 14.5px; font-family: var(--font-body); color: var(--text-primary); background: #fafafa; outline: none; transition: all var(--t-fast) var(--ease); }
.field input:focus { border-color: var(--brand); background: #ffffff; box-shadow: 0 0 0 3px rgba(108,99,255,0.12); }
.field input::placeholder { color: #b8bcc8; }
.auth-error { background: #fff1f2; color: #be123c; font-size: 13px; font-weight: 500; padding: 10px 14px; border-radius: var(--r-md); margin-bottom: 16px; border: 1px solid #fecdd3; }
.auth-success { background: #f0fdf4; color: #166534; font-size: 13px; font-weight: 500; padding: 10px 14px; border-radius: var(--r-md); margin-bottom: 16px; border: 1px solid #bbf7d0; }
.auth-btn { width: 100%; padding: 13px; background: var(--brand-grad); color: #ffffff; border: none; border-radius: var(--r-md); font-size: 15px; font-weight: 700; font-family: var(--font-body); cursor: pointer; transition: all var(--t-base) var(--ease); box-shadow: 0 4px 16px rgba(108,99,255,0.35); margin-top: 4px; margin-bottom: 20px; }
.auth-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(108,99,255,0.45); }
.auth-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
.auth-note { font-size: 12.5px; color: var(--text-muted); line-height: 1.6; border-top: 1px solid var(--border); padding-top: 16px; }
.auth-note strong { color: var(--brand); }
.auth-logo-img, .auth-tagline, .auth-logo { display: none; }

/* ═══════════════════════════════════════════════════════════
   APP SHELL — single layout at every screen size
   ═══════════════════════════════════════════════════════════
   The list screen (.sidebar) and the open conversation (.chat-area)
   are never shown at the same time on mobile/tablet — narrow screens
   don't have room to split. On desktop the sidebar stays put (classic
   WhatsApp Web layout) and only the right-hand pane toggles between
   the welcome screen and the open conversation. */
.app {
  position: relative;
  display: flex;
  height: 100vh;
  height: var(--app-height);
  width: 100%;
  max-width: var(--sidebar-w);
  margin: 0 auto;
  background: var(--dark-bg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  /* Respect notches/status-bar cutouts on phones that have them
     (safe-area-inset is 0 on phones without a notch, so this is a
     no-op there). */
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* Tablet: still a single-pane "app card" floating with margin */
@media (min-width: 640px) and (max-width: 899px) {
  html, body { background: #d8dae6; }
  .app { margin: 18px auto; height: calc(var(--app-height) - 36px); border-radius: 28px; }
}

/* Desktop: full-bleed, classic split — narrow list on the left that
   NEVER hides, and a right-hand pane that shows the welcome screen
   until a chat is opened, then shows that chat. Just like WhatsApp. */
@media (min-width: 900px) {
  html, body { background: var(--dark-bg); }
  .app { max-width: none; width: 100vw; height: 100vh; height: var(--app-height); margin: 0; border-radius: 0; box-shadow: none; }
  .app .sidebar {
    display: flex;
    width: 420px;
    max-width: 420px;
    flex-shrink: 0;
    border-right: 1px solid var(--dark-border);
  }
  .app .welcome-pane { display: flex; }
  .app.chat-open .welcome-pane { display: none; }
}

/* ── List / browse screen ── */
.sidebar {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  background: var(--dark-bg);
}
/* Mobile/tablet only: opening a chat fully replaces the list.
   (Desktop overrides this back to visible — see 900px block above.) */
.app.chat-open .sidebar { display: none; }

/* ── Top header: brand + story rail ── */
.top-header {
  flex-shrink: 0;
  padding: 14px 16px 12px;
  background:
    radial-gradient(circle at 15% -20%, rgba(108,99,255,0.35) 0%, transparent 55%),
    radial-gradient(circle at 90% 0%, rgba(167,139,250,0.22) 0%, transparent 50%),
    var(--dark-header);
  position: relative;
}

.top-header-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 14px;
}
.top-header-logo {
  width: 28px; height: 28px;
  border-radius: 8px;
  object-fit: contain;
  filter: drop-shadow(0 0 8px rgba(108,99,255,0.5));
  flex-shrink: 0;
}
.top-header-name {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 18px;
  letter-spacing: -0.3px;
  color: #ffffff;
  flex: 1;
}
.top-header-search-btn {
  background: rgba(255,255,255,0.08);
  border: none;
  width: 34px; height: 34px;
  border-radius: 50%;
  color: #fff;
  font-size: 15px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background var(--t-fast);
  flex-shrink: 0;
}
.top-header-search-btn:hover { background: rgba(255,255,255,0.16); }

/* ── Story / quick-contact rail ── */
.story-rail {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.story-rail::-webkit-scrollbar { display: none; }

.story-item {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  width: 60px;
}
.story-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--dark-text-2);
  max-width: 60px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.story-add-circle {
  width: 52px; height: 52px;
  border-radius: 50%;
  border: 1.5px dashed rgba(255,255,255,0.3);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
  color: #fff;
  background: rgba(255,255,255,0.05);
  transition: all var(--t-fast);
}
.story-item:hover .story-add-circle { background: rgba(255,255,255,0.1); transform: scale(1.05); }
.story-ring {
  width: 58px; height: 58px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  padding: 3px;
  background: linear-gradient(135deg, #6c63ff, #a78bfa, #f472b6);
  transition: transform var(--t-fast);
}
.story-ring.online { background: linear-gradient(135deg, #38bdf8, #6c63ff); box-shadow: 0 0 14px 1px rgba(56,189,248,0.55); }
.story-item:hover .story-ring { transform: scale(1.06); }

/* ── List card ── */
.list-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--dark-card);
  border-radius: 22px 22px 0 0;
  margin-top: -14px;
  position: relative;
  z-index: 2;
}

.list-tabs {
  display: flex;
  gap: 6px;
  padding: 14px 16px 10px;
  flex-shrink: 0;
}
.list-tabs button {
  flex: 1;
  padding: 9px 14px;
  background: var(--dark-card-2);
  border: none;
  border-radius: var(--r-full);
  color: var(--dark-text-2);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all var(--t-fast);
}
.list-tabs button.active {
  background: var(--brand-grad);
  color: #fff;
  box-shadow: 0 3px 10px rgba(108,99,255,0.35);
}

/* Search */
.search-box {
  padding: 4px 16px 10px;
  flex-shrink: 0;
}
.search-box input {
  width: 100%;
  padding: 9px 14px 9px 38px;
  border: 1px solid var(--dark-border);
  border-radius: var(--r-full);
  font-size: 13.5px;
  font-family: var(--font-body);
  background: var(--dark-card-2);
  color: #fff;
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 13px center;
}
.search-box input:focus { box-shadow: 0 0 0 2px rgba(108,99,255,0.3); }
.search-box input::placeholder { color: var(--dark-text-3); }

/* New chat form */
.new-chat-form { padding: 4px 16px 12px; display: flex; flex-direction: column; gap: 8px; animation: slideDown 0.2s var(--spring); flex-shrink: 0; }
.new-chat-form input { padding: 9px 13px; border: 1px solid var(--dark-border); border-radius: var(--r-md); font-size: 13.5px; font-family: var(--font-body); color: #fff; background: var(--dark-card-2); outline: none; }
.new-chat-form input:focus { border-color: var(--brand); }
.new-chat-form input::placeholder { color: var(--dark-text-3); }

.btn-primary { padding: 9px 16px; background: var(--brand-grad); color: #fff; border: none; border-radius: var(--r-md); font-size: 13px; font-weight: 700; font-family: var(--font-body); cursor: pointer; box-shadow: 0 2px 8px rgba(108,99,255,0.3); }
.btn-primary:hover { transform: translateY(-1px); }
.btn-ghost { padding: 9px 16px; background: none; border: 1.5px solid var(--dark-border); border-radius: var(--r-md); font-size: 13px; font-weight: 600; font-family: var(--font-body); cursor: pointer; color: var(--dark-text-2); }
.btn-ghost:hover { background: rgba(255,255,255,0.05); }

/* Contact list */
.contact-list { flex: 1; overflow-y: auto; padding: 2px 0 90px; }

.contact {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 12px;
  margin: 1px 12px;
  border-radius: 14px;
  cursor: pointer;
  transition: background var(--t-fast);
  position: relative;
}
.contact:hover { background: rgba(255,255,255,0.05); }
.contact.active { background: var(--brand-soft); }
.contact.active .contact-name { color: #c4b5fd; }

.contact-info { flex: 1; min-width: 0; }
.contact-name { font-size: 15px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.contact-preview { font-size: 13px; color: var(--dark-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.contact-time { font-size: 11px; color: var(--dark-text-3); white-space: nowrap; font-weight: 500; }

.delete-chat-btn { background: none; border: none; cursor: pointer; font-size: 13px; opacity: 0; padding: 3px 5px; border-radius: var(--r-sm); color: #f87171; transition: opacity var(--t-fast); }
.contact:hover .delete-chat-btn { opacity: 0.6; }
.delete-chat-btn:hover { opacity: 1 !important; background: rgba(239,68,68,0.12); }

.empty-state { padding: 40px 20px; text-align: center; color: var(--dark-text-2); font-size: 13.5px; }
.loading-state { padding: 24px; text-align: center; color: var(--dark-text-2); font-size: 13px; }

/* Avatar */
.avatar { position: relative; flex-shrink: 0; }
/* Online = a solid light-blue dot on the avatar, bottom-left so it
   never collides with the unread badge (top-right) or the
   shared-with-Curry sparkle badge (bottom-right). Single source of
   truth for the online color: var(--online), set once in :root. */
.status-dot {
  position: absolute;
  bottom: -1px;
  left: -1px;
  border-radius: 50%;
  background: var(--online);
  border: 2px solid var(--dark-bg);
  box-shadow: 0 0 6px rgba(56,189,248,0.7);
}

/* Unread badge — small purple pill, top-right of an avatar */
.story-avatar-wrap,
.contact-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.unread-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: var(--r-full);
  background: var(--brand-grad);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--dark-bg);
  box-shadow: 0 0 8px rgba(108,99,255,0.6);
  line-height: 1;
}

/* Shared-with-Curry indicator — small sparkle badge, bottom-right of
   the avatar so it never collides with the unread-count badge which
   sits top-right. Uses the app's own brand gradient, no new color. */
.shared-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--brand-grad);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border: 2px solid var(--dark-bg);
  box-shadow: 0 0 6px rgba(108,99,255,0.6);
}
/* Unread contact rows — bolder / brighter until opened */
.contact-name.unread { color: #fff; font-weight: 800; }
.contact-preview.unread { color: rgba(255,255,255,0.85); font-weight: 600; }


/* ── Profile menu ── */
.profile-menu-overlay {
  position: absolute; inset: 0;
  z-index: 60;
  display: flex; align-items: flex-end;
  background: rgba(0,0,0,0.4);
}
.profile-menu {
  width: 100%;
  background: var(--dark-card-2);
  border-radius: 20px 20px 0 0;
  padding: 20px 18px calc(20px + 78px);
  display: flex;
  align-items: center;
  gap: 12px;
  animation: panelUp 0.25s var(--spring);
  border-top: 1px solid var(--dark-border);
}
.profile-menu-signout {
  background: rgba(239,68,68,0.15);
  border: 1px solid rgba(239,68,68,0.3);
  color: #f87171;
  font-size: 12.5px;
  font-weight: 700;
  padding: 8px 14px;
  border-radius: var(--r-full);
  cursor: pointer;
  font-family: var(--font-body);
  flex-shrink: 0;
}

/* ── Bottom nav ── */
.bottom-nav {
  position: absolute;
  left: 12px; right: 12px; bottom: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: rgba(20,18,31,0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--dark-border);
  border-radius: var(--r-full);
  padding: 8px 6px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  /* Keep clear of the home-indicator / gesture bar on phones that
     have one; 0 elsewhere so this is harmless on other devices. */
  margin-bottom: env(safe-area-inset-bottom, 0px);
}
.bnav-btn {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: var(--dark-text-3);
  padding: 4px 10px;
  border-radius: 14px;
  transition: all var(--t-fast);
  flex: 1;
}
.bnav-btn:hover { color: var(--dark-text-2); }
.bnav-btn.active { color: #fff; background: rgba(255,255,255,0.06); }
.bnav-icon { display: block; }
.bnav-label { font-size: 9.5px; font-weight: 600; }
.bnav-plus {
  width: 46px; height: 46px;
  border-radius: 50%;
  background: var(--brand-grad);
  border: none;
  color: #fff;
  font-size: 22px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
  top: -10px;
  box-shadow: 0 6px 18px rgba(108,99,255,0.5);
  transition: transform var(--t-fast) var(--spring);
}
.bnav-plus:hover { transform: scale(1.08) translateY(-2px); }
.bnav-plus:active { transform: scale(0.95); }

/* ── Welcome pane — desktop-only right half, shown when no chat is open ── */
.welcome-pane {
  display: none; /* shown via the 900px media query above */
  flex: 1;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 10%, rgba(108,99,255,0.14) 0%, transparent 55%),
    radial-gradient(circle at 85% 90%, rgba(167,139,250,0.12) 0%, transparent 50%),
    var(--dark-header);
}
.welcome-pane-content {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 360px;
  padding: 32px;
}
.welcome-pane-logo {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  display: block;
  border-radius: 16px;
  filter: drop-shadow(0 0 24px rgba(108,99,255,0.4));
}
.welcome-pane-content h2 {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: #fff;
  margin-bottom: 10px;
}
.welcome-pane-content p {
  font-size: 14px;
  line-height: 1.7;
  color: var(--dark-text-2);
  margin-bottom: 22px;
}
.welcome-pane-content strong { color: #c4b5fd; }

/* 3. Chat wallpaper — opacity reduced ~25% across all three layers
   so it recedes behind messages instead of competing with them */
.chat-area {
  flex: 1;
  width: 100%;
  height: 100%;
  display: none;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  background-color: var(--dark-bg);
  background-image:
    radial-gradient(circle at 10% 0%, rgba(108,99,255,0.09) 0%, transparent 45%),
    radial-gradient(circle at 90% 100%, rgba(167,139,250,0.065) 0%, transparent 45%),
    url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.018'%3E%3Cpath d='M40 40c0-11 9-20 20-20s20 9 20 20-9 20-20 20-20-9-20-20zm-40 0c0-11 9-20 20-20s20 9 20 20-9 20-20 20-20-9-20-20z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  background-size: auto, auto, 80px 80px;
}
.app.chat-open .chat-area { display: flex; }

/* Chat header — dark, matches the app chrome */
.chat-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: var(--dark-header);
  border-bottom: 1px solid var(--dark-border);
  flex-shrink: 0;
  position: relative; z-index: 5;
  min-height: 58px;
}
.chat-header-name { font-size: 15px; font-weight: 700; color: #fff; }
.chat-header-sub { font-size: 12px; font-weight: 500; color: var(--online); min-height: 16px; }
.back-btn { display: flex; align-items: center; background: none; border: none; font-size: 22px; cursor: pointer; color: #fff; padding: 4px 6px 4px 0; }
.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all var(--t-fast) var(--ease);
  flex-shrink: 0;
}
.icon-btn:hover { background: rgba(0,0,0,0.06); }
.icon-btn svg { display: block; }
.icon-btn.dark { color: rgba(255,255,255,0.7); }
.icon-btn.dark:hover { background: rgba(255,255,255,0.08); color: #fff; }

/* ═══════════════════════════════════════════════════════════
   MESSAGES
   ═══════════════════════════════════════════════════════════ */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative; z-index: 1;
  /* Without a defined min-height:0 on a flex child that scrolls,
     some mobile browsers let this grow past its allotted space
     instead of scrolling internally, which is what shoves the
     header/input out of view. */
  min-height: 0;
  -webkit-overflow-scrolling: touch;
}

/* Date divider */
.date-divider {
  font-size: 11.5px; font-weight: 600;
  color: #667781;
  background: rgba(225,230,235,0.92);
  padding: 4px 14px;
  border-radius: var(--r-full);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  width: fit-content;
  align-self: center;
  margin: 10px auto;
}

/* msg-wrap: the real alignment layer — direct flex child of .messages,
   so green/mine → right and white/theirs → left is guaranteed
   regardless of how ReactableMessage lays out its own children. */
.msg-wrap {
  display: flex;
  width: 100%;
}
.msg-wrap.mine    { justify-content: flex-end; }
.msg-wrap.theirs  { justify-content: flex-start; }
.msg-wrap.system  { justify-content: center; }

.msg-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  align-self: flex-start;
  max-width: 82%;
  width: fit-content;
}
.msg-row.mine {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.msg-sender {
  font-size: 11.5px; font-weight: 700;
  color: var(--brand);
  margin-bottom: 2px;
  padding-left: 4px;
}
/* 2. Incoming bubbles — softened off-white instead of stark #ffffff,
   with a faint brand-tinted border so they feel part of the app's
   palette instead of a plain default white box */
.msg-bubble {
  display: inline-block;
  padding: 7px 12px 6px;
  font-size: 14.5px;
  line-height: 1.5;
  background: #f7f5ff;
  border: 1px solid rgba(108,99,255,0.08);
  border-radius: 0 8px 8px 8px;
  word-break: break-word;
  color: #1f1d2b;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  position: relative;
  max-width: 100%;
}
.msg-bubble::before {
  content: '';
  position: absolute;
  top: 0; left: -7px;
  border-style: solid;
  border-width: 0 7px 7px 0;
  border-color: transparent #f7f5ff transparent transparent;
}
.msg-row.mine .msg-bubble {
  background: #d9fdd3;
  border: none;
  border-radius: 8px 0 8px 8px;
  color: #111;
}
.msg-row.mine .msg-bubble::before {
  left: unset;
  right: -7px;
  border-width: 0 0 7px 7px;
  border-color: transparent transparent transparent #d9fdd3;
}
/* Once the other person has opened the chat and seen this message
   (tracked via useMessageStatus), give the bubble a purple outline
   in the app's brand color instead of the default flat edge. */
.msg-row.mine .msg-bubble.read {
  outline: 2px solid var(--brand-light);
  outline-offset: 1px;
}

/* 5. Timestamp — smaller and lighter */
.msg-time {
  font-size: 9.5px;
  color: rgba(134,150,160,0.75);
  margin-top: 3px;
  text-align: right;
  display: block;
  font-variant-numeric: tabular-nums;
}
/* "Delivered" / "Read" label under sent messages */
.msg-status {
  font-size: 10px;
  font-weight: 600;
  color: #8696a0;
  text-align: right;
  margin-top: 1px;
}
.msg-status.sent { opacity: 0.55; }
.msg-status.read { color: var(--brand-light); }

.email-msg { border-left: 3px solid var(--brand) !important; background: #f0f4ff !important; }
.email-tag { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700; color: var(--brand); background: rgba(108,99,255,0.1); padding: 2px 7px; border-radius: var(--r-full); margin-bottom: 4px; }

.typing-indicator { display: flex; gap: 4px; padding: 10px 14px; background: white; border-radius: 0 8px 8px 8px; width: fit-content; box-shadow: 0 1px 2px rgba(0,0,0,0.1); align-self: flex-start; }
.typing-indicator span { width: 7px; height: 7px; background: #adb5bd; border-radius: 50%; animation: typingBounce 1.2s infinite; }
.typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.3s; }
@keyframes typingBounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }

/* ═══════════════════════════════════════════════════════════
   REACTIONS
   ═══════════════════════════════════════════════════════════ */
.reaction-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 2px;
}
.msg-row.mine .reaction-chips-row { justify-content: flex-end; }

.reaction-chip {
  display: inline-flex; align-items: center; gap: 3px;
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 20px;
  padding: 2px 7px;
  font-size: 13px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: transform 0.12s;
  animation: chipPop 0.2s var(--spring);
  font-family: var(--font-body);
  line-height: 1.4;
}
.reaction-chip.mine { background: rgba(108,99,255,0.1); border-color: rgba(108,99,255,0.3); }
.reaction-chip:hover { transform: scale(1.12); }
.reaction-chip-count { font-size: 11px; font-weight: 700; color: #54656f; }
.reaction-chip.mine .reaction-chip-count { color: var(--brand); }

@keyframes chipPop {
  from { transform: scale(0.5); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

/* ── Input area ── */
.input-area {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 8px 16px 10px;
  background: var(--dark-header);
  border-top: 1px solid var(--dark-border);
  flex-shrink: 0;
  position: relative; z-index: 5;
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
}

.attach-btn { background: none; border: none; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; color: rgba(255,255,255,0.7); transition: all var(--t-fast); flex-shrink: 0; }
.attach-btn svg { display: block; }
.attach-btn:hover { background: rgba(255,255,255,0.08); transform: scale(1.08); }

.input-area textarea {
  flex: 1; resize: none;
  border: none; border-radius: 22px;
  padding: 10px 16px;
  font-size: 14.5px; font-family: var(--font-body);
  background: #ffffff; color: var(--text-primary);
  outline: none; max-height: 120px; overflow-y: auto;
  line-height: 1.5;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  /* iOS Safari zooms the page in if a focused input has font-size
     under 16px — this locks it at 16px on small screens so tapping
     the message box doesn't yank the whole layout out of place. */
  font-size: max(14.5px, 16px);
}
.input-area textarea::placeholder { color: #adb5bd; }

.send-btn { width: 42px; height: 42px; border-radius: 50%; background: var(--brand-grad); border: none; cursor: pointer; color: #fff; font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all var(--t-fast) var(--spring); box-shadow: 0 3px 10px rgba(108,99,255,0.4); }
.send-btn:hover { transform: scale(1.08); box-shadow: 0 5px 16px rgba(108,99,255,0.5); }
.send-btn:active { transform: scale(0.95); }
.send-btn:disabled { opacity: 0.4; cursor: default; transform: none; box-shadow: none; }

/* Pinned bar */
.pinned-bar { display: flex; align-items: center; gap: 8px; padding: 7px 16px; background: rgba(108,99,255,0.1); border-bottom: 1px solid rgba(108,99,255,0.18); font-size: 12.5px; color: #fff; cursor: pointer; transition: background var(--t-fast); flex-shrink: 0; z-index: 4; }
.pinned-bar:hover { background: rgba(108,99,255,0.16); }

/* Voice recorder */
.voice-recorder { display: flex; align-items: center; gap: 10px; background: white; border: 1.5px solid var(--border); border-radius: var(--r-full); padding: 8px 14px; flex: 1; }
.rec-dot { width: 9px; height: 9px; border-radius: 50%; background: #ef4444; animation: recPulse 1s infinite; flex-shrink: 0; }
@keyframes recPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
.rec-time { font-size: 13px; font-weight: 700; color: #ef4444; min-width: 36px; }
.rec-waves { display: flex; align-items: center; gap: 2px; flex: 1; height: 28px; }
.rec-wave-bar { width: 3px; border-radius: 2px; background: var(--brand); transition: height 0.06s; min-height: 3px; }

/* Voice message */
.voice-msg { display: flex; align-items: center; gap: 10px; padding: 8px 12px; min-width: 190px; }
.voice-play-btn { width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.voice-play-btn:hover { transform: scale(1.1); }
.waveform { display: flex; align-items: center; gap: 2px; flex: 1; height: 32px; }
.waveform-bar { width: 3px; border-radius: 2px; }
.voice-duration { font-size: 11px; font-weight: 600; flex-shrink: 0; }
.voice-transcript { font-size: 12px; padding: 5px 12px; cursor: pointer; border-top: 1px solid rgba(0,0,0,0.06); opacity: 0.7; }
.voice-transcript:hover { opacity: 1; }

/* Modals */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(6px); display: flex; align-items: flex-end; justify-content: center; z-index: 1000; padding-bottom: 20px; }
.modal-panel { background: white; border-radius: 24px 24px 16px 16px; padding: 24px; width: 100%; max-width: 480px; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; gap: 14px; animation: panelUp 0.28s var(--spring); }
@keyframes panelUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
.modal-header { display: flex; justify-content: space-between; align-items: center; }
.modal-title { font-family: var(--font-display); font-size: 16px; font-weight: 700; color: var(--text-primary); }
.modal-close { background: var(--bg-app); border: none; color: var(--text-muted); font-size: 14px; cursor: pointer; padding: 5px 8px; border-radius: var(--r-sm); }
.modal-close:hover { background: #fee2e2; color: #ef4444; }
.modal-textarea, .modal-input { background: var(--bg-app); border: 1.5px solid var(--border); border-radius: var(--r-md); color: var(--text-primary); font-size: 14px; padding: 11px 14px; outline: none; font-family: var(--font-body); width: 100%; }
.modal-textarea { resize: none; }
.modal-textarea:focus, .modal-input:focus { border-color: var(--brand); background: white; box-shadow: 0 0 0 3px rgba(108,99,255,0.1); }
.modal-preview { font-size: 13px; color: var(--text-secondary); background: var(--bg-app); border-radius: var(--r-sm); padding: 9px 13px; border-left: 3px solid var(--brand); }
.modal-error { font-size: 13px; color: #dc2626; background: #fff1f2; border-radius: var(--r-sm); padding: 8px 12px; }
.scheduled-item { background: var(--bg-app); border-radius: var(--r-md); padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; border-left: 3px solid var(--brand); }
.scheduled-content { color: var(--text-primary); font-size: 14px; line-height: 1.4; }
.scheduled-meta { display: flex; justify-content: space-between; align-items: center; }
.scheduled-time { font-size: 12px; color: var(--text-muted); font-weight: 500; }
.scheduled-countdown { font-size: 11px; color: var(--brand); font-weight: 700; background: var(--brand-soft); border-radius: var(--r-full); padding: 2px 8px; }
.scheduled-cancel { align-self: flex-start; background: none; border: 1px solid rgba(239,68,68,0.3); color: #ef4444; border-radius: var(--r-sm); padding: 4px 10px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--font-body); }
.email-badge { font-size: 11px; font-weight: 600; color: var(--brand); background: var(--brand-soft); padding: 4px 10px; border-radius: var(--r-full); border: 1px solid rgba(108,99,255,0.18); white-space: nowrap; }
button.email-badge { cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-body); }
.scheduled-link-btn { background: var(--brand-soft); border: none; font-size: 12px; font-weight: 600; color: var(--brand); cursor: pointer; padding: 5px 10px; border-radius: var(--r-full); display: flex; align-items: center; gap: 4px; font-family: var(--font-body); }

/* Email form */
.email-form-page { min-height: 100vh; min-height: var(--app-height); background: var(--panel-bg); display: flex; align-items: center; justify-content: center; padding: 20px; font-family: var(--font-body); }
.email-form-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 36px; width: 100%; max-width: 460px; display: flex; flex-direction: column; gap: 24px; }
.email-form-header { display: flex; align-items: center; gap: 14px; }
.email-form-logo-img { width: 48px; height: 48px; border-radius: 14px; }
.email-form-title { font-family: var(--font-display); font-size: 22px; font-weight: 800; color: #fff; margin: 0; }
.email-form-sub { font-size: 14px; color: rgba(255,255,255,0.45); margin: 4px 0 0; }
.email-form-body { display: flex; flex-direction: column; gap: 16px; }
.email-form-field { display: flex; flex-direction: column; gap: 6px; }
.email-form-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.07em; }
.email-form-input { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--r-md); color: #fff; font-size: 15px; padding: 11px 14px; outline: none; font-family: var(--font-body); width: 100%; }
.email-form-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(108,99,255,0.2); }
.email-form-input::placeholder { color: rgba(255,255,255,0.2); }
.email-form-textarea { resize: vertical; min-height: 100px; }
.email-form-error { font-size: 13px; color: #fca5a5; padding: 10px 13px; background: rgba(252,165,165,0.1); border-radius: var(--r-sm); }
.email-form-btn { background: var(--brand-grad); color: #fff; border: none; border-radius: var(--r-md); padding: 14px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: var(--font-body); }
.email-form-btn:hover:not(:disabled) { transform: translateY(-1px); }
.email-form-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.email-form-success-icon { font-size: 48px; text-align: center; }
.email-form-footer { font-size: 12px; color: rgba(255,255,255,0.25); text-align: center; }
.email-form-footer a { color: var(--brand-light); text-decoration: none; }

/* Animations */
@keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
@keyframes menuPop { from { opacity: 0; transform: translateY(6px) scale(0.96); } to { opacity: 1; transform: none; } }
@keyframes scheduledPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(108,99,255,0.15); } 50% { box-shadow: 0 0 0 4px rgba(108,99,255,0.06); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* ═══════════════════════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════════════════════ */
@media (max-width: 639px) {
  /* NOTE: `position: fixed` on html/body used to live here as an
     attempt to stop mobile browsers from scrolling the page when
     their address bar hid/showed. In practice it backfired: combined
     with 100vh (taller than the real visible area), the browser
     would land the page scrolled up with the top content (the
     header) parked off-screen and unreachable, since fixed
     positioning blocks the user from ever scrolling back up to it.
     100dvh (see --app-height above) solves the actual sizing
     problem, so this hack is no longer needed. */
  html, body { width: 100%; overflow: hidden; }
  .app { border-radius: 0; box-shadow: none; margin: 0; height: 100vh; height: var(--app-height); }
}

/* ═══════════════════════════════════════════════════════════
   AUTH PAGE — MOBILE: single centered glowing card
   ═══════════════════════════════════════════════════════════ */
@media (max-width: 639px) {
  .auth-page {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: var(--app-height);
    padding: 24px 16px;
    background: var(--panel-bg);
    overflow-y: auto;
  }

  /* Collapse the left brand panel into a compact header above the card
     instead of a full-height side panel */
  .auth-left {
    width: 100%;
    min-height: 0;
    padding: 8px 8px 28px;
    flex-shrink: 0;
  }
  .auth-left::before, .auth-left::after { display: none; }
  .auth-left-inner { max-width: 320px; text-align: center; }
  .auth-brand { margin-bottom: 24px; }
  .auth-brand-logo { margin: 0 auto 14px; }
  .auth-brand-name { font-size: 30px; }
  .auth-brand-tagline { font-size: 14px; }

  /* Hide the feature list + footer on mobile — the card is the focus */
  .auth-features, .auth-left-footer { display: none; }

  /* The card itself: centered, fixed width, glowing border */
  .auth-right {
    width: 100%;
    max-width: 400px;
    padding: 0;
    background: transparent;
    flex: none;
  }
  .auth-form-wrap {
    background: #ffffff;
    border-radius: 22px;
    padding: 28px 24px 24px;
    box-shadow:
      0 0 0 1px rgba(108,99,255,0.15),
      0 8px 30px rgba(0,0,0,0.35),
      0 0 40px rgba(108,99,255,0.12);
    transition: box-shadow 0.3s var(--ease);
  }

  /* Glow when the card is being interacted with — tapping into any
     field, or the whole wrap on :active for a touch-feedback pulse */
  .auth-form-wrap:focus-within {
    box-shadow:
      0 0 0 1.5px rgba(108,99,255,0.5),
      0 8px 30px rgba(0,0,0,0.35),
      0 0 50px rgba(108,99,255,0.35),
      0 0 90px rgba(167,139,250,0.2);
  }
}

/* Field-level glow on focus — theme purple, works everywhere,
   not just mobile */
.field input:focus {
  box-shadow:
    0 0 0 3px rgba(108,99,255,0.18),
    0 0 16px rgba(108,99,255,0.25);
}

/* Touch/tap feedback pulse for the whole card, mobile only */
@media (max-width: 639px) {
  @keyframes cardTouchGlow {
    0%   { box-shadow: 0 0 0 1px rgba(108,99,255,0.15), 0 8px 30px rgba(0,0,0,0.35), 0 0 40px rgba(108,99,255,0.12); }
    50%  { box-shadow: 0 0 0 2px rgba(108,99,255,0.6), 0 8px 30px rgba(0,0,0,0.35), 0 0 60px rgba(108,99,255,0.4); }
    100% { box-shadow: 0 0 0 1px rgba(108,99,255,0.15), 0 8px 30px rgba(0,0,0,0.35), 0 0 40px rgba(108,99,255,0.12); }
  }
  .auth-form-wrap:active {
    animation: cardTouchGlow 0.6s var(--ease);
  }
}


@media (max-width: 380px) {
  .top-header { padding: 10px 12px 10px; }
  .top-header-name { font-size: 16px; }
  .story-ring, .story-add-circle { width: 48px; height: 48px; }
  .list-tabs { padding: 12px 12px 8px; }
  .messages { padding: 8px 10px; }
}

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
/* ═══════════════════════════════════════════════════════════
   STATUS FEATURE
   ═══════════════════════════════════════════════════════════ */
.status-ring-wrap {
  border-radius: 50%;
  padding: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform var(--t-fast);
}
.status-ring-none { background: transparent; padding: 0; }
.status-ring-viewed { background: rgba(255,255,255,0.2); }
.status-ring-active {
  background: linear-gradient(135deg, #a855f7, #6c63ff, #ec4899);
  box-shadow: 0 0 10px 1px rgba(168,85,247,0.5);
  animation: statusRingGlow 2.2s ease-in-out infinite;
}
@keyframes statusRingGlow {
  0%, 100% { box-shadow: 0 0 8px 0px rgba(168,85,247,0.45); }
  50%      { box-shadow: 0 0 16px 3px rgba(168,85,247,0.75); }
}
.status-ring-inner {
  width: 100%; height: 100%;
  border-radius: 50%;
  background: var(--dark-bg);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.story-item:hover .status-ring-active,
.story-item:hover .status-ring-viewed { transform: scale(1.05); }

.status-add-badge {
  position: absolute;
  bottom: -2px; right: -2px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--brand-grad);
  border: 2px solid var(--dark-bg);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(108,99,255,0.6);
}

.status-tab { flex: 1; overflow-y: auto; padding: 6px 0 90px; }
.status-tab-mine, .status-tab-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background var(--t-fast);
}
.status-tab-mine:hover, .status-tab-row:hover { background: rgba(255,255,255,0.05); }
.status-tab-section-label {
  font-size: 11.5px; font-weight: 700; color: var(--dark-text-3);
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 14px 16px 6px;
}

.status-compose-panel { background: var(--dark-card-2); }
.status-compose-panel .modal-title { color: #fff; }
.status-text-preview {
  border-radius: var(--r-lg);
  min-height: 220px;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.status-text-input {
  width: 100%;
  background: none; border: none; outline: none; resize: none;
  color: #fff; font-size: 20px; font-weight: 700; text-align: center;
  font-family: var(--font-display);
  min-height: 120px;
}
.status-text-input::placeholder { color: rgba(255,255,255,0.6); }
.status-bg-swatches { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.status-bg-swatch { width: 30px; height: 30px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
.status-bg-swatch.active { border-color: #fff; transform: scale(1.1); }
.status-media-preview {
  border-radius: var(--r-lg); overflow: hidden;
  max-height: 320px; display: flex; align-items: center; justify-content: center;
  background: #000;
}
.status-media-preview img, .status-media-preview video { width: 100%; max-height: 320px; object-fit: contain; }
.status-pick-btn {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 40px 20px;
  border: 1.5px dashed var(--dark-border);
  border-radius: var(--r-lg);
  background: rgba(255,255,255,0.03);
  color: var(--dark-text-2);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 13.5px; font-weight: 600;
}
.status-pick-btn:hover { background: rgba(255,255,255,0.06); }

.status-viewer-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: #000;
  display: flex; flex-direction: column;
  color: #fff;
  user-select: none;
}
.status-viewer-bars { display: flex; gap: 4px; padding: 8px 10px 0; }
.status-viewer-bar { flex: 1; height: 2.5px; background: rgba(255,255,255,0.25); border-radius: 2px; overflow: hidden; }
.status-viewer-bar-fill { height: 100%; background: #fff; }
.status-viewer-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; }
.status-viewer-user { display: flex; align-items: center; gap: 10px; }
.status-viewer-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--brand-grad);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px;
}
.status-viewer-name { font-size: 13.5px; font-weight: 700; }
.status-viewer-time { font-size: 11px; color: rgba(255,255,255,0.55); }
.status-viewer-icon-btn {
  background: rgba(255,255,255,0.1); border: none; color: #fff;
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.status-viewer-body {
  flex: 1; display: flex; align-items: center; justify-content: center;
  position: relative; padding: 10px 14px;
}
.status-viewer-text {
  width: 100%; height: 100%; border-radius: var(--r-lg);
  display: flex; align-items: center; justify-content: center;
  text-align: center; padding: 32px; font-size: 24px; font-weight: 700;
  font-family: var(--font-display); color: #fff;
}
.status-viewer-media { max-width: 100%; max-height: 100%; border-radius: var(--r-md); object-fit: contain; }
.status-viewer-caption {
  position: absolute; bottom: 20px; left: 14px; right: 14px;
  text-align: center; font-size: 13.5px; background: rgba(0,0,0,0.4);
  padding: 8px 14px; border-radius: var(--r-md);
}
.status-viewer-nav { position: absolute; inset: 44px 0 0 0; display: flex; }
.status-viewer-nav-zone { flex: 1; background: none; border: none; cursor: pointer; }
.status-viewer-footer {
  padding: 10px 16px calc(16px + env(safe-area-inset-bottom,0px));
  font-size: 12.5px; color: rgba(255,255,255,0.6); text-align: center;
}
/* ═══════════════════════════════════════════════════════════
   DESKTOP SIDEBAR FIX — must stay last in the file.
   ".app.chat-open .sidebar { display: none; }" further up has the
   exact same specificity as this rule. On a specificity tie, CSS
   falls back to source order — whichever rule is physically later
   in the file wins, media query or not. This has to come after
   that rule (not just be "inside a media query") or it silently
   loses and the chat takes over the full screen on desktop too.
   ═══════════════════════════════════════════════════════════ */
@media (min-width: 900px) {
  .app.chat-open .sidebar {
    display: flex;
    width: 420px;
    max-width: 420px;
    flex-shrink: 0;
    border-right: 1px solid var(--dark-border);
  }
}
.auth-forgot-link {
  background: none; border: none; cursor: pointer;
  font-size: 12.5px; font-weight: 600; color: var(--brand);
  text-align: right; margin: -8px 0 16px; padding: 0;
  font-family: var(--font-body);
}
.auth-forgot-link:hover { text-decoration: underline; }

.auth-back-link {
  background: none; border: none; cursor: pointer;
  font-size: 13px; font-weight: 600; color: var(--text-muted);
  padding: 0; margin-top: 4px; font-family: var(--font-body);
}
.auth-back-link:hover { color: var(--brand); }
  const otherUserId = activeConvo && !activeConvo.isCurryAI ? getOtherUserId(activeConvo, userId) : null

  const onHeyCurryActivated = useCallback(() => setActiveConvo(CURRY_AI_CONTACT), [])
  // autoStart: false — "hey curry" listening is now an explicit
  // opt-in (see the mic toggle button in the header) instead of
  // running in the background from the moment the app loads, which
  // is what was causing the mic indicator to flicker on/off.
  const { listening: heyCurryListening, startListening: startHeyCurry, stopListening: stopHeyCurry } =
    useHeyCurry(onHeyCurryActivated, { autoStart: false })

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => setProfile(data))
  }, [userId])

  // Which conversations has this user shared with Curry — powers the
  // sparkle badge in the list. Read directly off the table (RLS scopes
  // it to the signed-in user already) rather than round-tripping
  // through the edge function just to list ids.
  const loadSharedConvoIds = useCallback(async () => {
    const { data } = await supabase
      .from('curry_shared_conversations')
      .select('conversation_id')
      .eq('user_id', userId)
    setSharedConvoIds(new Set((data || []).map(r => r.conversation_id)))
  }, [userId])

  useEffect(() => { loadSharedConvoIds() }, [loadSharedConvoIds])

  const loadEmailAccounts = useCallback(async () => {
    try { setEmailAccounts(await listEmailAccounts(session)) } catch (e) { console.error('listEmailAccounts failed:', e) }
  }, [session])

  useEffect(() => { loadEmailAccounts() }, [loadEmailAccounts])

  // Google redirects the browser back here (via the gmail-oauth edge
  // function) with ?email_connect=success|denied|expired|error after
  // the user finishes the consent screen. This is the ONE place that
  // reads it, shows a one-time confirmation, refreshes the connected
  // accounts list, and then strips the params from the URL so a
  // refresh doesn't re-trigger the alert.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('email_connect')
    if (!status) return

    if (status === 'success') {
      const email = params.get('email')
      alert(`Gmail connected${email ? `: ${email}` : ''} ✓\n\nCurry can now send real emails from this account when you ask it to.`)
      loadEmailAccounts()
    } else if (status === 'denied') {
      alert('Gmail connection was cancelled.')
    } else if (status === 'expired') {
      alert('That connection attempt expired — please try "Connect Gmail" again.')
    } else {
      alert('Could not connect Gmail. Please try again.')
    }

    params.delete('email_connect')
    params.delete('email')
    const cleanUrl = window.location.pathname + (params.toString() ? `?${params}` : '')
    window.history.replaceState({}, '', cleanUrl)
  }, [loadEmailAccounts])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => { if (activeConvo) window.history.pushState({ chatOpen: true }, '') }, [activeConvo])

  useEffect(() => {
    const handlePopState = () => setActiveConvo(null)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    setShowVoice(false); setShowPoll(false); setShowTask(false)
    setShowScheduler(false); setShowScheduledList(false); setShowSearch(false)
    setShowCurryAssistant(false); setShowThreeDot(false)
    setHasScheduled(false); setShowEmojiPicker(false)
  }, [activeConvo])

  useEffect(() => {
    if (!activeConvo?.id || activeConvo.isCurryAI) return
    async function checkScheduled() {
      const { data } = await supabase.from('scheduled_messages').select('id')
        .eq('conversation_id', activeConvo.id).eq('sender_id', userId).eq('status', 'pending').limit(1)
      setHasScheduled((data || []).length > 0)
    }
    checkScheduled()
    const sub = supabase.channel(`sched-check:${activeConvo.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_messages', filter: `conversation_id=eq.${activeConvo.id}` }, checkScheduled)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [activeConvo, userId])

  useEffect(() => {
    const interval = setInterval(() => { supabase.functions.invoke('send-scheduled-messages') }, 60000)
    return () => clearInterval(interval)
  }, [])
 useEffect(() => {
  const interval = setInterval(() => { supabase.functions.invoke('cleanup-expired-statuses') }, 5 * 60000)
  return () => clearInterval(interval)
}, [])
  // "Deletes" a conversation for THIS user only. It doesn't touch the
  // conversations/messages/members rows at all — it just records that
  // you've hidden this conversation (hidden_conversations table), so:
  //   - the other person's chat list and messages are completely
  //     unaffected
  //   - Curry AI settings, pinned messages, etc. all stay intact
  //   - if either of you texts again, getOrCreateConversation finds
  //     the same conversation and un-hides it for you automatically,
  //     instead of creating a duplicate thread
  const deleteConversation = async (convoId) => {
    if (!window.confirm('Delete this conversation? It will be removed from your list, but the other person will still see it, and it\'ll come back if either of you messages again.')) return

    try {
      await hideConversationForUser(userId, convoId)
    } catch (err) {
      console.error('deleteConversation (hide) failed:', err)
      alert(`Could not delete this conversation: ${err.message}`)
      return
    }

    if (activeConvo?.id === convoId) setActiveConvo(null)
    await reload()
  }

  const pinMessage = async (msgId) => {
    const { error } = await supabase.from('pinned_messages').insert({ conversation_id: activeConvo.id, message_id: msgId, pinned_by: userId })
    if (error) alert('Already pinned or could not pin message')
    else setPinnedRefresh(v => v + 1)
  }

  const scrollToMessage = (msgId) => { msgRefs.current[msgId]?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }

  // Opens a conversation and immediately clears its unread badge —
  // the actual "mark as read" DB write still happens via
  // useMessageStatus once messages load, this just makes the badge
  // disappear instantly instead of waiting on that round trip.
  const openConvo = (c) => {
    setActiveConvo(c)
    clearUnread(c.id)
  }

  const startNewChat = async (e) => {
    e.preventDefault()
    try {
      const convoId = await getOrCreateConversation(userId, newContact)
      await reload()
      const found = conversations.find(c => c.id === convoId)
      if (found) setActiveConvo(found)
      setShowNewChat(false); setNewContact('')
    } catch (err) { alert(err.message) }
  }

  // Explicitly bumps a conversation's updated_at/last_message from the
  // client the moment a message is sent. This is what makes the story
  // rail (and the chat list) reorder by "who messaged most recently"
  // reliably — it doesn't depend on a Supabase trigger existing, and
  // it also nudges useConversations' realtime UPDATE listener so every
  // connected client re-sorts, not just this one.
  const bumpConversationActivity = async (previewText) => {
    if (!activeConvo?.id || activeConvo.isCurryAI) return
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString(), last_message: previewText })
      .eq('id', activeConvo.id)
    reload()
  }

  // "hey curry ..." inside a normal 1:1/group chat never reaches the
  // other person — it's routed to the in-chat Curry instead, and
  // Curry's reply is inserted straight into this conversation's own
  // message stream (message_type: 'curry') so everyone sees it. This
  // only works once every member of the chat has opted in via
  // CurryChatToggle; otherwise we fall back to sending the text
  // normally so nothing gets silently lost.
  const handleSend = async () => {
    if (!inputText.trim() || !activeConvo) return
    broadcastTyping(false)
    const text = inputText.trim()

    if (!activeConvo.isCurryAI) {
      const match = text.match(CURRY_TRIGGER)
      if (match) {
        setInputText('')
        setCurryChatBusy(true)
        const question = text.slice(match[0].length).trim() || text
        try {
          const data = await callCurryAI('chat_ask', { conversationId: activeConvo.id, question }, session)
          if (!data.ok && data.reason === 'no_consent') {
            alert("Curry isn't turned on for this chat yet — both people need to enable it first (✨ icon → Invite Curry into this chat).")
            await sendMessage(text)
            bumpConversationActivity(text)
          }
          // On success Curry's reply arrives via the realtime messages
          // subscription (it was inserted server-side), so nothing
          // else to do here.
        } catch (err) {
          alert('Curry could not respond right now. Please try again.')
        }
        setCurryChatBusy(false)
        return
      }
    }

    await sendMessage(text)
    setInputText('')
    bumpConversationActivity(text)
  }

  const handleTyping = (e) => {
    setInputText(e.target.value)
    broadcastTyping(true)
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => broadcastTyping(false), 1500)
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  const handleShare = () => {
    const link = `https://mattchat-nine.vercel.app/email/${profile?.username || ''}`
    navigator.clipboard.writeText(link)
    alert('Contact link copied!')
  }

  const handleEmojiSelect = (emoji) => {
    const ta = textareaRef.current
    if (ta) {
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const next = inputText.slice(0, start) + emoji + inputText.slice(end)
      setInputText(next)
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + emoji.length; ta.focus() })
    } else {
      setInputText(prev => prev + emoji)
    }
  }

  const handleStickerSelect = async (sticker) => {
    if (!activeConvo) return
    setShowEmojiPicker(false)
    await sendMessage(`sticker:${sticker.emoji}:${sticker.label}`)
    bumpConversationActivity(`${sticker.emoji} Sticker`)
  }

  const handleGifSelect = async (gif) => {
    if (!activeConvo) return
    setShowEmojiPicker(false)
    await sendMessage(`gif:${gif.url}::${gif.title}`)
    bumpConversationActivity('GIF')
  }

  const getConvoName = (c) => {
    if (c.isCurryAI) return 'Curry AI'
    if (c.is_group) return c.name
    const other = c.conversation_members?.find(m => m.user_id !== userId)
    return other?.profiles?.username || other?.profiles?.email || 'Unknown'
  }

  const searchFiltered = conversations.filter(c => getConvoName(c).toLowerCase().includes(search.toLowerCase()))
  const filtered = searchFiltered.filter(c => listFilter === 'all' ? true : !!c.is_group)
 
  
  const headerStatus = () => {
    if (callStatus === 'calling')    return '📞 Calling…'
    if (callStatus === 'ringing')    return '📞 Ringing…'
    if (callStatus === 'connecting') return '📞 Connecting…'
    if (callStatus === 'in-call')    return '🟢 On a call'
    if (typing.length > 0)           return `${getConvoName(activeConvo)} is typing…`
    if (otherUserId && isOnline(otherUserId)) return 'Online'
    return ''
  }

  const callActive = ['calling', 'ringing', 'connecting', 'in-call'].includes(callStatus)

  return (
    <div className={`app ${activeConvo ? 'chat-open' : ''}`}>

      {/* ── INCOMING CALL ── */}
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

      {/* ── LIST / BROWSE SCREEN (hidden once a conversation is open) ── */}
      <div className="sidebar">
        <div className="top-header">
          <div className="top-header-brand">
            <img src="/logo.png" alt="Mattchat" className="top-header-logo" />
            <span className="top-header-name">Mattchat</span>
            <button
              className="top-header-search-btn"
              onClick={() => setShowSearchBar(v => !v)}
              title="Search"
            >
              <IconSearch size={16} />
            </button>
            <button
              className="top-header-search-btn"
              onClick={() => (heyCurryListening ? stopHeyCurry() : startHeyCurry())}
              title={heyCurryListening ? '"Hey Curry" listening is on — tap to turn off' : 'Turn on "Hey Curry" listening'}
              style={{ color: heyCurryListening ? '#a78bfa' : undefined, background: heyCurryListening ? 'rgba(167,139,250,0.15)' : undefined }}
            >
              <IconMic size={16} />
            </button>
          </div>

          {/* ── STORY / QUICK-CONTACT RAIL ── */}
         {activeTab === 'chats' && (
  <div className="story-rail">
    <button className="story-item" onClick={() => openViewer('mine')} title="My status">
      <div className="story-avatar-wrap">
        <StatusRing size={58} hasStatus={myStatuses.length > 0} viewed>
          <Avatar name={profile?.username || 'You'} size={52} />
        </StatusRing>
        <button
          className="status-add-badge"
          onClick={(e) => { e.stopPropagation(); setShowAddStatus(true) }}
          title="Add status"
        >
          <IconPlus size={11} />
        </button>
      </div>
      <span className="story-label">My status</span>
    </button>

    {statusGroups.map(group => (
      <button key={group.userId} className="story-item" onClick={() => openViewer(group.userId)} title={group.profile.username}>
        <StatusRing size={58} hasStatus viewed={group.allViewed}>
          <Avatar name={group.profile.username} size={52} />
        </StatusRing>
        <span className="story-label">{(group.profile.username || 'Unknown').split(' ')[0]}</span>
      </button>
    ))}
  </div>
)}
        </div>

        {/* ── LIST CARD ── */}
        <div className="list-card">
          {activeTab === 'chats' && (
            <>
              <div className="list-tabs">
                <button className={listFilter === 'all' ? 'active' : ''} onClick={() => setListFilter('all')}>Chats</button>
                <button className={listFilter === 'group' ? 'active' : ''} onClick={() => setListFilter('group')}>Group</button>
              </div>

              {showSearchBar && (
                <div className="search-box">
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…" autoFocus />
                </div>
              )}

              {showNewChat && (
                <form className="new-chat-form" onSubmit={startNewChat}>
                  <input type="text" value={newContact} onChange={e => setNewContact(e.target.value)} placeholder="Username or email" required autoFocus />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }}>Start chat</button>
                    <button type="button" className="btn-ghost" onClick={() => setShowNewChat(false)}>Cancel</button>
                  </div>
                </form>
              )}

              <div className="contact-list">
                {listFilter === 'all' && (
                  <div className={`contact ${activeConvo?.isCurryAI ? 'active' : ''}`} onClick={() => setActiveConvo(CURRY_AI_CONTACT)}>
                    <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flexShrink: 0 }}>✨</div>
                    <div className="contact-info">
                      <div className="contact-name" style={{ color: '#a78bfa' }}>✨ Curry AI</div>
                      <div className="contact-preview">Your personal AI assistant</div>
                    </div>
                  </div>
                )}

                {convLoading && <div className="loading-state">Loading…</div>}

                {filtered.map(c => {
                  const otherId = getOtherUserId(c, userId)
                  const online  = otherId ? isOnline(otherId) : false
                  const unread  = unreadCounts[c.id] || 0
                  return (
                    <div key={c.id} className={`contact ${activeConvo?.id === c.id ? 'active' : ''}`} onClick={() => openConvo(c)}>
                      <div className="contact-avatar-wrap">
                        <Avatar name={getConvoName(c)} online={online} size={46} />
                        {unread > 0 && <span className="unread-badge">{unread > 9 ? '9+' : unread}</span>}
                        {sharedConvoIds.has(c.id) && (
                          <span className="shared-badge" title="Shared with Curry">
                            <IconSparkle size={9} />
                          </span>
                        )}
                      </div>
                      <div className="contact-info">
                        <div className={`contact-name ${unread > 0 ? 'unread' : ''}`}>{getConvoName(c)}</div>
                        <div className={`contact-preview ${unread > 0 ? 'unread' : ''}`}>{c.last_message || 'No messages yet'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <div className="contact-time">{c.updated_at ? formatMsgTime(c.updated_at) : ''}</div>
                        <button className="delete-chat-btn" onClick={e => { e.stopPropagation(); deleteConversation(c.id) }}>🗑️</button>
                      </div>
                    </div>
                  )
                })}

                {!convLoading && filtered.length === 0 && (
                  <div className="empty-state">
                    <p>{listFilter === 'group' ? 'No group chats yet.' : 'No conversations yet.'}</p>
                    <button className="btn-primary" onClick={() => setShowNewChat(true)}>Start one →</button>
                  </div>
                )}
              </div>
            </>
          )}

   {activeTab === 'status' && (
  <div className="status-tab">
    <div className="status-tab-mine" onClick={() => openViewer('mine')}>
      <div className="story-avatar-wrap">
        <StatusRing size={54} hasStatus={myStatuses.length > 0} viewed>
          <Avatar name={profile?.username || 'You'} size={48} />
        </StatusRing>
        <button className="status-add-badge" onClick={(e) => { e.stopPropagation(); setShowAddStatus(true) }}>
          <IconPlus size={11} />
        </button>
      </div>
      <div className="contact-info">
        <div className="contact-name">My status</div>
        <div className="contact-preview">
          {myStatuses.length > 0
            ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''} · tap to view`
            : 'Tap to add a status update'}
        </div>
      </div>
    </div>

    {statusGroups.length > 0 && <div className="status-tab-section-label">Recent updates</div>}

    {statusGroups.map(group => (
      <div key={group.userId} className="status-tab-row" onClick={() => openViewer(group.userId)}>
        <StatusRing size={54} hasStatus viewed={group.allViewed}>
          <Avatar name={group.profile.username} size={48} />
        </StatusRing>
        <div className="contact-info">
          <div className="contact-name">{group.profile.username || 'Unknown'}</div>
          <div className="contact-preview">{formatMsgTime(group.statuses[group.statuses.length - 1].created_at)}</div>
        </div>
      </div>
    ))}

    {statusGroups.length === 0 && myStatuses.length === 0 && (
      <div className="empty-state">No status updates yet. Be the first to share one!</div>
    )}
  </div>
)}

          {activeTab === 'calls' && (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>📞</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: '#fff' }}>Recent calls</div>
              <div style={{ fontSize: 13 }}>Your call history will appear here</div>
            </div>
          )}
        </div>

        {showProfileMenu && (
          <div className="profile-menu-overlay" onClick={() => setShowProfileMenu(false)}>
            <div className="profile-menu" onClick={e => e.stopPropagation()}>
              <Avatar name={profile?.username || session.user.email} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.username || 'You'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.user.email}
                </div>
              </div>
              <button
                onClick={async () => {
                  if (connectingGmail) return
                  setConnectingGmail(true)
                  try { await connectGmail(session) } catch (err) { alert(err.message); setConnectingGmail(false) }
                }}
                disabled={connectingGmail}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(167,139,250,0.12)',
                  border: '1px solid rgba(167,139,250,0.3)', borderRadius: 10, color: '#c4b5fd',
                  fontSize: 12.5, fontWeight: 700, padding: '8px 12px', cursor: connectingGmail ? 'default' : 'pointer',
                  fontFamily: 'inherit', opacity: connectingGmail ? 0.6 : 1, whiteSpace: 'nowrap',
                }}
                title={emailAccounts.length > 0 ? `Connected: ${emailAccounts.map(a => a.email_address).join(', ')}` : 'Let Curry send real emails on your behalf'}
              >
                ✉️ {connectingGmail ? 'Connecting…' : emailAccounts.length > 0 ? `Gmail connected (${emailAccounts.length})` : 'Connect Gmail'}
              </button>
              <button className="profile-menu-signout" onClick={signOut}>⏏ Sign out</button>
            </div>
          </div>
        )}
{showAddStatus && (
  <AddStatusModal userId={userId} onClose={() => setShowAddStatus(false)} onPosted={reloadStatuses} />
)}

{viewerIndex !== null && viewableGroups[viewerIndex] && (
  <StatusViewer
    group={viewableGroups[viewerIndex]}
    isMine={viewableGroups[viewerIndex].isMine}
    onClose={() => setViewerIndex(null)}
    onViewed={markViewed}
    onDeleted={reloadStatuses}
    onNextGroup={viewerIndex < viewableGroups.length - 1 ? () => setViewerIndex(i => i + 1) : undefined}
    onPrevGroup={viewerIndex > 0 ? () => setViewerIndex(i => i - 1) : undefined}
  />
)}
        {/* Always rendered — on mobile/tablet this is hidden automatically
            because the whole .sidebar hides when a chat is open; on desktop
            the sidebar (and this) stays visible the whole time. */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onNewChat={() => setShowNewChat(true)}
          onProfileClick={() => setShowProfileMenu(v => !v)}
        />
      </div>

      {/* ── WELCOME PANE — desktop only. Fills the space next to the
           sidebar when no conversation is open. Hidden on narrow
           screens (no room for it) and hidden entirely once a
           conversation is open, at any screen size. ── */}
      <div className="welcome-pane">
        <div className="welcome-pane-content">
          <img src="/logo.png" alt="" className="welcome-pane-logo" />
          <h2>Welcome to Mattchat</h2>
          <p>The best AI communication platform.<br />Select a conversation or start a new one — say <strong>"Hey Curry"</strong> to activate your AI assistant!</p>
          <button className="btn-primary" onClick={() => setShowNewChat(true)}>Start a conversation →</button>
        </div>
      </div>

      {/* ── CHAT AREA ── */}
      {activeConvo && (
        activeConvo.isCurryAI ? (
          <div className="chat-area" style={{ background: 'linear-gradient(180deg,#0f0f1a 0%,#1a1a2e 100%)' }}>
            <div className="chat-header">
              <button className="back-btn" onClick={() => setActiveConvo(null)}>←</button>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✨</div>
              <div style={{ flex: 1 }}>
                <div className="chat-header-name">✨ Curry AI</div>
                <div className="chat-header-sub" style={{ color: '#a78bfa' }}>Always learning, always here</div>
              </div>
            </div>
            <CurryAIChat session={session} />
          </div>
        ) : (
          <div className="chat-area">
            {/* Header */}
            <div className="chat-header">
              <button className="back-btn" onClick={() => setActiveConvo(null)}>←</button>
              <Avatar name={getConvoName(activeConvo)} size={36} online={otherUserId ? isOnline(otherUserId) : false} />
              <div style={{ flex: 1 }}>
                <div className="chat-header-name">{getConvoName(activeConvo)}</div>
                <div className="chat-header-sub" style={{ minHeight: 16 }}>{headerStatus()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {callStatus === 'idle' && (
                  <CallButtons onVoiceCall={() => startCall('audio')} onVideoCall={() => startCall('video')} disabled={false} />
                )}
                {callActive && (
                  <button onClick={endCall} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 'var(--r-full)', padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#f87171' }}>📵 End call</button>
                )}
                <button className="icon-btn dark" onClick={() => setShowCurryAssistant(v => !v)} title="Curry AI assistant"><IconSparkle size={16} /></button>
                {hasScheduled && (
                  <button onClick={() => setShowScheduledList(true)} title="View scheduled messages"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 'var(--r-full)', padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#c4b5fd', animation: 'scheduledPulse 2s ease infinite' }}>
                    🕐 <span style={{ fontSize: 11 }}>Scheduled</span>
                  </button>
                )}
                <div className="threedot-wrapper" style={{ position: 'relative' }}>
                  <button className="icon-btn dark" onClick={() => setShowThreeDot(v => !v)} title="More options"
                    style={{ color: showThreeDot ? '#a78bfa' : undefined, background: showThreeDot ? 'rgba(167,139,250,0.15)' : undefined }}><IconMoreVertical size={17} /></button>
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

            {callError && (
              <div style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', fontSize: 13, color: '#ef4444', fontWeight: 500 }}>
                ⚠️ {callError}
              </div>
            )}

            {(callStatus === 'calling' || callStatus === 'ringing') && (
              <div style={{ padding: '10px 16px', background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(99,102,241,0.08))', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'var(--accent-2)' }}>
                <span>📞</span>
                Calling {getConvoName(activeConvo)}…
                <button onClick={endCall} style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>
            )}

            <PinnedBar key={pinnedRefresh} conversationId={activeConvo?.id} onScrollTo={scrollToMessage} />

            {/* Messages */}
            <div className="messages">
              {msgLoading && <div className="loading-state">Loading messages…</div>}
              {messages.map((msg, i) => {
                const prev = messages[i - 1]
                const showDate = !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString()
                const isMissedCall = msg.content?.startsWith('missed_call:')
                const isCurryMsg = msg.message_type === 'curry'
                const isMine = msg.sender_id === userId
                const wrapClass = (isMissedCall || isCurryMsg) ? 'system' : (isMine ? 'mine' : 'theirs')
                return (
                  <React.Fragment key={msg.id}>
                    {showDate && <DateDivider date={msg.created_at} />}
                    <div
                      ref={el => msgRefs.current[msg.id] = el}
                      className={`msg-wrap ${wrapClass}`}
                      onContextMenu={e => { if (!isCurryMsg) { e.preventDefault(); pinMessage(msg.id) } }}
                      title={isCurryMsg ? undefined : 'Right-click to pin'}
                    >
                      {isCurryMsg ? (
                        <MessageBubble msg={msg} isMe={false} isRead={false} isDelivered={false} />
                      ) : (
                        <ReactableMessage
                          messageId={msg.id}
                          currentUserId={userId}
                          isMe={isMine}
                        >
                          <MessageBubble
                            msg={{ ...msg, _currentUserId: userId }}
                            isMe={isMine}
                            isRead={!!readMap[msg.id]}
                            isDelivered={!!deliveredMap[msg.id]}
                          />
                        </ReactableMessage>
                      )}
                    </div>
                  </React.Fragment>
                )
              })}
              {typing.length > 0 && <div className="typing-indicator"><span /><span /><span /></div>}
              {curryChatBusy && (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <div style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 600, padding: '6px 12px' }}>✨ Curry is thinking…</div>
                </div>
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
                  onShareChange={(convoId, isShared) => {
                    setSharedConvoIds(prev => {
                      const next = new Set(prev)
                      if (isShared) next.add(convoId); else next.delete(convoId)
                      return next
                    })
                  }}
                />
              )}
              {showPoll && (
                <div style={{ padding: '0 16px' }}>
                  <PollCreator conversationId={activeConvo.id} senderId={userId} onSent={() => setShowPoll(false)} onCancel={() => setShowPoll(false)} />
                </div>
              )}
              {showTask && (
                <div style={{ padding: '0 16px' }}>
                  <TaskCreator conversationId={activeConvo.id} senderId={userId} onSent={() => setShowTask(false)} onCancel={() => setShowTask(false)} />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '12px 16px', position: 'relative' }}>
                {!showVoice && (
                  <div style={{ position: 'relative' }}>
                    <button className="attach-btn" onClick={() => setShowEmojiPicker(v => !v)} title="Emoji, stickers & GIFs"
                      style={{ background: showEmojiPicker ? 'rgba(99,102,241,0.12)' : 'none', borderRadius: '50%', color: showEmojiPicker ? '#a78bfa' : undefined, transition: 'all 0.15s' }}>
                      <IconSmile size={20} />
                    </button>
                    {showEmojiPicker && (
                      <EmojiPicker onEmojiSelect={handleEmojiSelect} onStickerSelect={handleStickerSelect} onGifSelect={handleGifSelect} onClose={() => setShowEmojiPicker(false)} />
                    )}
                  </div>
                )}

                {showVoice ? (
                  <VoiceRecorder conversationId={activeConvo.id} senderId={userId} onSent={() => setShowVoice(false)} onCancel={() => setShowVoice(false)} />
                ) : (
                  <>
                    <button className="attach-btn" onClick={() => setShowVoice(true)} title="Voice note"><IconMic size={19} /></button>
                    <textarea ref={textareaRef} value={inputText} onChange={handleTyping} onKeyDown={handleKeyDown} placeholder='Type a message… (try "hey curry ...")' rows={1} />
                    <button className="send-btn" onClick={handleSend} disabled={!inputText.trim() || curryChatBusy}>➤</button>
                  </>
                )}
              </div>
            </div>

            {showScheduler && (
              <ScheduleMessageModal conversationId={activeConvo.id} senderId={userId}
                onClose={(success) => { setShowScheduler(false); if (success) { alert('Message scheduled ✓'); setHasScheduled(true) } }} />
            )}
            {showScheduledList && (
              <ScheduledMessagesList conversationId={activeConvo.id} currentUserId={userId} onClose={() => setShowScheduledList(false)} />
            )}
            {showSearch && (
              <MessageSearch conversationId={activeConvo.id} currentUserId={userId} otherUserName={getConvoName(activeConvo)} onScrollTo={scrollToMessage} onClose={() => setShowSearch(false)} />
            )}
          </div>
        )
      )}
    </div>
  )
}
 
