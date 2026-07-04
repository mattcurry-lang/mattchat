import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * useGlobalDelivery
 * Marks incoming messages "delivered" the moment they reach this
 * device — across ALL of the user's conversations, not just whichever
 * one happens to be open. This is what makes "Delivered" behave like
 * real WhatsApp instead of only updating once you click into a chat.
 *
 * Two parts:
 * 1. A one-time catch-up sweep on load for anything that arrived
 *    while the app was closed (offline, tab not open, etc).
 * 2. A live realtime subscription spanning every conversation you're
 *    in, so messages get marked delivered instantly while the app is
 *    open, even if you're looking at a different chat (or no chat
 *    at all — just sitting on the list screen).
 *
 * Mount this once near the top of ChatPage, unconditionally — it
 * doesn't care which conversation (if any) is currently open.
 */
export function useGlobalDelivery(userId, conversationIds) {
  const idsKey = conversationIds.join(',')
  const sweepDone = useRef(new Set())

  // ── Catch-up sweep ──
  useEffect(() => {
    if (!userId || !conversationIds.length) return
    const key = `${userId}:${idsKey}`
    if (sweepDone.current.has(key)) return
    sweepDone.current.add(key)

    supabase
      .from('messages')
      .update({ delivered_at: new Date().toISOString() })
      .in('conversation_id', conversationIds)
      .neq('sender_id', userId)
      .is('delivered_at', null)
      .then(({ error }) => {
        if (error) console.error('[useGlobalDelivery] catch-up sweep failed:', error)
      })
  }, [userId, idsKey])

  // ── Live delivery while the app is open ──
  useEffect(() => {
    if (!userId || !conversationIds.length) return

    const channel = supabase
      .channel(`delivery:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=in.(${conversationIds.join(',')})`,
      }, (payload) => {
        const msg = payload.new
        if (msg.sender_id === userId) return
        if (msg.delivered_at) return
        supabase
          .from('messages')
          .update({ delivered_at: new Date().toISOString() })
          .eq('id', msg.id)
          .is('delivered_at', null)
          .then(({ error }) => {
            if (error) console.error('[useGlobalDelivery] live delivery mark failed:', error)
          })
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [userId, idsKey])
}
