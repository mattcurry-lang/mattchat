import { useState, useEffect, useCallback } from 'react'
import { callWhatsAppApi, supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

// Mirrors useConversations' shape ({ conversations, loading, reload })
// but sources from whatsapp_conversations via the whatsapp-api proxy
// instead of the native conversations table — WhatsApp threads are 
// separate data source entirely, not mixed into Mattchat's own chat
// list.
export function useWhatsAppConversations(session, userId) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!session) return
    const data = await callWhatsAppApi(session, 'list_conversations')
    if (data.ok) setConversations(data.conversations || [])
    setLoading(false)
  }, [session])

  useEffect(() => { reload() }, [reload])

  // Realtime: any insert/update on this user's WhatsApp conversations
  // (new inbound message bumping last_message/unread_count, a
  // manual pin/mute toggle, etc.) triggers a full reload rather than
  // patching state in place — the list is small enough per user that
  // simplicity wins over a hand-rolled merge.
  useEffect(() => {
    if (!userId) return
    const unsubscribe = subscribeToChannel(
      `whatsapp-conversations:${userId}`,
      (channel, emit) => channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_conversations', filter: `user_id=eq.${userId}` },
        (payload) => emit('change', payload)
      ),
      { onEvent: reload, onResync: reload }
    )
    return unsubscribe
  }, [userId, reload])

  return { conversations, loading, reload }
}
