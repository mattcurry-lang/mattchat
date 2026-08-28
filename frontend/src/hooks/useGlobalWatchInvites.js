// hooks/useGlobalWatchInvites.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

const PENDING_EXPIRY_MS = 5 * 60 * 1000 // matches useWatchTogether's own expiry

/**
 * Surfaces the most recent PENDING Watch Together invite where someone
 * else invited YOU, across any of your conversations — not just
 * whichever one is currently open. useWatchTogether can't do this on
 * its own because it's parameterized by a single conversationId at a
 * time (whatever's active). This hook is conversation-agnostic: it
 * loads once, then listens for inserts/updates on the whole
 * watch_together_sessions table and filters client-side against the
 * list of conversation ids the caller passes in (RLS still governs
 * which rows actually reach the client at all).
 */
export function useGlobalWatchInvites(userId, conversationIds) {
  const [invite, setInvite] = useState(null)
  const dismissedIdsRef = useRef(new Set())
  const conversationIdsRef = useRef(conversationIds)
  conversationIdsRef.current = conversationIds

  const applyRow = useCallback((row) => {
    if (!row || row.status !== 'pending') { setInvite((prev) => (prev && row && prev.id === row.id ? null : prev)); return }
    if (row.started_by === userId) return // don't notify yourself about your own invite
    if (dismissedIdsRef.current.has(row.id)) return
    if (!conversationIdsRef.current.includes(row.conversation_id)) return
    const ageMs = Date.now() - new Date(row.created_at).getTime()
    if (ageMs > PENDING_EXPIRY_MS) return

    setInvite({
      id: row.id,
      conversationId: row.conversation_id,
      videoId: row.video_id,
      videoTitle: row.video_title,
      videoThumbnailUrl: row.video_thumbnail_url,
      startedBy: row.started_by,
    })
  }, [userId])

  const loadPending = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('watch_together_sessions')
      .select('id, conversation_id, video_id, video_title, video_thumbnail_url, started_by, created_at, status')
      .eq('status', 'pending')
      .neq('started_by', userId)
      .order('created_at', { ascending: false })
      .limit(5) // grab a few in case the newest doesn't belong to a convo we're in
    if (error) { console.error('[globalWatchInvites] loadPending failed:', error); return }
    const match = (data || []).find((row) => conversationIdsRef.current.includes(row.conversation_id) && !dismissedIdsRef.current.has(row.id))
    applyRow(match || null)
  }, [userId, applyRow])

  useEffect(() => { loadPending() }, [loadPending])

  useEffect(() => {
    if (!userId) return
    const unsubscribe = subscribeToChannel(
      `watch-invites:${userId}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'watch_together_sessions',
      }, (payload) => emit('change', payload)),
      {
        onEvent: (type, payload) => {
          const row = payload.new
          if (row?.status === 'pending') applyRow(row)
          else if (row) setInvite((prev) => (prev && prev.id === row.id ? null : prev))
        },
        onResync: loadPending,
      }
    )
    return unsubscribe
  }, [userId, applyRow, loadPending])

  const dismiss = useCallback(() => {
    setInvite((prev) => {
      if (prev) dismissedIdsRef.current.add(prev.id)
      return null
    })
  }, [])

  return { invite, dismiss }
}
