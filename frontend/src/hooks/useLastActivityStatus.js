import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

/**
 * For every conversation where the LAST message was sent by the
 * current user, works out whether it's been read/delivered and when —
 * powers the "Seen 20 minutes ago" line in the chat list, i.e.
 * OUTSIDE the open chat (useMessageStatus already covers inside-chat
 * bubbles).
 *
 * Returns { [conversationId]: { status: 'sent'|'delivered'|'read', timestamp } }
 * Conversations whose last message wasn't sent by me are simply
 * absent — fall back to the normal preview for those.
 */
export function useLastActivityStatus(conversationIds, currentUserId) {
  const [statusMap, setStatusMap] = useState({})
  const idsKey = conversationIds.join(',')

  const load = useCallback(async () => {
    if (!currentUserId || !conversationIds.length) { setStatusMap({}); return }

    const { data: msgs, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, created_at, delivered_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
    if (error) { console.error('[useLastActivityStatus] messages fetch failed:', error); return }

    const lastByConvo = {}
    for (const m of msgs || []) {
      if (!lastByConvo[m.conversation_id]) lastByConvo[m.conversation_id] = m
    }

    const mine = Object.values(lastByConvo).filter(m => m.sender_id === currentUserId)
    if (!mine.length) { setStatusMap({}); return }

    const myMsgIds = mine.map(m => m.id)
 const { data: reads, error: readsErr } = await supabase
  .from('message_reads')
  .select('message_id, user_id, read_at')
  .in('message_id', myMsgIds)
  .neq('user_id', currentUserId)
if (readsErr) console.error('[useLastActivityStatus] message_reads fetch failed:', readsErr)
const readByMsgId = {}
;(reads || []).forEach(r => { readByMsgId[r.message_id] = r.created_at })

    const next = {}
    mine.forEach(m => {
      if (readByMsgId[m.id]) {
        next[m.conversation_id] = { status: 'read', timestamp: readByMsgId[m.id] }
      } else if (m.delivered_at) {
        next[m.conversation_id] = { status: 'delivered', timestamp: m.delivered_at }
      } else {
        next[m.conversation_id] = { status: 'sent', timestamp: m.created_at }
      }
    })
    setStatusMap(next)
  }, [idsKey, currentUserId])

  useEffect(() => { load() }, [load])

  // Refresh whenever a read receipt comes in for this user's messages.
  useEffect(() => {
    if (!currentUserId) return
    const unsubscribe = subscribeToChannel(
      `list-activity-reads:${currentUserId}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'message_reads',
      }, (payload) => emit('insert', payload)),
      { onEvent: () => load(), onResync: load }
    )
    return unsubscribe
  }, [currentUserId, load])

  // Re-render every 30s so "just now" ages into "1m ago" etc. without
  // needing a new DB event.
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  return statusMap
}
