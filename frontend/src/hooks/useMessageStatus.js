import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * useMessageStatus
 * - Marks incoming messages "delivered" the moment they land in this
 *   client (i.e. the recipient's device has them), and "read" once
 *   the recipient has the chat open.
 * - Tells the sender whether their message has been delivered / read.
 *
 * Returns { readMap, deliveredMap } — both are { [messageId]: true }.
 */
export function useMessageStatus(messages, conversationId, currentUserId) {
  const [readMap, setReadMap] = useState({})
  const [deliveredMap, setDeliveredMap] = useState({})
  const deliveredAttempted = useRef(new Set())

  // ── Seed deliveredMap from whatever the messages already carry ──
  useEffect(() => {
    if (!messages.length) return
    setDeliveredMap(prev => {
      const next = { ...prev }
      messages.forEach(m => { if (m.delivered_at) next[m.id] = true })
      return next
    })
  }, [messages])

  // ── Mark incoming messages "delivered" the moment they reach us ──
  useEffect(() => {
    if (!conversationId || !currentUserId || !messages.length) return
    const undelivered = messages.filter(
      m => m.sender_id !== currentUserId
        && m.message_type !== 'system'
        && !m.delivered_at
        && !deliveredAttempted.current.has(m.id)
    )
    if (!undelivered.length) return
    undelivered.forEach(m => deliveredAttempted.current.add(m.id))
    const ids = undelivered.map(m => m.id)

    supabase
      .from('messages')
      .update({ delivered_at: new Date().toISOString() })
      .in('id', ids)
      .is('delivered_at', null) // don't clobber an existing timestamp
      .then(({ error }) => {
        if (error) return // likely missing RLS policy — see setup notes
        setDeliveredMap(prev => {
          const next = { ...prev }
          ids.forEach(id => { next[id] = true })
          return next
        })
      })
  }, [messages, conversationId, currentUserId])

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

    // Best-effort denormalized copy onto messages.read_at/read_by, so
    // those columns actually reflect something instead of sitting
    // unused. Safe to ignore failures here (e.g. group chats, or if
    // the RLS policy below hasn't been added yet).
    const ids = unread.map(m => m.id)
    supabase
      .from('messages')
      .update({ read_at: new Date().toISOString(), read_by: currentUserId })
      .in('id', ids)
      .then(() => {})
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

  return { readMap, deliveredMap }
}
