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
import OutgoingCallScreen from '../components/OutgoingCallScreen'
import TwoFactorModal from '../components/TwoFactorModal'
import EmojiPicker from '../components/EmojiPicker'
import { useRingtone } from '../hooks/useRingtone'
import { useMessageStatus } from '../hooks/useMessageStatus'
import { useUnreadCounts } from '../hooks/useUnreadCounts'
import { useGlobalDelivery } from '../hooks/useGlobalDelivery'
import BottomNav from '../components/BottomNav'
import { IconPhone, IconVideo, IconSparkle, IconMoreVertical, IconSmile, IconMic, IconPlus, IconStatus } from '../components/Icons'
import { ReactableMessage } from '../components/MessageReactions'
import { useStatuses } from '../hooks/useStatuses'
import StatusRing from '../components/StatusRing'
import AddStatusModal from '../components/AddStatusModal'
import StatusViewer from '../components/StatusViewer'
import CallsList from '../components/CallsList'
import { useCallHistory } from '../hooks/useCallHistory'
import NewCallModal from '../components/NewCallModal'
import AICommandBar from '../components/AICommandBar'
import FloatingCurryOrb from '../components/FloatingCurryOrb'
import MessageActionsMenu, { useMessageLongPress } from '../components/MessageActionsMenu'
import PromotedDailyBrief from '../components/PromotedDailyBrief'
import SmartCollections, { useConvoTags, filterByCollection } from '../components/SmartCollections'
import SmartReplyPreview, { useSmartReplyCache } from '../components/SmartReplyPreview'
import RelationshipInsights from '../components/RelationshipInsights'
import TodaysTimeline from '../components/TodaysTimeline'
import { useTheme } from '../hooks/useTheme'
import {deleteMessageForEveryone, deleteMessageForMe, getHiddenMessageIds, sendReplyMessage, canDeleteForEveryone,
} from '../lib/supabase'
import ForwardModal from '../components/ForwardModal'
import SpotifyMiniPlayer from '../components/SpotifyMiniPlayer'
import PersonalAnalytics from '../components/PersonalAnalytics'
import ProfileSetupModal from '../components/ProfileSetupModal'
import connectPinterest t from '../lib/supabase'
// Matches "hey curry", "hey curry,", "hey curry:" at the start of a
// message (case-insensitive) — this is what routes a message to the
// in-chat Curry instead of delivering it to the other person.
const CURRY_TRIGGER = /^hey\s+curry[,:]?\s*/i
const CATCH_UP_THRESHOLD = 8       // unread messages before offering a summary
const AUTO_CONTEXT_GAP_DAYS = 2    // quiet period before showing "last spoke" context

// Turns a raw message content string into a short, human-friendly
// preview for the chat list — so encoded/tagged formats (sticker:,
// gif:, status_reply:, call logs) never leak their raw syntax into
// the sidebar the way status_reply's URL-encoded caption was.
function getMessagePreview(content) {
  if (!content) return 'No messages yet'
  if (content.startsWith('sticker:')) {
    const emoji = content.replace('sticker:', '').split(':')[0] || '😊'
    return `${emoji} Sticker`
  }
  if (content.startsWith('gif:')) return '🎬 GIF'
  if (content.startsWith('call_log:') || content.startsWith('missed_call:')) return '📞 Call'
  return content
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
// Reply-to-status bubble — a small "📸 Replied to a status" tag above
// the actual reply text, same visual language as a WhatsApp/Instagram
// status-reply quote, but simple: just a tag + the caption snippet,
// not a full media thumbnail.
function StatusReplyBubble({ content, isMe }) {
  const withoutPrefix = content.replace('status_reply:', '')
  const [encodedCaption, ...rest] = withoutPrefix.split('::')
  const replyText = rest.join('::')
  const caption = decodeURIComponent(encodedCaption || '')

  return (
    <div className={`msg-bubble status-reply-bubble ${isMe ? 'mine' : ''}`}>
      <div className="status-reply-tag">
        <IconStatus size={12} /> <span>{caption ? `Status: "${caption}"` : 'Replied to a status'}</span>
      </div>
      <div className="status-reply-text">{replyText}</div>
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
  if (msg.deleted_for_everyone) {
    return (
      <div className={`msg-row ${isMe ? 'mine' : ''}`}>
        {!isMe && <Avatar name={msg.profiles?.username} size={28} />}
        <div>
          {!isMe && <div className="msg-sender">{msg.profiles?.username}</div>}
          <div className="msg-bubble deleted-msg">🚫 This message was deleted</div>
          <div className="msg-time">{formatMsgTime(msg.created_at)}</div>
        </div>
      </div>
    )
  }
if (msg.content?.startsWith('call_log:') || msg.content?.startsWith('missed_call:')) {
  let callType, status, duration = 0
  if (msg.content.startsWith('call_log:')) {
    [, callType, status, duration] = msg.content.split(':')
    duration = parseInt(duration, 10) || 0
  } else {
    const [, ct, reason] = msg.content.split(':')
    callType = ct
    status = reason === 'declined' ? 'declined' : 'missed'
  }

  const isMe = msg.sender_id === msg._currentUserId
  const icon = callType === 'video' ? '📹' : '📞'
  const label =
    status === 'completed' ? (isMe ? 'Outgoing call' : 'Incoming call') :
    status === 'declined'  ? 'Declined' : 'Missed'
  const durLabel = status === 'completed' && duration > 0
    ? ` · ${Math.floor(duration / 60)}m ${duration % 60}s`
    : ''
  const isBad = status !== 'completed'

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <div style={{
        fontSize: 12,
        color: isBad ? '#f87171' : 'var(--text-muted)',
        background: isBad ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
        border: `1px solid ${isBad ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
        borderRadius: 20, padding: '6px 14px',
        display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600,
      }}>
        {icon} {label}{durLabel}
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
if (msg.content?.startsWith('status_reply:')) {
  return (
    <div className={`msg-row ${isMe ? 'mine' : ''}`}>
      {!isMe && <Avatar name={msg.profiles?.username} size={28} />}
      <div>
        {!isMe && <div className="msg-sender">{msg.profiles?.username}</div>}
        <StatusReplyBubble content={msg.content} isMe={isMe} />
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
          {msg.forwarded && <div className="forwarded-tag">➡️ Forwarded</div>}
          {msg.reply_to_message_id && msg._quotedMessage && (
            <div className="reply-quote">
              <div className="reply-quote-name">{msg._quotedMessage.profiles?.username || 'You'}</div>
              <div className="reply-quote-text">{msg._quotedMessage.content?.slice(0, 80)}</div>
            </div>
          )}
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
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const [show2FA, setShow2FA] = useState(false)
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
  const [showNewCall, setShowNewCall] = useState(false)
  const [messageMenu, setMessageMenu] = useState(null) // { message, x, y } | null
  const [collection, setCollection] = useState('all')
  const [showInsights, setShowInsights] = useState(false)
  const [showPersonalAnalytics, setShowPersonalAnalytics] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [forwardingMessage, setForwardingMessage] = useState(null)
  const [hiddenMsgIds, setHiddenMsgIds] = useState(new Set())
 
  // that appears AFTER a plain message has already been sent, if
  // Curry thinks it might land colder than intended. Never blocks or
  // delays sending; see runCoachCheck below.
   const [autoContext, setAutoContext] = useState(null) // {conversationId, daysSince, lastTopic, openPromise} | null
  const [autoContextLoading, setAutoContextLoading] = useState(false)
  const [catchUpPending, setCatchUpPending] = useState(null) // {convoId, unreadCount} | null
  const [catchUpResult, setCatchUpResult] = useState(null)   // {conversationId, bullets, readingTimeSavedMin} | null
  const [catchUpLoading, setCatchUpLoading] = useState(false)
  const [coachSuggestion, setCoachSuggestion] = useState(null)
  const { tags, setTag } = useConvoTags()
  const { cache: smartReplyCache, fetchSuggestion, clear: clearSmartReply } = useSmartReplyCache()
  const { theme, toggleTheme } = useTheme()
 
 
  

  const msgRefs        = useRef({})
  const messagesEndRef = useRef(null)
  const typingTimer    = useRef(null)
  const textareaRef    = useRef(null)

  const userId = session.user.id
  const isOnline = usePresence(userId)

  const { callStatus, activeCall, callToken, callError, startCall, answerCall, declineCall, endCall } =
    useCall(userId, activeConvo?.id && !activeConvo.isCurryAI ? activeConvo.id : null)

  useRingtone(['calling', 'ringing'].includes(callStatus), 'ringback')
  useRingtone(callStatus === 'incoming', 'ringtone')
  const { conversations, loading: convLoading, reload } = useConversations(userId)
  const { calls: callHistory, loading: callHistoryLoading } = useCallHistory(userId, conversations)
  const [startMuted, setStartMuted] = useState(false)
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

  // Sends a smart-reply suggestion straight to a conversation from the
  // list, without opening the chat. Clears that row's cached suggestion
  // and unread badge afterward, same as replying normally would.
  const quickSendReply = async (convo, text) => {
    const convoId = convo.id
    await supabase.from('messages').insert({ conversation_id: convoId, sender_id: userId, content: text, message_type: 'text' })
    await supabase.from('conversations').update({ updated_at: new Date().toISOString(), last_message: text }).eq('id', convoId)
    clearSmartReply(convoId)
    clearUnread(convoId)
    reload()
  }

  const [showAddStatus, setShowAddStatus] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(null)

  const { statusGroups, myStatuses, markViewed, reload: reloadStatuses } = useStatuses(userId)

  const viewableGroups = [
    ...(myStatuses.length > 0
      ? [{ userId: 'mine', isMine: true, profile: { username: profile?.username || 'You' }, statuses: myStatuses }]
      : []),
    ...statusGroups.map(g => ({ ...g, isMine: false })),
  ]

  const openViewer = (uid) => {
    if (uid === 'mine' && myStatuses.length === 0) { setShowAddStatus(true); return }
    const idx = viewableGroups.findIndex(g => g.userId === uid)
    if (idx !== -1) setViewerIndex(idx)
  }

  const otherUserId = activeConvo && !activeConvo.isCurryAI ? getOtherUserId(activeConvo, userId) : null

  // Looks up a conversation by id from the full list — used for call UI
  // (caller name, avatar) so it works whether or not that conversation
  // happens to be the one currently open in the chat view. Relying on
  // activeConvo for this was why incoming/outgoing calls showed
  // "Unknown" whenever the call started while the user was on a
  // different tab (e.g. the Calls tab).
  const getConvoById = useCallback(
    (id) => conversations.find(c => c.id === id) || null,
    [conversations]
  )
  const callConvo = activeCall ? getConvoById(activeCall.conversationId) : null

  const onHeyCurryActivated = useCallback(() => setActiveConvo(CURRY_AI_CONTACT), [])
  // autoStart: false — "hey curry" listening is now an explicit
  // opt-in (see the mic toggle button in the header) instead of
  // running in the background from the moment the app loads, which
  // is what was causing the mic indicator to flicker on/off.
  const { listening: heyCurryListening, startListening: startHeyCurry, stopListening: stopHeyCurry } =
    useHeyCurry(onHeyCurryActivated, { autoStart: false })
  const bindLongPress = useMessageLongPress((message, x, y) => setMessageMenu({ message, x, y }))

  
useEffect(() => {
  supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => {
    setProfile(data)
    if (data && !data.profile_setup_completed) setShowProfileSetup(true)
  })
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
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const status = params.get('pinterest_connect')
  if (!status) return

  if (status === 'success') {
    // No alert here — the picker modal (if open) will detect the
    // connection itself and move to the board-picker step.
    window.dispatchEvent(new CustomEvent('pinterest-connected'))
  } else if (status === 'denied') {
    alert('Pinterest connection was cancelled.')
  } else {
    alert('Could not connect Pinterest. Please try again.')
  }

  params.delete('pinterest_connect')
  const cleanUrl = window.location.pathname + (params.toString() ? `?${params}` : '')
  window.history.replaceState({}, '', cleanUrl)
}, [])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('spotify_connect')
    if (!status) return
 
    if (status === 'success') {
      const product = params.get('product')
      alert(`Spotify connected ✓${product === 'free' ? '\n\nFree accounts get 30-second previews — full playback needs Spotify Premium.' : ''}`)
    } else if (status === 'denied') {
      alert('Spotify connection was cancelled.')
    } else if (status === 'expired') {
      alert('That connection attempt expired — please try "Connect Spotify" again.')
    } else {
      alert('Could not connect Spotify. Please try again.')
    }
 
    params.delete('spotify_connect')
    params.delete('product')
    const cleanUrl = window.location.pathname + (params.toString() ? `?${params}` : '')
    window.history.replaceState({}, '', cleanUrl)
  }, [])
// Only auto-scroll when the message COUNT actually grows (a genuine
// new message arrived), not on every re-render of the messages array
// — some realtime updates (typing pings, status changes, re-renders
// from other hooks) were replacing the array reference without
// adding anything, which was yanking the view back to the bottom
// every time, even mid-scroll.
const prevMsgCountRef = useRef(0)
useEffect(() => {
  if (messages.length > prevMsgCountRef.current) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  prevMsgCountRef.current = messages.length
}, [messages])
useEffect(() => {
  if (!messages.length) { setHiddenMsgIds(new Set()); return }
  getHiddenMessageIds(userId, messages.map(m => m.id)).then(setHiddenMsgIds)
}, [messages, userId])
  
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
    setHasScheduled(false); setShowEmojiPicker(false); setShowInsights(false)
    setCoachSuggestion(null)
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
    const unread = unreadCounts[c.id] || 0
    setActiveConvo(c)
    clearUnread(c.id)

    setCatchUpPending(unread >= CATCH_UP_THRESHOLD ? { convoId: c.id, unreadCount: unread } : null)
    setCatchUpResult(null)
    setAutoContext(null)

    const gapMs = c.updated_at ? Date.now() - new Date(c.updated_at).getTime() : 0
    if (gapMs > AUTO_CONTEXT_GAP_DAYS * 24 * 60 * 60 * 1000) {
      runAutoContext(c.id)
    }
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

  // Conversation Coach (Phase 3) — fires AFTER a plain message has
  // already been sent, purely advisory, never blocking. Skips very
  // short/trivial messages so a Gemini call doesn't fire for every
  // "ok" or "lol". Only checks Curry when there's genuine conversation
  // context to review it against.
  const runAutoContext = useCallback(async (convoId) => {
    setAutoContextLoading(true)
    try {
      const data = await callCurryAI('auto_context', { conversationId: convoId }, session)
      if (data.ok && data.context && (data.context.lastTopic || data.context.openPromise)) {
        setAutoContext({ conversationId: convoId, ...data.context })
      }
    } catch (e) {
      console.error('auto_context failed:', e)
    }
    setAutoContextLoading(false)
  }, [session])

  const runCatchMeUp = async () => {
    if (!catchUpPending || catchUpPending.convoId !== activeConvo?.id) return
    setCatchUpLoading(true)
    const missed = messages.slice(-catchUpPending.unreadCount)
      .filter(m => m.message_type !== 'curry' && m.content
        && !m.content.startsWith('call_log:') && !m.content.startsWith('missed_call:')
        && !m.content.startsWith('sticker:') && !m.content.startsWith('gif:'))
      .map(m => ({ sender: m.sender_id === userId ? 'You' : (m.profiles?.username || 'Them'), content: m.content }))
    try {
      const data = await callCurryAI('catch_me_up', { conversationId: activeConvo.id, messages: missed }, session)
      if (data.ok) setCatchUpResult({ ...data, conversationId: activeConvo.id })
    } catch (e) {
      console.error('catch_me_up failed:', e)
    }
    setCatchUpPending(null)
    setCatchUpLoading(false)
  }
const runCoachCheck = useCallback(async (text) => {
    if (!activeConvo?.id || activeConvo.isCurryAI) return
    if (!text || text.trim().length < 8) return
    try {
      const recentMessages = messages.slice(-6)
        .filter(m => m.message_type !== 'curry' && m.content)
        .map(m => ({ isMe: m.sender_id === userId, sender: m.profiles?.username || 'Them', content: m.content }))
      const data = await callCurryAI('coach_check', { conversationId: activeConvo.id, text, recentMessages }, session)
      if (data.ok && data.needsRephrase && data.suggestion) {
        setCoachSuggestion({ suggestion: data.suggestion, reason: data.reason })
      }
    } catch (e) {
      console.error('coach_check failed:', e)
    }
  }, [activeConvo, messages, userId, session])
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
    setCoachSuggestion(null)
    const text = inputText.trim()
    setInputText('') // clear immediately — don't wait on the network round trip

    if (!activeConvo.isCurryAI) {
      const match = text.match(CURRY_TRIGGER)
      if (match) {
        setCurryChatBusy(true)
        const question = text.slice(match[0].length).trim() || text
        try {
          const data = await callCurryAI('chat_ask', { conversationId: activeConvo.id, question }, session)
          if (!data.ok && data.reason === 'no_consent') {
            alert("Curry isn't turned on for this chat yet — both people need to enable it first (✨ icon → Invite Curry into this chat).")
            await sendMessage(text)
            bumpConversationActivity(text)
          }
        } catch (err) {
          alert('Curry could not respond right now. Please try again.')
        }
        setCurryChatBusy(false)
        return
      }
    }

    if (replyingTo) {
      const replyTarget = replyingTo
      setReplyingTo(null)
      await sendReplyMessage(activeConvo.id, userId, text, replyTarget.id)
      reload()
    } else {
      sendMessage(text)              // fire-and-forget — no await
      bumpConversationActivity(text) // fire-and-forget too
      runCoachCheck(text)
    }
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
 const findMessageById = (id) => messages.find(m => m.id === id)
  const getConvoName = (c) => {
    if (c.isCurryAI) return 'Curry AI'
    if (c.is_group) return c.name
    const other = c.conversation_members?.find(m => m.user_id !== userId)
    return other?.profiles?.username || other?.profiles?.email || 'Unknown'
  }

  const searchFiltered = conversations.filter(c => getConvoName(c).toLowerCase().includes(search.toLowerCase()))
  const filtered = filterByCollection(searchFiltered, collection, { unreadCounts, sharedConvoIds, tags })

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

  // Curry AI page nudge → opening a suggested conversation from the
  // Daily Brief's reconnect nudges (Phase 3). Just reuses openConvo so
  // unread badges clear the same way as clicking it from the list.
  const openConversationById = useCallback((convoId) => {
    const found = conversations.find(c => c.id === convoId)
    if (found) openConvo(found)
  }, [conversations])
 return (
    <div className={`app ${activeConvo ? 'chat-open' : ''}`}>

      {/* ── INCOMING CALL ── */}
      {callStatus === 'incoming' && activeCall && (
        <IncomingCallModal
          callerName={callConvo ? getConvoName(callConvo) : 'Unknown'}
          callType={activeCall.callType}
          onAnswer={(muted) => { setStartMuted(muted); answerCall() }}
          onDecline={declineCall}
        />
      )}

      {/* ── OUTGOING CALL (caller's own full-screen "Calling…" view) ── */}
      {(callStatus === 'calling' || callStatus === 'ringing') && activeCall && (
        <OutgoingCallScreen
          callerName={callConvo ? getConvoName(callConvo) : ''}
          callType={activeCall.callType}
          status={callStatus}
          onCancel={endCall}
        />
      )}

      {/* ── IN-CALL OVERLAY ── */}
      {(callStatus === 'connecting' || callStatus === 'in-call') && activeCall && (
        <CallOverlay
          roomUrl={activeCall.roomUrl}
          token={callToken}
          callType={activeCall.callType}
          startMuted={startMuted}
          callerName={callConvo ? getConvoName(callConvo) : ''}
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
    className="theme-toggle-btn"
    onClick={toggleTheme}
    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
  >
    {theme === 'dark' ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    )}
  </button>

  <button
    className="top-header-search-btn"
    onClick={() => (heyCurryListening ? stopHeyCurry() : startHeyCurry())}
    title={heyCurryListening ? '"Hey Curry" listening is on — tap to turn off' : 'Turn on "Hey Curry" listening'}
    style={{ color: heyCurryListening ? '#a78bfa' : undefined, background: heyCurryListening ? 'rgba(167,139,250,0.15)' : undefined }}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
    </svg>
  </button>
</div>

          {/* FIX (bug #2): this AICommandBar + SpotifyMiniPlayer block used to
              be duplicated verbatim right after this comment (two identical
              AICommandBars sandwiching one SpotifyMiniPlayer), which rendered
              two stacked search bars any time activeTab === 'chats'. Now
              there is exactly one of each. */}
          {activeTab === 'chats' && (
            <div style={{ padding: '8px 16px 0' }}>
              <AICommandBar
                session={session}
                value={search}
                onSearchChange={setSearch}
                onOpenCurry={() => setActiveConvo(CURRY_AI_CONTACT)}
                hasLocalMatches={filtered.length > 0}
              />
            </div>
          )}

          <SpotifyMiniPlayer session={session} />

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

        {activeTab === 'chats' && (
          <div style={{ position: 'relative' }}>
            <PromotedDailyBrief
              session={session}
              onAskQuestion={() => {}}
              onOpenCurry={() => setActiveConvo(CURRY_AI_CONTACT)}
            />
            <TodaysTimeline
              userId={userId}
              totalUnread={totalUnread}
              conversations={conversations}
              sharedConvoIds={sharedConvoIds}
            />
          </div>
        )}

        {/* ── LIST CARD ── */}
        <div className="list-card">
          {activeTab === 'chats' && (
            <>
              <SmartCollections
                active={collection}
                onChange={setCollection}
                conversations={searchFiltered}
                unreadCounts={unreadCounts}
                sharedConvoIds={sharedConvoIds}
                tags={tags}
              />

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
                        {unread > 0 ? (
                          <SmartReplyPreview
                            session={session}
                            convo={c}
                            entry={smartReplyCache[c.id]}
                            onFetch={fetchSuggestion}
                            onSend={(text) => quickSendReply(c, text)}
                            fallbackText={c.last_message}
                          />
                        ) : (
                         <div className="contact-preview">
  {c.last_message?.startsWith('status_reply:') ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <IconStatus size={11} /> Replied to a status
    </span>
  ) : getMessagePreview(c.last_message)}
</div>
                        )}
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
                    <p>No conversations yet.</p>
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
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
              {/* flex:1 + minHeight:0 is what makes this scroll — without
                  minHeight:0 a flex child won't shrink below its content
                  size, so overflow never actually kicks in. */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <CallsList
                  calls={callHistory}
                  loading={callHistoryLoading}
                  onOpenConversation={(convoId) => {
                    const found = conversations.find(c => c.id === convoId)
                    if (found) { openConvo(found); setActiveTab('chats') }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {showProfileMenu && (
          <div className="profile-menu-overlay" onClick={() => setShowProfileMenu(false)}>
            <div className="profile-menu" onClick={e => e.stopPropagation()}>
              <div className="profile-menu-header">
                <Avatar name={profile?.username || session.user.email} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile?.username || 'You'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {session.user.email}
                  </div>
                </div>
              </div>

              <div className="profile-menu-actions">
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
                  <button
                  onClick={() => { setShowPersonalAnalytics(true); setShowProfileMenu(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(167,139,250,0.12)',
                    border: '1px solid rgba(167,139,250,0.3)', borderRadius: 10, color: '#c4b5fd',
                    fontSize: 12.5, fontWeight: 700, padding: '8px 12px', cursor: 'pointer',
                    fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >
                  📊 Your Communication Analytics
                </button>
                <button
                  onClick={() => { setShow2FA(true); setShowProfileMenu(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(108,99,255,0.12)',
                    border: '1px solid rgba(108,99,255,0.3)', borderRadius: 10, color: '#c4b8ff',
                    fontSize: 12.5, fontWeight: 700, padding: '8px 12px', cursor: 'pointer',
                    fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >
                  🔐 Two-factor authentication
                </button>
                <button className="profile-menu-signout" onClick={signOut}>⏏ Sign out</button>
              </div>
            </div>
          </div>
        )}

        {show2FA && <TwoFactorModal onClose={() => setShow2FA(false)} />}
{showProfileSetup && (
  <ProfileSetupModal
    userId={userId}
    username={profile?.username}
    onComplete={(patch) => { setProfile(p => ({ ...p, ...patch })); setShowProfileSetup(false) }}
    onClose={() => setShowProfileSetup(false)}
  />
)}
       
{showPersonalAnalytics && (
          <PersonalAnalytics userId={userId} conversations={conversations} onClose={() => setShowPersonalAnalytics(false)} />
        )}
        {showAddStatus && (
          <AddStatusModal userId={userId} onClose={() => setShowAddStatus(false)} onPosted={reloadStatuses} />
        )}
        {showNewCall && (
          <NewCallModal
            conversations={conversations}
            userId={userId}
            onClose={() => setShowNewCall(false)}
            onCall={(convo, type) => {
              setShowNewCall(false)
              // Calls directly, passing the target conversation id straight
              // to startCall — no need to open the chat or switch tabs
              // first. The incoming/in-call overlays render globally, so
              // the call UI shows up right over the Calls tab.
              startCall(type, convo.id)
            }}
          />
        )}

       {viewerIndex !== null && viewableGroups[viewerIndex] && (
  <StatusViewer
    group={viewableGroups[viewerIndex]}
    isMine={viewableGroups[viewerIndex].isMine}
    currentUserId={userId}
    onClose={() => setViewerIndex(null)}
    onViewed={markViewed}
    onDeleted={reloadStatuses}
    onNextGroup={viewerIndex < viewableGroups.length - 1 ? () => setViewerIndex(i => i + 1) : undefined}
    onPrevGroup={viewerIndex > 0 ? () => setViewerIndex(i => i - 1) : undefined}
  />
)}

        {/* Always rendered — on mobile/tablet this is hidden automatically
            because the whole .sidebar hides when a chat is open; on desktop
            the sidebar (and this) stays visible the whole time.
            The central "+" button is context-aware, just like WhatsApp:
            on the Calls tab it opens the new-call picker, everywhere else
            it opens the new-chat form. */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onNewChat={() => (activeTab === 'calls' ? setShowNewCall(true) : setShowNewChat(true))}
          onProfileClick={() => setShowProfileMenu(v => !v)}
        />
      </div>

      <FloatingCurryOrb
        hidden={!!activeConvo}
        onActivate={() => setActiveConvo(CURRY_AI_CONTACT)}
      />

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
            <CurryAIChat session={session} onOpenConversation={openConversationById} />
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
                <button className="icon-btn dark" onClick={() => setShowInsights(v => !v)} title="Relationship insights"
                  style={{ color: showInsights ? '#a78bfa' : undefined, background: showInsights ? 'rgba(167,139,250,0.15)' : undefined }}>
                  📊
                </button>
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
      

            {autoContext && autoContext.conversationId === activeConvo?.id && (
              <div style={{ margin: '10px 16px 0', background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ color: '#a5b4fc', fontWeight: 700 }}>
                    🕰️ Last spoke {autoContext.daysSince === 0 ? 'today' : autoContext.daysSince === 1 ? 'yesterday' : `${autoContext.daysSince} days ago`}
                  </span>
                  <button onClick={() => setAutoContext(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
                {autoContext.lastTopic && <div style={{ color: '#d1d5db' }}>Last about: {autoContext.lastTopic}</div>}
                {autoContext.openPromise && <div style={{ color: '#fbbf24' }}>📌 {autoContext.openPromise}</div>}
              </div>
            )}

            {catchUpPending && catchUpPending.convoId === activeConvo?.id && (
              <div style={{ margin: '10px 16px 0', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                <span style={{ flex: 1, color: '#e5e7eb' }}>📬 You missed {catchUpPending.unreadCount} messages</span>
                <button onClick={runCatchMeUp} disabled={catchUpLoading} style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 20, color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '6px 12px', cursor: catchUpLoading ? 'default' : 'pointer', fontFamily: 'inherit', opacity: catchUpLoading ? 0.6 : 1 }}>
                  {catchUpLoading ? 'Summarizing…' : 'Catch me up'}
                </button>
                <button onClick={() => setCatchUpPending(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
            )}

            {catchUpResult && catchUpResult.conversationId === activeConvo?.id && (
              <div style={{ margin: '10px 16px 0', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#c4b5fd', fontWeight: 700 }}>✨ While you were away</span>
                  <button onClick={() => setCatchUpResult(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
                {catchUpResult.bullets && catchUpResult.bullets.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 18, color: '#e5e7eb', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {catchUpResult.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                ) : (
                  <div style={{ color: '#9ca3af' }}>Nothing especially notable — just regular chat.</div>
                )}
                {catchUpResult.readingTimeSavedMin > 0 && (
                  <div style={{ color: '#a5b4fc', fontSize: 11 }}>⏱ ~{catchUpResult.readingTimeSavedMin} min of reading saved</div>
                )}
              </div>
            )}

         
            {/* Messages */}
           <div className="messages">
              {msgLoading && <div className="loading-state">Loading messages…</div>}
              {(() => { const visibleMessages = messages.filter(m => !hiddenMsgIds.has(m.id)); return visibleMessages.map((msg, i) => {
                const prev = visibleMessages[i - 1]
                const showDate = !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString()
                const isMissedCall = msg.content?.startsWith('missed_call:') || msg.content?.startsWith('call_log:')
                const isCurryMsg = msg.message_type === 'curry'
                const isMine = msg.sender_id === userId
                const wrapClass = (isMissedCall || isCurryMsg) ? 'system' : (isMine ? 'mine' : 'theirs')
                return (
                  <React.Fragment key={msg.id}>
                    {showDate && <DateDivider date={msg.created_at} />}
                    <div
                      ref={el => (msgRefs.current[msg.id] = el)}
                      className={`msg-wrap ${wrapClass}`}
                      onContextMenu={e => {
                        if (!isCurryMsg) {
                          e.preventDefault()
                          pinMessage(msg.id)
                        }
                      }}
                      title={isCurryMsg ? undefined : 'Right-click to pin'}
                      {...(!isCurryMsg ? bindLongPress(msg) : {})}
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
                            msg={{ ...msg, _currentUserId: userId, _quotedMessage: msg.reply_to_message_id ? findMessageById(msg.reply_to_message_id) : null }}
                            isMe={isMine}
                            isRead={!!readMap[msg.id]}
                            isDelivered={!!deliveredMap[msg.id]}
                          />
                        </ReactableMessage>
                      )}
                    </div>
               </React.Fragment>
                )
              }) })()}
              {typing.length > 0 && <div className="typing-indicator"><span /><span /><span /></div>}
              {curryChatBusy && (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <div style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 600, padding: '6px 12px' }}>✨ Curry is thinking…</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

          {messageMenu && (
              <MessageActionsMenu
                session={session}
                message={messageMenu.message}
                currentUserId={userId}
                position={{
                  x: messageMenu.x,
                  y: messageMenu.y,
                }}
                onClose={() => setMessageMenu(null)}
                onPin={() => pinMessage(messageMenu.message.id)}
                onCopy={() => {}}
                onInsertReply={(text) => setInputText(text)}
                onReply={() => setReplyingTo(messageMenu.message)}
                onForward={() => setForwardingMessage(messageMenu.message.content)}
                onDeleteForMe={async () => {
                  await deleteMessageForMe(messageMenu.message.id, userId)
                  setHiddenMsgIds(prev => new Set(prev).add(messageMenu.message.id))
                }}
                onDeleteForEveryone={async () => {
                  try { await deleteMessageForEveryone(messageMenu.message.id, userId) }
                  catch (e) { alert(e.message) }
                }}
              />
            )}
            {showInsights && (
              <RelationshipInsights
                messages={messages}
                currentUserId={userId}
                contactName={getConvoName(activeConvo)}
                conversationId={activeConvo?.id}
                session={session}
                onClose={() => setShowInsights(false)}
              />
            )}

            {/* Input area */}
{forwardingMessage && (
              <ForwardModal
                session={session}
                content={forwardingMessage}
                conversations={conversations}
                getConvoName={getConvoName}
                currentUserId={userId}
                emailAccounts={emailAccounts}
                onClose={() => setForwardingMessage(null)}
                onForwarded={() => reload()}
              />
            )}

            {/* Input area */}
            <div className="input-area" style={{ flexDirection: 'column', alignItems: 'stretch', padding: 0 }}>
              {replyingTo && (
                <div className="reply-preview-bar">
                  <div className="reply-preview-content">
                    <div className="reply-preview-name">{replyingTo.sender_id === userId ? 'You' : getConvoName(activeConvo)}</div>
                    <div className="reply-preview-text">{replyingTo.content?.slice(0, 100)}</div>
                  </div>
                  <button className="reply-preview-close" onClick={() => setReplyingTo(null)}>✕</button>
                </div>
              )}
              {coachSuggestion && (
                <div style={{ margin: '0 16px 8px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd' }}>
                    💬 Curry noticed {coachSuggestion.reason ? `this might read as ${coachSuggestion.reason}` : 'this might land a little differently than you meant'}
                  </div>
                  <div style={{ fontSize: 13, color: '#e5e7eb', lineHeight: 1.5 }}>{coachSuggestion.suggestion}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { setInputText(coachSuggestion.suggestion); setCoachSuggestion(null); textareaRef.current?.focus() }}
                      style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 20, color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Send this instead
                    </button>
                    <button
                      onClick={() => setCoachSuggestion(null)}
                      style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, color: '#9ca3af', fontSize: 11.5, fontWeight: 700, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
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
