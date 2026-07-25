import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

export function useWatchTogether(conversationId, userId) {
  const [session, setSession] = useState(null) // any non-ended session, whatever its status
  const lastLocalUpdate = useRef(0)

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
          if (!row || row.status === 'ended' || row.status === 'declined') { setSession(null); return }
          if (row.last_updated_by === userId && Date.now() - lastLocalUpdate.current < 1500) return
          setSession(row)
        },
        onResync: loadActive,
      }
    )
    return unsubscribe
  }, [conversationId, userId, loadActive])

  // Creates a PENDING invite, not a live session — the other person
  // must accept before either side actually watches anything.
  const inviteToWatch = useCallback(async (videoId) => {
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
    await supabase.from('watch_together_sessions').update({ status: 'declined' }).eq('id', session.id)
    setSession(null)
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
