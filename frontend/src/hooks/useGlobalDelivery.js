import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

/**
 * useGlobalDelivery
 * Marks incoming messages "delivered" the moment they reach this
 * device — across ALL of the user's conversations, not just whichever
 * one happens to be open.
 *
 * Unchanged in behavior from before (filter was already correctly
 * scoped to this user's conversation ids) — now goes through the
 * shared realtime manager so a dropped connection re-runs the catch-up
 * sweep on reconnect instead of silently missing whatever arrived
 * during the gap.
 *
 * Mount this once near the top of ChatPage, unconditionally.
 */
export function useGlobalDelivery(userId, conversationIds) {
  const idsKey = conversationIds.slice().sort().join(',')
  const sweepDone = useRef(new Set())

  const runSweep = () => {
    if (!userId || !conversationIds.length) return
    supabase
      .from('messages')
      .update({ delivered_at: new Date().toISOString() })
      .in('conversation_id', conversationIds)
      .neq('sender_id', userId)
      .is('delivered_at', null)
      .then(({ error }) => {
        if (error) console.error('[useGlobalDelivery] sweep failed:', error)
      })
  }

  // ── One-time catch-up sweep on load ──
  useEffect(() => {
    if (!userId || !conversationIds.length) return
    const key = `${userId}:${idsKey}`
    if (sweepDone.current.has(key)) return
    sweepDone.current.add(key)
    runSweep()
  }, [userId, idsKey])

  // ── Live delivery while the app is open, via the shared manager ──
  useEffect(() => {
    if (!userId || !conversationIds.length) return
    const unsubscribe = subscribeToChannel(
      `delivery:${userId}:${idsKey}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=in.(${conversationIds.join(',')})`,
      }, (payload) => emit('insert', payload)),
      {
        onEvent: (type, payload) => {
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
        },
        // Anything that arrived mid-drop never fired an INSERT event —
        // re-run the sweep to catch it up.
        onResync: runSweep,
      }
    )
    return unsubscribe
  }, [userId, idsKey])
}
