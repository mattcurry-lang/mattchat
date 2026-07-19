import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * useMessageStatus
 * - Reads delivered_at off messages (actually SET by useGlobalDelivery,
 *   which runs across all conversations — this hook just surfaces it
 *   for whichever conversation is currently open).
 * - Marks incoming messages "read" when this specific chat is open.
 * - Tells you whether YOUR sent messages have been delivered / read.
 *
 * Returns { readMap, deliveredMap } — both are { [messageId]: true }.
 *
 * NOTE: writing read_at/read_by requires the "Members can mark
 * messages delivered or read" UPDATE policy on the messages table
 * (see messages_update_policy.sql). Check your browser console for
 * "[useMessageStatus]" errors if statuses aren't updating.
 */
export function useMessageStatus(messages, conversationId, currentUserId) {
  const [readMap, setReadMap] = useState({})
  const [deliveredMap, setDeliveredMap] = useState({})

  // ── Seed deliveredMap from whatever the messages already carry ──
  // (delivered_at itself is written by useGlobalDelivery, not here)
  useEffect(() => {
    if (!messages.length) return
    setDeliveredMap(prev => {
      const next = { ...prev }
      messages.forEach(m => { if (m.delivered_at) next[m.id] = true })
      return next
    })
  }, [messages])

  // ── Mark all incoming messages as read when we open the chat ──
  useEffect(() => {
    if (!conversationId || !currentUserId || !messages.length) return
    const unread = messages.filter(
      m => m.sender_id !== currentUserId && m.message_type !== 'system'
    )
    if (!unread.length) return

    const rows = unread.map(m => ({
      message_id: m.id,
      user_id: currentUserId,
    }))
    // ignoreDuplicates instead of a plain upsert: an upsert's UPDATE-on-
    // conflict path needs its own RLS policy. We don't need to bump
    // read_at on repeat opens anyway, so just skip existing rows.
    supabase
      .from('message_reads')
      .upsert(rows, { onConflict: 'message_id,user_id', ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) console.error('[useMessageStatus] failed to upsert message_reads:', error)
      })

    // Best-effort denormalized copy onto messages.read_at/read_by.
  }, [messages, conversationId, currentUserId])
  // ── Subscribe to reads so the sender sees when their message is seen ──
  useEffect(() => {
    if (!conversationId) return
    // Initial load — which of our sent messages have been read?
    async function loadReads() {
      const myMsgIds = messages
        .filter(m => m.sender_id === currentUserId && !m._optimistic)
        .map(m => m.id)
      if (!myMsgIds.length) return
      const { data, error } = await supabase
        .from('message_reads')
        .select('message_id, user_id')
        .in('message_id', myMsgIds)
        .neq('user_id', currentUserId) // read by someone else
      if (error) {
        console.error('[useMessageStatus] failed to load message_reads:', error)
        return
      }
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

  return { readMap, deliveredMap }
}
