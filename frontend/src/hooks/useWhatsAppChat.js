import { useState, useEffect, useCallback, useRef } from 'react'
import { callWhatsAppApi } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

// Mirrors useChat's shape ({ messages, loading, sendMessage }) for 
// single WhatsApp conversation. Sending goes through whatsapp-api
// (which itself calls the Graph API and inserts the outbound row) —
// there's no optimistic local insert here yet, since Cloud API sends
// are usually fast enough that the round trip feels immediate; can
// revisit if it feels laggy once real traffic is on it.
export function useWhatsAppChat(session, conversationId, userId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const prevConvoId = useRef(null)

  const reload = useCallback(async () => {
    if (!session || !conversationId) return
    const data = await callWhatsAppApi(session, 'list_messages', { conversationId })
    if (data.ok) setMessages(data.messages || [])
    setLoading(false)
  }, [session, conversationId])

  useEffect(() => {
    if (conversationId !== prevConvoId.current) {
      setLoading(true)
      setMessages([])
      prevConvoId.current = conversationId
    }
    reload()
  }, [conversationId, reload])

  useEffect(() => {
    if (!conversationId) return
    const unsubscribe = subscribeToChannel(
      `whatsapp-messages:${conversationId}`,
      (channel, emit) => channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => emit('change', payload)
      ),
      { onEvent: reload, onResync: reload }
    )
    return unsubscribe
  }, [conversationId, reload])

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !conversationId) return
    setSending(true)
    try {
      const data = await callWhatsAppApi(session, 'send_text', { conversationId, text: text.trim() })
      if (!data.ok) throw new Error(data.error || 'Message failed to send')
      await reload()
    } finally {
      setSending(false)
    }
  }, [session, conversationId, reload])

  return { messages, loading, sending, sendMessage, reload }
}
