import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'
 

// A 'pending' invite nobody acted on shouldn't keep resurfacing forever
// — if decline/accept never persisted (e.g. blocked by RLS, or the
// inviter just closed the tab), treat it as expired client-side rather
// than showing a stale invite as if it just happened.
const PENDING_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

export function useWatchTogether(conversationId, userId, username) {
  const [session, setSession] = useState(null)
  const [chatMessages, setChatMessages] = useState([])    
  const lastLocalUpdate = useRef(0)
  const dismissedIdsRef = useRef(new Set())
  const chatChannelRef = useRef(null)                     
  const transcriptRef = useRef([])  

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
     useEffect(() => {
    if (!session?.id) {
      chatChannelRef.current?.unsubscribe()
      chatChannelRef.current = null
      setChatMessages([])
      transcriptRef.current = []
      return
    }
    const channel = supabase.channel(`watch-chat:${session.id}`)
    channel
      .on('broadcast', { event: 'msg' }, ({ payload }) => {
        setChatMessages(prev => [...prev, payload])
        transcriptRef.current = [...transcriptRef.current, payload]
      })
      .subscribe()
    chatChannelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [session?.id])

  const sendWatchMessage = useCallback((text) => {
    if (!session?.id || !chatChannelRef.current) return
    const payload = { userId, username: username || 'Someone', text, ts: Date.now() }
    chatChannelRef.current.send({ type: 'broadcast', event: 'msg', payload })
    // Show it locally too — broadcast doesn't echo back to the sender
    setChatMessages(prev => [...prev, payload])
    transcriptRef.current = [...transcriptRef.current, payload]
  }, [session, userId, username])

      const endSession = useCallback(async (videoMeta) => {
    if (!session) return
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
    dismissedIdsRef.current.add(session.id)          
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
  try {
      const { data: members } = await supabase
        .from('conversation_members').select('user_id').eq('conversation_id', conversationId)
      const participantIds = (members || []).map(m => m.user_id)

      await supabase.from('watch_together_history').insert({
        conversation_id: conversationId,
        video_id: session.video_id,
        video_title: videoMeta?.title || null,
        video_thumbnail_url: videoMeta?.thumbnailUrl || null,
        started_by: session.started_by,
        participant_ids: participantIds,
        transcript: transcriptRef.current,
        started_at: session.created_at,
      })
    } catch (e) {
      console.error('Could not save watch history:', e)
    }

    setSession(null)
  }, [session, conversationId])

  return {
    session, inviteToWatch, acceptInvite, declineInvite, updatePlayback, endSession,
    chatMessages, sendWatchMessage,    
  }
}
   
