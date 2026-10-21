import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns'
import { useSetting, useSettingsOwner } from '../lib/appearanceStore'

const HEARTBEAT_MS = 20000   // how often we write our own last_seen
const POLL_MS = 15000        // how often we refresh everyone else's presence
const ONLINE_THRESHOLD_MS = 45000 // last_seen within this window = "online"
const BATCH_MS = 40          // ids asked about in the same moment are fetched in one request

/**
 * Heartbeat-based presence — deliberately NOT using Supabase's Presence
 * API (its sync/join/leave events were withheld by this project's Realtime
 * Authorization layer). Simple and reliable instead:
 *
 *   - Every HEARTBEAT_MS, write your own last_seen to user_presence.
 *   - Every POLL_MS, ask get_presence() about everyone you have been asked about.
 *   - Someone is "online" if their last_seen is within ONLINE_THRESHOLD_MS.
 *
 * Privacy is enforced by the DATABASE (step4_privacy.sql), not here:
 *   user_presence can only be read by its owner, and get_presence() returns a person's last seen only when
 *   their settings allow it for you (Last seen: Everyone / My contacts / Nobody, "Show when I'm online",
 *   Invisible). Anyone it won't tell you about simply comes back empty.
 *
 * This hook also honours MY settings: Invisible, or "Show when I'm online" off, stops the heartbeat and
 * clears my last_seen. Busy / Away are written next to it so others can show them.
 *
 * Returns { isOnline, getLastSeenLabel, getPresenceStatus }:
 *   isOnline(userId)           -> boolean
 *   getLastSeenLabel(userId)   -> "Last seen 2 minutes ago" | "Last seen yesterday" | '' (unknown/online/hidden)
 *   getPresenceStatus(userId)  -> 'online' | 'idle' | 'busy' | 'offline'
 */

async function writePresence(userId, lastSeen, status) {
  return supabase.from('user_presence').upsert(
    { user_id: userId, last_seen: lastSeen, status, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
}

const EMPTY = { lastSeen: null, status: null }

export function usePresence(myUserId) {
  const [people, setPeople] = useState({}) // { [userId]: { lastSeen, status } }
  const knownIds = useRef(new Set())
  const pendingIds = useRef(new Set())
  const batchTimer = useRef(null)

  // What I chose in the profile sheet.
  const presence = useSetting('presence')
  const showOnline = useSetting('showOnline')
  const settingsOwner = useSettingsOwner()
  // Do not announce anything until my own saved choice has loaded. Otherwise someone who set
  // Invisible on another device would flash as "online" for a few seconds at every app start.
  const settingsReady = !!myUserId && settingsOwner === myUserId
  const hidden = presence === 'invisible' || showOnline === false
  const publicStatus = !hidden && (presence === 'idle' || presence === 'busy') ? presence : null

  // ── Heartbeat: write our own last_seen (or go quiet when hidden) ──
  useEffect(() => {
    if (!myUserId || !settingsReady) return undefined

    const report = (res) => { if (res.error) console.error('[presence] write failed:', res.error) }

    if (hidden) {
      const hide = () => writePresence(myUserId, null, null).then(report)
      hide()
      // a heartbeat that was already in flight can land after the first clear; clear once more
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

  // ── Ask the database about a set of people ──
  // People it does not return are hidden from me (or have no activity): clear anything shown before.
  const fetchPresence = useCallback((ids) => {
    if (ids.length === 0) return
    supabase.rpc('get_presence', { p_ids: ids }).then(({ data, error }) => {
      if (error) { console.error('[presence] get_presence failed:', error); return }
      const byId = {}
      ;(data || []).forEach((row) => { byId[row.user_id] = { lastSeen: row.last_seen, status: row.status ?? null } })
      setPeople((prev) => {
        const next = { ...prev }
        ids.forEach((id) => { next[id] = byId[id] || EMPTY })
        return next
      })
    })
  }, [])

  const pollKnownIds = useCallback(() => fetchPresence([...knownIds.current]), [fetchPresence])

  useEffect(() => {
    if (!myUserId) return undefined
    const interval = setInterval(pollKnownIds, POLL_MS)
    return () => clearInterval(interval)
  }, [myUserId, pollKnownIds])

  // Many rows ask about different people in the same render: batch them into one request.
  const registerAndFetch = useCallback((userId) => {
    if (!userId || knownIds.current.has(userId)) return
    knownIds.current.add(userId)
    pendingIds.current.add(userId)
    if (batchTimer.current) return
    batchTimer.current = setTimeout(() => {
      batchTimer.current = null
      const ids = [...pendingIds.current]
      pendingIds.current = new Set()
      fetchPresence(ids)
    }, BATCH_MS)
  }, [fetchPresence])

  useEffect(() => () => { if (batchTimer.current) clearTimeout(batchTimer.current) }, [])

  const isOnline = useCallback((userId) => {
    if (!userId) return false
    registerAndFetch(userId)
    const lastSeen = people[userId]?.lastSeen
    if (!lastSeen) return false
    return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS
  }, [people, registerAndFetch])

  // "online" | "idle" | "busy" | "offline"
  const getPresenceStatus = useCallback((userId) => {
    if (!isOnline(userId)) return 'offline'
    return people[userId]?.status || 'online'
  }, [isOnline, people])

  // "Last seen 2 minutes ago" / "Last seen yesterday" / "Last seen Jul 3"
  // Never called for someone currently online — ChatPage checks
  // isOnline() first and only falls back to this label if they're not.
  const getLastSeenLabel = useCallback((userId) => {
    if (!userId) return ''
    registerAndFetch(userId)
    const lastSeen = people[userId]?.lastSeen
    if (!lastSeen) return ''
    const d = new Date(lastSeen)
    if (isToday(d)) return `Last seen ${formatDistanceToNow(d, { addSuffix: true })}`
    if (isYesterday(d)) return 'Last seen yesterday'
    return `Last seen ${format(d, 'MMM d')}`
  }, [people, registerAndFetch])

  return { isOnline, getLastSeenLabel, getPresenceStatus }
}
