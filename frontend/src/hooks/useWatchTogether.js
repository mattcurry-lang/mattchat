import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

// A 'pending' invite nobody acted on shouldn't keep resurfacing forever
// — if decline/accept never persisted (e.g. blocked by RLS, or the
// inviter just closed the tab), treat it as expired client-side rather
// than showing a stale invite as if it just happened.
const PENDING_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

export function useWatchTogether(conversationId, userId) {
  const [session, setSession] = useState(null)
  const lastLocalUpdate = useRef(0)
  const dismissedIdsRef = useRef(new Set()) 

  const loadActive = useCallback(() => {
    if (!conversationId) return
    supabase
      .from('watch_together_sessions')
      .select('*')
      .eq('conversation_id', conversationId)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data || null
        if (row && dismissedIdsRef.current.has(row.id)) { setSession(null); return }

        // Self-healing: a 'pending' invite that's sat unanswered past
        // the expiry window is treated as dead. Best-effort mark it
        // 'ended' in the DB too, so it stops resurfacing for the OTHER
        // participant as well — but don't block on it (if this fails,
        // e.g. same RLS issue that can block decline, we still hide it
        // locally either way).
        if (row?.status === 'pending') {
          const ageMs = Date.now() - new Date(row.created_at).getTime()
          if (ageMs > PENDING_EXPIRY_MS) {
            dismissedIdsRef.current.add(row.id)
            supabase.from('watch_together_sessions').update({ status: 'ended' }).eq('id', row.id)
              .then(({ error }) => {
                if (error) console.warn('[watchTogether] could not auto-expire stale invite (non-fatal):', error)
              })
            setSession(null)
            return
          }
        }

        setSession(row)
      })
  }, [conversationId])

  useEffect(() => { loadActive() }, [loadActive])
useEffect(() => {
    if (!conversationId) return
    const unsubscribe = subscribeToChannel(
      `watch-together:${conversationId}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'watch_together_sessions',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => emit('change', payload)),
      {
        onEvent: (type, payload) => {
          console.log('[watchTogether] realtime event received:', payload.new)
          const row = payload.new
          if (!row || row.status === 'ended' || row.status === 'declined') { setSession(null); return }
          // Always refetch fresh from the DB rather than trusting the
          // payload shape directly — avoids any stale-closure issue
          // and guarantees we render exactly what's actually stored.
          loadActive()
        },
        onResync: loadActive,
      }
    )
    return unsubscribe
  }, [conversationId, userId, loadActive])
  // Creates a PENDING invite, not a live session — the other person
  // must accept before either side actually watches anything.
  const inviteToWatch = useCallback(async (videoId) => {
    // Defensive cleanup: close out any stale pending/active sessions
    // for this conversation before starting a new one, mirroring the
    // "one active session per conversation" pattern used for drawing
    // sessions elsewhere in this app. Without this, old abandoned rows
    // pile up and can resurface later even after a fresh invite is
    // handled correctly.
    await supabase.from('watch_together_sessions')
      .update({ status: 'ended' })
      .eq('conversation_id', conversationId)
      .in('status', ['pending', 'active'])

    const { data, error } = await supabase.from('watch_together_sessions').insert({
      conversation_id: conversationId,
      video_id: videoId,
      started_by: userId,
      last_updated_by: userId,
      status: 'pending',
    }).select().single()
    if (error) throw error
    setSession(data)
    return data
  }, [conversationId, userId])

  const acceptInvite = useCallback(async () => {
    if (!session) return
    lastLocalUpdate.current = Date.now()
    const { data, error } = await supabase.from('watch_together_sessions')
      .update({ status: 'active', last_updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', session.id).select().single()
    if (error) throw error
    setSession(data)
  }, [session, userId])

  const declineInvite = useCallback(async () => {
    if (!session) return
    dismissedIdsRef.current.add(session.id)          // ← NEW: never show this id again locally
    setSession(null)
    const { error, data } = await supabase.from('watch_together_sessions')
      .update({ status: 'declined' })
      .eq('id', session.id)
      .select()
    if (error || !data?.length) {
      console.error('declineInvite: DB update did not persist (likely blocked by RLS):', error)
    }
  }, [session])

  const updatePlayback = useCallback(async (patch) => {
    if (!session || session.status !== 'active') return
    lastLocalUpdate.current = Date.now()
    await supabase.from('watch_together_sessions').update({
      ...patch, last_updated_by: userId, updated_at: new Date().toISOString(),
    }).eq('id', session.id)
  }, [session, userId])

  const endSession = useCallback(async () => {
    if (!session) return
    await supabase.from('watch_together_sessions').update({ status: 'ended' }).eq('id', session.id)
    setSession(null)
  }, [session])

  return { session, inviteToWatch, acceptInvite, declineInvite, updatePlayback, endSession }
}
