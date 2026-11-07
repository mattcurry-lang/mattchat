// src/beyond/useLiveShare.js
//
// MY live shares. Mount ONCE (ChatPage does). It owns the single GPS publisher:
// it starts when I have at least one active share and stops when the last one
// ends, whether I pressed stop, the timer ran out, or permission was revoked.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'
import {
  fetchMyActiveShares, startLiveShare, stopLiveShare, getPositionOnce, createLocationPublisher,
} from './services/liveLocation'

export function useLiveShare(userId) {
  const [shares, setShares] = useState([]) // [{ conversation_id, expires_at }]
  const [error, setError] = useState(null) // null | 'denied' | 'unsupported' | 'failed'
  const publisher = useRef(null)
  const hadShares = useRef(false)

  const reload = useCallback(async () => {
    if (!userId) return
    try { setShares(await fetchMyActiveShares(userId)) }
    catch (e) { console.error('[beyond] could not load my shares:', e) }
  }, [userId])

  // load + stay in sync (other tabs/devices can stop a share too)
  useEffect(() => {
    if (!userId) return undefined
    reload()
    return subscribeToChannel(
      `beyond-myshares:${userId}`,
      (channel, emit) => channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_location_shares', filter: `owner_id=eq.${userId}` },
        (payload) => emit('change', payload),
      ),
      { onEvent: reload, onResync: reload },
    )
  }, [userId, reload])

  // a share ends by itself: re-check just after the earliest expiry
  useEffect(() => {
    if (!shares.length) return undefined
    const next = Math.min(...shares.map((s) => Date.parse(s.expires_at)))
    const id = setTimeout(reload, Math.max(0, next - Date.now()) + 500)
    return () => clearTimeout(id)
  }, [shares, reload])

  // the one publisher
  useEffect(() => {
    if (!userId) return undefined
    const pub = createLocationPublisher({
      userId,
      onError: async (code) => {
        // permission revoked mid-share: end every share so nobody sees a frozen "live" dot
        setError(code)
        try {
          const mine = await fetchMyActiveShares(userId)
          await Promise.all(mine.map((s) => stopLiveShare(s.conversation_id)))
        } catch (e) { console.error(e) }
        reload()
      },
    })
    publisher.current = pub
    return () => { pub.stop(); publisher.current = null }
  }, [userId, reload])

  useEffect(() => {
    const pub = publisher.current
    if (!pub) return
    if (shares.length) pub.start(); else pub.stop()
    // timer ran out (not a manual stop): the position row should not linger
    if (hadShares.current && shares.length === 0 && userId) {
      supabase.from('live_locations').delete().eq('user_id', userId).then(() => {})
    }
    hadShares.current = shares.length > 0
  }, [shares, userId])

  const start = useCallback(async (conversationId, minutes) => {
    setError(null)
    try { await getPositionOnce() } catch (e) { setError(e.code || 'failed'); throw e }
    try { await startLiveShare(conversationId, minutes) } catch (e) { setError('failed'); throw e }
    await reload()
  }, [reload])

  const stop = useCallback(async (conversationId) => {
    try { await stopLiveShare(conversationId) } catch (e) { setError('failed'); throw e }
    await reload()
  }, [reload])

  const activeFor = useCallback(
    (conversationId) => (conversationId ? shares.find((s) => s.conversation_id === conversationId) || null : null),
    [shares],
  )

  return useMemo(
    () => ({ shares, activeFor, start, stop, error, clearError: () => setError(null) }),
    [shares, activeFor, start, stop, error],
  )
}
