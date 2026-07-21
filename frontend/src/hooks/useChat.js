import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getMessages, sendMessage as sendMsg } from '../lib/supabase'
import { playSound } from '../lib/mattchatSounds'

export function useChat(conversationId, currentUserId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [typing, setTyping] = useState([])
  const [isEmailConvo, setIsEmailConvo] = useState(false)
  const channelRef = useRef(null)
  const typingRowActive = useRef(false) // whether we currently own a typing_status row for this convo

  useEffect(() => {
    if (!conversationId) return
    typingRowActive.current = false

    setLoading(true)
    getMessages(conversationId).then(data => {
      setMessages(data || [])
      setLoading(false)
    })

    // Check if this is an email conversation
    supabase
      .from('conversations')
      .select('email_sender')
      .eq('id', conversationId)
      .single()
      .then(({ data }) => setIsEmailConvo(!!data?.email_sender))

    // Real-time subscription
    const channel = supabase
      .channel(`conversation:${conversationId}`)
     .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, async (payload) => {
        const { data: msgWithProfile } = await supabase
          .from('messages')
          .select('*, profiles!messages_sender_id_fkey(username, avatar_url)')
          .eq('id', payload.new.id)
          .single()
        if (!msgWithProfile) return

        if (msgWithProfile.sender_id !== currentUserId) {
          playSound('pulse')
        }

        setMessages(prev => {
          // If this is a message WE sent, it was almost certainly already
          // pushed onto the list optimistically the instant sendMessage()
          // was called (see below) — so instead of appending a second
          // copy, find that placeholder and swap it for the real row.
          // This is what makes the bubble feel instant: it was on screen
          // before the network round trip even started, and this just
          // upgrades it to the real id once the DB confirms it (so read
          // receipts / status tracking, which key off the real id, work
          // correctly from here on).
          if (msgWithProfile.sender_id === currentUserId) {
            const matchIdx = prev.findIndex(m => m._optimistic && m.content === msgWithProfile.content)
            if (matchIdx !== -1) {
              const next = [...prev]
              next[matchIdx] = msgWithProfile
              return next
            }
          }
          // Avoid a duplicate if the real row already made it in some
          // other way (e.g. two open tabs, or a slow-arriving optimistic
          // match from a rapid double-send).
          if (prev.some(m => m.id === msgWithProfile.id)) return prev
          return [...prev, msgWithProfile]
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === currentUserId) return
        setTyping(prev => {
          if (payload.is_typing) {
            return prev.includes(payload.user_id) ? prev : [...prev, payload.user_id]
          }
          return prev.filter(id => id !== payload.user_id)
        })
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      // Don't leave a stale "typing" row behind if we unmount/switch
      // conversations mid-keystroke.
      if (typingRowActive.current && currentUserId) {
        typingRowActive.current = false
        supabase.from('typing_status')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('user_id', currentUserId)
          .then(({ error }) => { if (error) console.error('[useChat] typing_status cleanup failed:', error) })
      }
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId])

  // Optimistic send: the bubble goes into `messages` state IMMEDIATELY,
  // tagged `_optimistic: true` with a temporary id, before the DB write
  // even starts. It gets reconciled with the real row above once
  // realtime confirms the insert. If the write fails, the placeholder is
  // marked `_status: 'failed'` instead of silently vanishing, so the UI
  // can show a retry/error state on that bubble if it wants to.
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
          body: {
            conversationId,
            senderId: currentUserId,
            content: trimmed,
          }
        })
      }
    } catch (e) {
      console.error('sendMessage failed:', e)
      // Leave the bubble visible but flagged, rather than yanking it —
      // losing a message the person watched themselves send with no
      // trace is worse than showing it as failed.
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _status: 'failed' } : m))
    }
  }, [conversationId, currentUserId, isEmailConvo])

  // Broadcasts typing for the in-chat indicator (unchanged, low-latency),
  // AND writes/clears a typing_status row for the conversation-list
  // indicator. The DB write only fires on state transitions
  // (false→true, true→false), not on every keystroke, so it stays cheap
  // even with a fast typist.
  const broadcastTyping = useCallback((isTyping) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: currentUserId, is_typing: isTyping }
    })

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
  }, [currentUserId, conversationId])

  return { messages, loading, typing, sendMessage, broadcastTyping }
}

export function useConversations(userId) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return

    const { data: memberRows } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userId)

    const conversationIds = memberRows?.map(r => r.conversation_id) || []
    if (conversationIds.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    // Conversations this user has "deleted" (hidden for themselves
    // only) never show up in their own list, but stay fully intact
    // — messages, membership, Curry settings — for the other member
    // and for whenever this user texts them again.
    const { data: hiddenRows } = await supabase
      .from('hidden_conversations')
      .select('conversation_id')
      .eq('user_id', userId)

    const hiddenIds = new Set((hiddenRows || []).map(r => r.conversation_id))
    const visibleIds = conversationIds.filter(id => !hiddenIds.has(id))

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

  useEffect(() => {
    load()

    const channel = supabase
      .channel('conversations_list')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations'
      }, load)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'hidden_conversations'
      }, load)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [load])

  return { conversations, loading, reload: load }
}
