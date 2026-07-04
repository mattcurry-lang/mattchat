import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * useUnreadCounts
 * Tracks how many unread messages you have in each conversation, so
 * the UI can show "you have new messages" before you've even opened
 * the chat — badges on the story rail, bold rows in the chat list.
 *
 * "Unread" = a message not sent by you, with no message_reads row for
 * you yet. Uses the same message_reads table useMessageStatus writes
 * to, so opening a chat (which marks its messages read) naturally
 * clears that conversation's count too.
 *
 * Returns { unreadCounts, clearUnread, totalUnread }.
 * unreadCounts is { [conversationId]: number }.
 */
export function useUnreadCounts(userId, conversationIds) {
  const [unreadCounts, setUnreadCounts] = useState({})
  const idsKey = conversationIds.join(',')

  const refresh = useCallback(async () => {
    if (!userId || !conversationIds.length) {
      setUnreadCounts({})
      return
    }
    const { data: msgs, error: msgErr } = await supabase
      .from('messages')
      .select('id, conversation_id')
      .in('conversation_id', conversationIds)
      .neq('sender_id', userId)
    if (msgErr) {
      console.error('[useUnreadCounts] failed to load messages:', msgErr)
      return
    }
    if (!msgs || !msgs.length) {
      setUnreadCounts({})
      return
    }

    const { data: reads, error: readErr } = await supabase
      .from('message_reads')
      .select('message_id')
      .eq('user_id', userId)
    if (readErr) {
      console.error('[useUnreadCounts] failed to load message_reads:', readErr)
      return
    }

    const readIds = new Set((reads || []).map(r => r.message_id))
    const counts = {}
    msgs.forEach(m => {
      if (!readIds.has(m.id)) {
        counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1
      }
    })
    setUnreadCounts(counts)
  }, [userId, idsKey])

  useEffect(() => { refresh() }, [refresh])

  // ── Live updates ──
  useEffect(() => {
    if (!userId || !conversationIds.length) return

    const channel = supabase
      .channel(`unread:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=in.(${conversationIds.join(',')})`,
      }, (payload) => {
        if (payload.new.sender_id === userId) return
        if (payload.new.message_type === 'system') return
        setUnreadCounts(prev => ({
          ...prev,
          [payload.new.conversation_id]: (prev[payload.new.conversation_id] || 0) + 1,
        }))
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_reads',
        filter: `user_id=eq.${userId}`,
      }, () => {
        // Something (possibly us, in another tab) got marked read —
        // recompute properly rather than guessing at the delta.
        refresh()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [userId, idsKey, refresh])

  // Optimistic local clear — call this the instant a chat is opened,
  // so the badge disappears immediately instead of waiting on the
  // read-marking round trip to Supabase.
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
