import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getMessages, sendMessage as sendMsg } from '../lib/supabase'

export function useChat(conversationId, currentUserId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [typing, setTyping] = useState([])
  const [isEmailConvo, setIsEmailConvo] = useState(false)
  const channelRef = useRef(null)

  useEffect(() => {
    if (!conversationId) return

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
        if (msgWithProfile) {
          setMessages(prev => [...prev, msgWithProfile])
        }
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
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId])

  const sendMessage = useCallback(async (content) => {
    if (!conversationId || !currentUserId || !content.trim()) return

    // Insert message into DB
    await sendMsg(conversationId, currentUserId, content.trim())

    // If this is an email conversation, also send an outbound email reply
    if (isEmailConvo) {
      await supabase.functions.invoke('send-email', {
        body: {
          conversationId,
          senderId: currentUserId,
          content: content.trim(),
        }
      })
    }
  }, [conversationId, currentUserId, isEmailConvo])

  const broadcastTyping = useCallback((isTyping) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: currentUserId, is_typing: isTyping }
    })
  }, [currentUserId])

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
