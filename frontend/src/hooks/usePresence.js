import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const HEARTBEAT_MS = 20000   // how often we write our own last_seen
const POLL_MS = 15000        // how often we refresh everyone else's last_seen
const ONLINE_THRESHOLD_MS = 45000 // last_seen within this window = "online"

/**
 * Heartbeat-based presence — deliberately NOT using Supabase's Presence
 * API. After extensive testing, Presence's sync/join/leave events were
 * silently withheld by this project's Realtime Authorization layer even
 * though subscribe()/track() both reported success — a server-side
 * config issue we couldn't resolve without deeper Realtime
 * Authorization setup. This is a simpler, more reliable substitute:
 *
 *   - Every HEARTBEAT_MS, write your own `last_seen = now()` to profiles.
 *   - Every POLL_MS, re-fetch last_seen for everyone you might need to
 *     check ("known" ids — accumulated from every isOnline() call).
 *   - Someone is "online" if their last_seen is within
 *     ONLINE_THRESHOLD_MS. No presence channel, no join/leave, no
 *     private-channel auth — just a plain column write/read, which has
 *     been reliable all session where Presence was not.
 *
 * Same external interface as before: usePresence(myUserId) returns an
 * isOnline(userId) function — no changes needed anywhere else in the
 * app that already calls it.
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

    beat() // immediately on mount, don't wait for the first interval
    const interval = setInterval(beat, HEARTBEAT_MS)

    // Also beat when the tab regains focus/visibility — makes "coming
    // back from background" reflect faster than waiting for the next
    // scheduled interval.
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

  // isOnline(userId) — registers the id for future polling (so anyone
  // ChatPage asks about gets picked up automatically) and returns
  // whether their last known heartbeat is recent enough.
  const isOnline = useCallback((userId) => {
    if (!userId) return false
    if (!knownIds.current.has(userId)) {
      knownIds.current.add(userId)
      // Fetch this one immediately rather than waiting for the next
      // scheduled poll, so a newly-viewed conversation doesn't show
      // "offline" for up to POLL_MS before its first real check.
      supabase.from('profiles').select('id, last_seen').eq('id', userId).maybeSingle()
        .then(({ data }) => {
          if (data) setLastSeenMap((prev) => ({ ...prev, [data.id]: data.last_seen }))
        })
    }
    const lastSeen = lastSeenMap[userId]
    if (!lastSeen) return false
    return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS
  }, [lastSeenMap])

  return isOnline
}
