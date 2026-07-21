import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns'

const HEARTBEAT_MS = 20000   // how often we write our own last_seen
const POLL_MS = 15000        // how often we refresh everyone else's last_seen
const ONLINE_THRESHOLD_MS = 45000 // last_seen within this window = "online"

/**
 * Heartbeat-based presence — deliberately NOT using Supabase's Presence
 * API. After extensive testing, Presence's sync/join/leave events were
 * silently withheld by this project's Realtime Authorization layer even
 * though subscribe()/track() both reported success. This is a simpler,
 * more reliable substitute:
 *
 *   - Every HEARTBEAT_MS, write your own `last_seen = now()` to profiles.
 *   - Every POLL_MS, re-fetch last_seen for everyone you might need to
 *     check ("known" ids — accumulated from every isOnline()/lastSeen
 *     call).
 *   - Someone is "online" if their last_seen is within
 *     ONLINE_THRESHOLD_MS.
 *
 * Returns { isOnline, getLastSeenLabel }:
 *   isOnline(userId)        -> boolean
 *   getLastSeenLabel(userId) -> "Last seen 2 minutes ago" | "Last seen yesterday" | '' (unknown/online)
 */
export function usePresence(myUserId) {
  const [lastSeenMap, setLastSeenMap] = useState({}) // { [userId]: isoString }
  const knownIds = useRef(new Set())

  // ── Heartbeat: write our own last_seen ──
  useEffect(() => {
    if (!myUserId) return

    const beat = () => {
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', myUserId)
        .then(({ error }) => { if (error) console.error('[presence] heartbeat write failed:', error) })
    }

    beat()
    const interval = setInterval(beat, HEARTBEAT_MS)

    const onVisible = () => { if (document.visibilityState === 'visible') beat() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [myUserId])

  // ── Poll: refresh last_seen for every id we've been asked about ──
  const pollKnownIds = useCallback(() => {
    const ids = [...knownIds.current]
    if (ids.length === 0) return
    supabase.from('profiles').select('id, last_seen').in('id', ids)
      .then(({ data, error }) => {
        if (error) { console.error('[presence] poll failed:', error); return }
        setLastSeenMap((prev) => {
          const next = { ...prev }
          ;(data || []).forEach((row) => { next[row.id] = row.last_seen })
          return next
        })
      })
  }, [])

  useEffect(() => {
    if (!myUserId) return
    const interval = setInterval(pollKnownIds, POLL_MS)
    return () => clearInterval(interval)
  }, [myUserId, pollKnownIds])

  const registerAndFetch = useCallback((userId) => {
    if (!userId || knownIds.current.has(userId)) return
    knownIds.current.add(userId)
    supabase.from('profiles').select('id, last_seen').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        if (data) setLastSeenMap((prev) => ({ ...prev, [data.id]: data.last_seen }))
      })
  }, [])

  const isOnline = useCallback((userId) => {
    if (!userId) return false
    registerAndFetch(userId)
    const lastSeen = lastSeenMap[userId]
    if (!lastSeen) return false
    return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS
  }, [lastSeenMap, registerAndFetch])

  // "Last seen 2 minutes ago" / "Last seen yesterday" / "Last seen Jul 3"
  // Never called for someone currently online — ChatPage checks
  // isOnline() first and only falls back to this label if they're not.
  const getLastSeenLabel = useCallback((userId) => {
    if (!userId) return ''
    registerAndFetch(userId)
    const lastSeen = lastSeenMap[userId]
    if (!lastSeen) return ''
    const d = new Date(lastSeen)
    if (isToday(d)) return `Last seen ${formatDistanceToNow(d, { addSuffix: true })}`
    if (isYesterday(d)) return 'Last seen yesterday'
    return `Last seen ${format(d, 'MMM d')}`
  }, [lastSeenMap, registerAndFetch])

  return { isOnline, getLastSeenLabel }
}
