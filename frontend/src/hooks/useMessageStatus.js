import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * useMessageStatus
 * - Marks incoming messages as "read" when the chat is open
 * - Tells you whether YOUR sent message has been seen
 */
export function useMessageStatus(messages, conversationId, currentUserId) {
  const [readMap, setReadMap] = useState({}) // messageId -> true if seen by other

  // ── Mark all incoming messages as read when we open the chat ──
  useEffect(() => {
    if (!conversationId || !currentUserId || !messages.length) return

    const unread = messages.filter(
      m => m.sender_id !== currentUserId && m.message_type !== 'system'
    )
    if (!unread.length) return

    // Upsert reads for each unread message (ignore duplicates via unique constraint)
    const rows = unread.map(m => ({
      message_id: m.id,
      user_id: currentUserId,
    }))

    supabase.from('message_reads').upsert(rows, { onConflict: 'message_id,user_id' })
  }, [messages, conversationId, currentUserId])

  // ── Subscribe to reads so the sender sees when their message is seen ──
  useEffect(() => {
    if (!conversationId) return

    // Initial load — which of our sent messages have been read?
    async function loadReads() {
      const myMsgIds = messages
        .filter(m => m.sender_id === currentUserId)
        .map(m => m.id)
      if (!myMsgIds.length) return

      const { data } = await supabase
        .from('message_reads')
        .select('message_id, user_id')
        .in('message_id', myMsgIds)
        .neq('user_id', currentUserId) // read by someone else

      if (!data) return
      const map = {}
      data.forEach(r => { map[r.message_id] = true })
      setReadMap(map)
    }
    loadReads()

    // Realtime: fire when someone marks a message read
    const channel = supabase
      .channel(`reads:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_reads',
      }, (payload) => {
        const { message_id, user_id } = payload.new
        if (user_id !== currentUserId) {
          setReadMap(prev => ({ ...prev, [message_id]: true }))
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [conversationId, currentUserId, messages])

  return readMap
}
