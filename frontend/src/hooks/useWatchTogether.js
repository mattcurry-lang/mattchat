import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

// A 'pending' invite nobody acted on shouldn't keep resurfacing forever
// — if decline/accept never persisted (e.g. blocked by RLS, or the
// inviter just closed the tab), treat it as expired client-side rather
// than showing a stale invite as if it just happened.
const PENDING_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
const TYPING_IDLE_MS = 3000 // clear a peer's "typing" state if no refresh comes in

export function useWatchTogether(conversationId, userId, username) {
  const [session, setSession] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [typingUsers, setTypingUsers] = useState([]) // [{ userId, username }]
  const lastLocalUpdate = useRef(0)
  const dismissedIdsRef = useRef(new Set())
  const chatChannelRef = useRef(null)
  const transcriptRef = useRef([])
  const typingTimersRef = useRef(new Map()) // userId -> timeout handle
  const ownTypingTimerRef = useRef(null)

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
      .then(({ data, error }) => {
        if (error) { console.error('[watchTogether] loadActive failed:', error); return }
        const row = data || null
        if (row && dismissedIdsRef.current.has(row.id)) { setSession(null); return }

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
      .catch((err) => console.error('[watchTogether] loadActive threw:', err))
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
          loadActive()
        },
        onResync: loadActive,
      }
    )
    return unsubscribe
  }, [conversationId, userId, loadActive])

  // ── Watch-together chat (ephemeral broadcast: messages + typing) ──
  useEffect(() => {
    // Clear any leftover typing timers from a previous session
    typingTimersRef.current.forEach((t) => clearTimeout(t))
    typingTimersRef.current.clear()
    if (ownTypingTimerRef.current) { clearTimeout(ownTypingTimerRef.current); ownTypingTimerRef.current = null }
    setTypingUsers([])

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
        // A message arriving is a definitive signal that user stopped typing
        clearTypingTimer(payload.userId)
        setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId))
        setChatMessages((prev) => [...prev, payload])
        transcriptRef.current = [...transcriptRef.current, payload]
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === userId) return // ignore our own echo
        clearTypingTimer(payload.userId)

        if (payload.isTyping) {
          setTypingUsers((prev) =>
            prev.some((u) => u.userId === payload.userId)
              ? prev
              : [...prev, { userId: payload.userId, username: payload.username || 'Someone' }]
          )
          const timer = setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId))
            typingTimersRef.current.delete(payload.userId)
          }, TYPING_IDLE_MS)
          typingTimersRef.current.set(payload.userId, timer)
        } else {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId))
        }
      })
      .subscribe()
    chatChannelRef.current = channel

    function clearTypingTimer(uid) {
      const t = typingTimersRef.current.get(uid)
      if (t) { clearTimeout(t); typingTimersRef.current.delete(uid) }
    }

    return () => {
      channel.unsubscribe()
      typingTimersRef.current.forEach((t) => clearTimeout(t))
      typingTimersRef.current.clear()
    }
  }, [session?.id, userId])

  const sendWatchMessage = useCallback((text) => {
    if (!session?.id || !chatChannelRef.current) return
    const payload = { userId, username: username || 'Someone', text, ts: Date.now() }
    chatChannelRef.current.send({ type: 'broadcast', event: 'msg', payload })
    setChatMessages((prev) => [...prev, payload])
    transcriptRef.current = [...transcriptRef.current, payload]

    // Sending a message implicitly ends the typing state
    if (ownTypingTimerRef.current) { clearTimeout(ownTypingTimerRef.current); ownTypingTimerRef.current = null }
    chatChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId, username, isTyping: false } })
  }, [session, userId, username])

  // Call on every keystroke in the composer (debounced internally).
  // Sends "typing: true" immediately, then auto-clears after idle.
  const setTyping = useCallback((isTyping) => {
    if (!session?.id || !chatChannelRef.current) return

    if (isTyping) {
      chatChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId, username, isTyping: true } })
      if (ownTypingTimerRef.current) clearTimeout(ownTypingTimerRef.current)
      ownTypingTimerRef.current = setTimeout(() => {
        chatChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId, username, isTyping: false } })
        ownTypingTimerRef.current = null
      }, TYPING_IDLE_MS)
    } else {
      if (ownTypingTimerRef.current) { clearTimeout(ownTypingTimerRef.current); ownTypingTimerRef.current = null }
      chatChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId, username, isTyping: false } })
    }
  }, [session, userId, username])

  // Creates a PENDING invite, not a live session — the other person
  // must accept before either side actually watches anything.
  // videoTitle/videoThumbnailUrl are captured at invite-time (from the
  // YouTubeCard's oEmbed data, which is already loaded there) so
  // endSession never needs a fresh fetch just to know what to save.
  const inviteToWatch = useCallback(async (videoId, videoTitle, videoThumbnailUrl) => {
    await supabase.from('watch_together_sessions')
      .update({ status: 'ended' })
      .eq('conversation_id', conversationId)
      .in('status', ['pending', 'active'])

    const { data, error } = await supabase.from('watch_together_sessions').insert({
      conversation_id: conversationId,
      video_id: videoId,
      video_title: videoTitle || null,
      video_thumbnail_url: videoThumbnailUrl || null,
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

  // Ends the session AND saves it into per-user watch history, using
  // the title/thumbnail captured on the session row at invite-time —
  // no mid-session fetch needed.
  const endSession = useCallback(async () => {
    if (!session) return
    await supabase.from('watch_together_sessions').update({ status: 'ended' }).eq('id', session.id)

    try {
      const { data: members } = await supabase
        .from('conversation_members').select('user_id').eq('conversation_id', conversationId)
      const participantIds = (members || []).map(m => m.user_id)

      await supabase.from('watch_together_history').insert({
        conversation_id: conversationId,
        video_id: session.video_id,
        video_title: session.video_title || null,
        video_thumbnail_url: session.video_thumbnail_url || null,
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
    chatMessages, sendWatchMessage, typingUsers, setTyping,
  }
}
