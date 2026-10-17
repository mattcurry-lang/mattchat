import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns'
import { useSetting, useSettingsOwner } from '../lib/appearanceStore'

const HEARTBEAT_MS = 20000        // how often we write our own last_seen
const POLL_MS = 15000             // how often we refresh everyone else's presence
const ONLINE_THRESHOLD_MS = 45000 // last_seen within this window = "online"
const BATCH_MS = 60               // collect ids asked about during a render into one request

/**
 * Heartbeat-based presence, enforced in the database (step4_privacy_sql).
 *
 *   - Writes go to user_presence (own row only).
 *   - Reads go through the get_presence() RPC, which applies the OWNER's rules
 *     (invisible, show-online off, last-seen audience). People who are hidden from you
 *     simply aren't returned, so they look offline with no "last seen".
 *
 * Returns { isOnline, getLastSeenLabel, getPresenceStatus }:
 *   isOnline(userId)           -> boolean
 *   getLastSeenLabel(userId)   -> "Last seen 2 minutes ago" | "Last seen yesterday" | ''
 *   getPresenceStatus(userId)  -> 'online' | 'idle' | 'busy' | 'offline'
 */

function writePresence(userId, lastSeen, status) {
  return supabase.from('user_presence').upsert(
    {
      user_id: userId,
      last_seen: lastSeen,
      status: status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
}

export function usePresence(myUserId) {
  const [people, setPeople] = useState({}) // { [id]: { lastSeen, status } }
  const knownIds = useRef(new Set())
  const pendingIds = useRef(new Set())
  const batchTimer = useRef(null)

  // What I chose in the profile sheet.
  const presence = useSetting('presence')
  const showOnline = useSetting('showOnline')
  const settingsOwner = useSettingsOwner()
  // Don't announce anything until my own saved choice has loaded.
  const settingsReady = !!myUserId && settingsOwner === myUserId
  const hidden = presence === 'invisible' || showOnline === false
  const publicStatus = !hidden && (presence === 'idle' || presence === 'busy') ? presence : null

  // ── Heartbeat: write our own last_seen (or clear it when hidden) ──
  useEffect(() => {
    if (!myUserId || !settingsReady) return undefined

    const report = (res) => { if (res && res.error) console.error('[presence] write failed:', res.error) }

    if (hidden) {
      const hide = () => writePresence(myUserId, null, null).then(report)
      hide()
      // a heartbeat already in flight can land after the first clear; clear once more
      const again = setTimeout(hide, 1500)
      return () => clearTimeout(again)
    }

    const beat = () => writePresence(myUserId, new Date().toISOString(), publicStatus).then(report)

    beat()
    const interval = setInterval(beat, HEARTBEAT_MS)

    const onVisible = () => { if (document.visibilityState === 'visible') beat() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [myUserId, settingsReady, hidden, publicStatus])

  // ── Read: ask the database what I'm allowed to see for these ids ──
  const fetchPresence = useCallback(async (ids) => {
    if (!ids || ids.length === 0) return
    const { data, error } = await supabase.rpc('get_presence', { p_ids: ids })
    if (error) { console.error('[presence] read failed:', error); return }
    const byId = new Map((data || []).map((row) => [row.user_id, row]))
    setPeople((prev) => {
      const next = { ...prev }
      ids.forEach((id) => {
        const row = byId.get(id)
        if (row) next[id] = { lastSeen: row.last_seen, status: row.status ?? null }
        else delete next[id] // hidden from me (or never seen): show nothing
      })
      return next
    })
  }, [])

  const pollKnownIds = useCallback(() => {
    fetchPresence([...knownIds.current])
  }, [fetchPresence])

  useEffect(() => {
    if (!myUserId) return undefined
    const interval = setInterval(pollKnownIds, POLL_MS)
    return () => clearInterval(interval)
  }, [myUserId, pollKnownIds])

  useEffect(() => () => { if (batchTimer.current) clearTimeout(batchTimer.current) }, [])

  const registerAndFetch = useCallback((id) => {
    if (!id || knownIds.current.has(id)) return
    knownIds.current.add(id)
    pendingIds.current.add(id)
    if (batchTimer.current) return
    batchTimer.current = setTimeout(() => {
      batchTimer.current = null
      const ids = [...pendingIds.current]
      pendingIds.current.clear()
      fetchPresence(ids)
    }, BATCH_MS)
  }, [fetchPresence])

  const isOnline = useCallback((id) => {
    if (!id) return false
    registerAndFetch(id)
    const lastSeen = people[id]?.lastSeen
    if (!lastSeen) return false
    return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS
  }, [people, registerAndFetch])

  // "online" | "idle" | "busy" | "offline"
  const getPresenceStatus = useCallback((id) => {
    if (!isOnline(id)) return 'offline'
    return people[id]?.status || 'online'
  }, [isOnline, people])

  // "Last seen 2 minutes ago" / "Last seen yesterday" / "Last seen Jul 3"
  const getLastSeenLabel = useCallback((id) => {
    if (!id) return ''
    registerAndFetch(id)
    const lastSeen = people[id]?.lastSeen
    if (!lastSeen) return ''
    const d = new Date(lastSeen)
    if (isToday(d)) return `Last seen ${formatDistanceToNow(d, { addSuffix: true })}`
    if (isYesterday(d)) return 'Last seen yesterday'
    return `Last seen ${format(d, 'MMM d')}`
  }, [people, registerAndFetch])

  return { isOnline, getLastSeenLabel, getPresenceStatus }
}
