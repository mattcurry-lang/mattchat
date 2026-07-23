import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

/**
 * useUnreadCounts
 * Tracks how many unread messages you have in each conversation.
 * "Unread" = a message not sent by you, with no message_reads row for
 * you yet.
 *
 * Filter here was already correctly scoped (conversation_id=in.(...)
 * for messages, user_id=eq for message_reads) — now goes through the
 * shared manager so both listeners live on one deduped channel and a
 * dropped connection triggers a full recompute on reconnect instead of
 * leaving counts stale.
 *
 * Returns { unreadCounts, clearUnread, totalUnread }.
 */
export function useUnreadCounts(userId, conversationIds) {
  const [unreadCounts, setUnreadCounts] = useState({})
  const idsKey = conversationIds.slice().sort().join(',')

  const refresh = useCallback(async () => {
    if (!userId || !conversationIds.length) { setUnreadCounts({}); return }

    const { data: msgs, error: msgErr } = await supabase
      .from('messages')
      .select('id, conversation_id')
      .in('conversation_id', conversationIds)
      .neq('sender_id', userId)
    if (msgErr) { console.error('[useUnreadCounts] failed to load messages:', msgErr); return }
    if (!msgs || !msgs.length) { setUnreadCounts({}); return }

    const { data: reads, error: readErr } = await supabase
      .from('message_reads')
      .select('message_id')
      .eq('user_id', userId)
    if (readErr) { console.error('[useUnreadCounts] failed to load message_reads:', readErr); return }

    const readIds = new Set((reads || []).map(r => r.message_id))
    const counts = {}
    msgs.forEach(m => {
      if (!readIds.has(m.id)) counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1
    })
    setUnreadCounts(counts)
  }, [userId, idsKey])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!userId || !conversationIds.length) return
    const unsubscribe = subscribeToChannel(
      `unread:${userId}:${idsKey}`,
      (channel, emit) => channel
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `conversation_id=in.(${conversationIds.join(',')})`,
        }, (p) => emit('message_insert', p))
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'message_reads',
          filter: `user_id=eq.${userId}`,
        }, (p) => emit('read_insert', p)),
      {
        onEvent: (type, payload) => {
          if (type === 'message_insert') {
            if (payload.new.sender_id === userId) return
            if (payload.new.message_type === 'system') return
            setUnreadCounts(prev => ({
              ...prev,
              [payload.new.conversation_id]: (prev[payload.new.conversation_id] || 0) + 1,
            }))
          } else {
            // Something (possibly us, in another tab) got marked read —
            // recompute properly rather than guessing at the delta.
            refresh()
          }
        },
        onResync: refresh,
      }
    )
    return unsubscribe
  }, [userId, idsKey, refresh])

  const clearUnread = useCallback((conversationId) => {
    setUnreadCounts(prev => {
      if (!prev[conversationId]) return prev
      const next = { ...prev }
      delete next[conversationId]
      return next
    })
  }, [])

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0)
  return { unreadCounts, clearUnread, totalUnread, refreshUnread: refresh }
}
