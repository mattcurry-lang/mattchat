import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getMessages, sendMessage as sendMsg } from '../lib/supabase'

export function useChat(conversationId, currentUserId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [typing, setTyping] = useState([])
  const channelRef = useRef(null)

  useEffect(() => {
    if (!conversationId) return

    setLoading(true)
    getMessages(conversationId).then(data => {
      setMessages(data || [])
      setLoading(false)
    })

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
          .select('*, profiles(username, avatar_url)')
          .eq('id', payload.new.id)
          .single()
        setMessages(prev => [...prev, msgWithProfile])
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === currentUserId) return
        setTyping(prev => {
          const exists = prev.find(t => t.user_id === payload.user_id)
          if (payload.is_typing) {
            return exists ? prev : [...prev, payload]
          }
          return prev.filter(t => t.user_id !== payload.user_id)
        })
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId])

  const sendMessage = useCallback(async (content) => {
    if (!content.trim()) return
    await sendMsg(conversationId, currentUserId, content)
  }, [conversationId, currentUserId])

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

    // Step 1: find which conversations this user belongs to.
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

    // Step 2: fetch those conversations WITH all their members
    // (not filtered down to just the current user — otherwise the
    // other participant's profile gets dropped from the result).
    const { data } = await supabase
      .from('conversations')
      .select(`
        id, updated_at, last_message, is_group, name,
        conversation_members(
          user_id,
          profiles(id, username, email, avatar_url)
        )
      `)
      .in('id', conversationIds)
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
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [load])

  return { conversations, loading, reload: load }
}
