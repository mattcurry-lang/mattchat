import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useChat, useConversations } from '../hooks/useChat'
import { getOrCreateConversation, hideConversationForUser, signOut, supabase } from '../lib/supabase'
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
import { IconSearch, IconPhone, IconVideo, IconSparkle, IconMoreVertical, IconSmile, IconMic } from '../components/Icons'
import { ReactableMessage } from '../components/MessageReactions'

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

  // Story rail — your real contacts, since there's no stories/status
  // backend yet. Explicitly sorted by most recent activity (not just
  // trusting whatever order `conversations` came back in) so whoever
  // messaged most recently always shows first, regardless of what
  // the backend does or doesn't do with updated_at on its own.
  const storyContacts = conversations
    .filter(c => !c.is_group)
    .slice()
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    .slice(0, 12)


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
              <button className="story-item story-add" onClick={() => setShowNewChat(true)} title="New chat">
                <div className="story-add-circle">＋</div>
                <span className="story-label">New</span>
              </button>
              {storyContacts.map(c => {
                const otherId = getOtherUserId(c, userId)
                const online = otherId ? isOnline(otherId) : false
                const unread = unreadCounts[c.id] || 0
                return (
                  <button
                    key={c.id}
                    className="story-item"
                    onClick={() => openConvo(c)}
                    title={getConvoName(c)}
                  >
                    <div className="story-avatar-wrap">
                      <div className={`story-ring ${online ? 'online' : ''}`}>
                       <Avatar name={getConvoName(c)} size={52} online={online} />
                      </div>
                      {unread > 0 && <span className="unread-badge">{unread > 9 ? '9+' : unread}</span>}
                      {sharedConvoIds.has(c.id) && (
                        <span className="shared-badge" title="Shared with Curry">
                          <IconSparkle size={9} />
                        </span>
                      )}
                    </div>
                    <span className="story-label">{getConvoName(c).split(' ')[0]}</span>
                  </button>
                )
              })}
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
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>📷</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: '#fff' }}>Status coming soon</div>
              <div style={{ fontSize: 13 }}>Share updates with your contacts</div>
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
              <button className="profile-menu-signout" onClick={signOut}>⏏ Sign out</button>
            </div>
          </div>
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
