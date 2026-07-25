import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

// How often the "driver" (whoever last acted) broadcasts their
// position, so a late joiner or reconnecting viewer can catch up —
// not every frame, just enough to keep drift small without spamming
// the realtime channel.
const POSITION_BROADCAST_MS = 3000

export function useWatchTogether(conversationId, userId) {
  const [session, setSession] = useState(null)
  const lastLocalUpdate = useRef(0) // timestamp of our own last write, to ignore our own echo

  const loadActive = useCallback(() => {
    if (!conversationId) return
    supabase
      .from('watch_together_sessions')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => setSession(data || null))
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
          const row = payload.new
          if (!row) { setSession(null); return }
          // Ignore our own writes echoing back — avoids a feedback
          // loop where our own seek/play triggers a "remote update"
          // that yanks the player again.
          if (row.last_updated_by === userId && Date.now() - lastLocalUpdate.current < 1500) return
          setSession(row.status === 'active' ? row : null)
        },
        onResync: loadActive,
      }
    )
    return unsubscribe
  }, [conversationId, userId, loadActive])

  const startSession = useCallback(async (videoId) => {
    const { data, error } = await supabase.from('watch_together_sessions').insert({
      conversation_id: conversationId,
      video_id: videoId,
      started_by: userId,
      last_updated_by: userId,
    }).select().single()
    if (error) throw error
    setSession(data)
    return data
  }, [conversationId, userId])

  const updatePlayback = useCallback(async (patch) => {
    if (!session) return
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

  return { session, startSession, updatePlayback, endSession }
}
