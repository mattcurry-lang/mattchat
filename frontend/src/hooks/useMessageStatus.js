import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

/**
 * useMessageStatus
 * - Reads delivered_at off messages (SET by useGlobalDelivery — this
 *   hook just surfaces it for whichever conversation is open).
 * - Marks incoming messages "read" when this specific chat is open.
 * - Tells you whether YOUR sent messages have been delivered / read.
 *
 * Returns { readMap, deliveredMap } — both are { [messageId]: true }.
 *
 * FIX: previously opened a brand-new `reads:${conversationId}` channel
 * every time you switched conversations (tearing down and rebuilding a
 * whole subscription per chat you opened), AND that channel had no
 * filter at all — it received every message_reads INSERT from every
 * user in the database.
 *
 * `message_reads` has no conversation_id column, so a real server-side
 * filter isn't possible without a schema change:
 *   TODO: add a denormalized `conversation_id` column to
 *   message_reads (backfilled + kept in sync via trigger), so this
 *   channel can filter server-side by `conversation_id=in.(...)`
 *   the same way messages/active_calls/delivery already do.
 *
 * Until then: ONE persistent channel for the whole session (instead of
 * one per conversation open/close), still receiving all inserts, but
 * filtered client-side against a ref of "my message ids in the
 * currently open conversation" that updates as messages/conversation
 * change — so at least the channel itself isn't recreated on every
 * chat switch.
 *
 * NOTE: writing read_at/read_by requires the "Members can mark
 * messages delivered or read" UPDATE policy on the messages table.
 */
export function useMessageStatus(messages, conversationId, currentUserId) {
  const [readMap, setReadMap] = useState({})
  const [deliveredMap, setDeliveredMap] = useState({})
  const myOpenMsgIds = useRef(new Set()) // my sent message ids, in the currently open conversation

  // ── Seed deliveredMap from whatever the messages already carry ──
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
    const unread = messages.filter(m => m.sender_id !== currentUserId && m.message_type !== 'system')
    if (!unread.length) return
    const rows = unread.map(m => ({ message_id: m.id, user_id: currentUserId }))
    supabase
      .from('message_reads')
      .upsert(rows, { onConflict: 'message_id,user_id', ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) console.error('[useMessageStatus] failed to upsert message_reads:', error)
      })
  }, [messages, conversationId, currentUserId])

  // Keep the "which of my messages are in the open conversation" ref
  // current, and do the initial reads lookup for it.
  useEffect(() => {
    const myMsgIds = messages
      .filter(m => m.sender_id === currentUserId && !m._optimistic)
      .map(m => m.id)
    myOpenMsgIds.current = new Set(myMsgIds)

    if (!conversationId || !myMsgIds.length) { setReadMap({}); return }

    supabase
      .from('message_reads')
      .select('message_id, user_id')
      .in('message_id', myMsgIds)
      .neq('user_id', currentUserId)
      .then(({ data, error }) => {
        if (error) { console.error('[useMessageStatus] failed to load message_reads:', error); return }
        const map = {}
        ;(data || []).forEach(r => { map[r.message_id] = true })
        setReadMap(map)
      })
  }, [conversationId, currentUserId, messages])

  // ── One persistent channel for the session, not one per conversation ──
  useEffect(() => {
    if (!currentUserId) return
    const unsubscribe = subscribeToChannel(
      `message_reads:${currentUserId}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'message_reads',
      }, (payload) => emit('insert', payload)),
      {
        onEvent: (type, payload) => {
          const { message_id, user_id } = payload.new
          if (user_id === currentUserId) return
          if (!myOpenMsgIds.current.has(message_id)) return // not one of my messages in the open chat
          setReadMap(prev => ({ ...prev, [message_id]: true }))
        },
      }
    )
    return unsubscribe
  }, [currentUserId])

  return { readMap, deliveredMap }
}
