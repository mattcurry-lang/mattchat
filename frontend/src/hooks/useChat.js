import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getMessages, sendMessage as sendMsg } from '../lib/supabase'
import { playSound } from '../lib/mattchatSounds'
import { subscribeToChannel, getChannel } from '../lib/realtimeManager'

// FIX: previously subscribed to messages via THREE independent channels
// across three hooks (useChat, useGlobalDelivery, useUnreadCounts).
// This one is scoped to a single open conversation — still its own
// channel (it needs low-latency typing broadcasts, which are inherently
// per-conversation), but now goes through the shared manager so a
// dropped connection resyncs (refetches messages) instead of silently
// going stale, and reconnects with backoff instead of relying on
// whatever supabase-js does by default.

export function useChat(conversationId, currentUserId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [typing, setTyping] = useState([])
  const [isEmailConvo, setIsEmailConvo] = useState(false)
  const typingRowActive = useRef(false) // whether we currently own a typing_status row for this convo

  const channelKey = conversationId ? `messages:${conversationId}` : null

  const loadMessages = useCallback(() => {
    if (!conversationId) return
    setLoading(true)
    getMessages(conversationId).then(data => {
      setMessages(data || [])
      setLoading(false)
    })
  }, [conversationId])

  useEffect(() => {
    if (!conversationId) return
    typingRowActive.current = false
    loadMessages()

    supabase
      .from('conversations')
      .select('email_sender')
      .eq('id', conversationId)
      .single()
      .then(({ data }) => setIsEmailConvo(!!data?.email_sender))
  }, [conversationId, loadMessages])

  useEffect(() => {
    if (!channelKey) return

    const unsubscribe = subscribeToChannel(
      channelKey,
      (channel, emit) => channel
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => emit('insert', payload))
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => emit('update', payload))
        .on('broadcast', { event: 'typing' }, ({ payload }) => emit('typing', payload)),
      {
        onEvent: async (type, payload) => {
          if (type === 'insert') {
            const { data: msgWithProfile } = await supabase
              .from('messages')
              .select('*, profiles!messages_sender_id_fkey(username, avatar_url)')
              .eq('id', payload.new.id)
              .single()
            if (!msgWithProfile) return

            if (msgWithProfile.sender_id !== currentUserId) playSound('pulse')

            setMessages(prev => {
              // If this is a message WE sent, it was already pushed onto
              // the list optimistically — swap the placeholder for the
              // real row instead of appending a second copy.
              if (msgWithProfile.sender_id === currentUserId) {
                const matchIdx = prev.findIndex(m => m._optimistic && m.content === msgWithProfile.content)
                if (matchIdx !== -1) {
                  const next = [...prev]
                  next[matchIdx] = msgWithProfile
                  return next
                }
              }
              if (prev.some(m => m.id === msgWithProfile.id)) return prev
              return [...prev, msgWithProfile]
            })
          } else if (type === 'update') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
          } else if (type === 'typing') {
            if (payload.user_id === currentUserId) return
            setTyping(prev => {
              if (payload.is_typing) return prev.includes(payload.user_id) ? prev : [...prev, payload.user_id]
              return prev.filter(id => id !== payload.user_id)
            })
          }
        },
        // Reconnected after a drop — refetch, since any INSERT/UPDATE
        // that happened during the gap never reached us.
        onResync: loadMessages,
      }
    )

    return () => {
      if (typingRowActive.current && currentUserId) {
        typingRowActive.current = false
        supabase.from('typing_status')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('user_id', currentUserId)
          .then(({ error }) => { if (error) console.error('[useChat] typing_status cleanup failed:', error) })
      }
      unsubscribe()
    }
  }, [channelKey, conversationId, currentUserId, loadMessages])

  const sendMessage = useCallback(async (content) => {
    if (!conversationId || !currentUserId || !content.trim()) return
    const trimmed = content.trim()
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const optimisticMsg = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: trimmed,
      message_type: 'text',
      created_at: new Date().toISOString(),
      profiles: null,
      _optimistic: true,
      _status: 'sending',
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      await sendMsg(conversationId, currentUserId, trimmed)
      if (isEmailConvo) {
        await supabase.functions.invoke('send-email', {
          body: { conversationId, senderId: currentUserId, content: trimmed },
        })
      }
    } catch (e) {
      console.error('sendMessage failed:', e)
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _status: 'failed' } : m))
    }
  }, [conversationId, currentUserId, isEmailConvo])

  const broadcastTyping = useCallback((isTyping) => {
    if (channelKey) {
      getChannel(channelKey)?.send({
        type: 'broadcast', event: 'typing',
        payload: { user_id: currentUserId, is_typing: isTyping },
      })
    }

    if (!conversationId || !currentUserId) return

    if (isTyping && !typingRowActive.current) {
      typingRowActive.current = true
      supabase.from('typing_status')
        .upsert({ conversation_id: conversationId, user_id: currentUserId, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.error('[useChat] typing_status upsert failed:', error) })
    } else if (!isTyping && typingRowActive.current) {
      typingRowActive.current = false
      supabase.from('typing_status')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId)
        .then(({ error }) => { if (error) console.error('[useChat] typing_status delete failed:', error) })
    }
  }, [currentUserId, conversationId, channelKey])

  return { messages, loading, typing, sendMessage, broadcastTyping }
}

// FIX: the conversations-list channel previously listened to ALL
// `conversations` UPDATEs and ALL `hidden_conversations` changes,
// unfiltered — every client reloaded its full list on every OTHER
// user's activity anywhere on the platform. Now filtered to this
// user's actual conversation ids (conversations table) and their own
// user_id (hidden_conversations table), and shares one channel per
// distinct id-set via the manager instead of recreating on every load.
export function useConversations(userId) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [convoIds, setConvoIds] = useState([])

  const load = useCallback(async () => {
    if (!userId) return

    const { data: memberRows } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userId)

    const conversationIds = memberRows?.map(r => r.conversation_id) || []
    if (conversationIds.length === 0) {
      setConversations([])
      setConvoIds([])
      setLoading(false)
      return
    }

    const { data: hiddenRows } = await supabase
      .from('hidden_conversations')
      .select('conversation_id')
      .eq('user_id', userId)

    const hiddenIds = new Set((hiddenRows || []).map(r => r.conversation_id))
    const visibleIds = conversationIds.filter(id => !hiddenIds.has(id))
    setConvoIds(conversationIds) // keep listening on the full membership set, not just visible ones

    if (visibleIds.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('conversations')
      .select(`
        id, updated_at, last_message, is_group, name, email_sender,
        conversation_members(
          user_id,
          profiles(id, username, email, avatar_url)
        )
      `)
      .in('id', visibleIds)
      .order('updated_at', { ascending: false })

    setConversations(data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const idsKey = convoIds.slice().sort().join(',')

  useEffect(() => {
    if (!userId || !convoIds.length) return

    const unsubConvos = subscribeToChannel(
      `conversations:${userId}:${idsKey}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'conversations',
        filter: `id=in.(${convoIds.join(',')})`,
      }, (payload) => emit('update', payload)),
      { onEvent: load, onResync: load }
    )

    const unsubHidden = subscribeToChannel(
      `hidden_conversations:${userId}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'hidden_conversations',
        filter: `user_id=eq.${userId}`,
      }, (payload) => emit('change', payload)),
      { onEvent: load, onResync: load }
    )

    return () => { unsubConvos(); unsubHidden() }
  }, [userId, idsKey, convoIds, load])

  return { conversations, loading, reload: load }
}
