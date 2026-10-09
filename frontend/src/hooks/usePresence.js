import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns'
import { useSetting, useSettingsOwner } from '../lib/appearanceStore'

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
 * Presence settings (from the profile sheet):
 *   - Invisible, or "Show when I'm online" turned off: the heartbeat stops and last_seen is cleared
 *     (set to null), so other people see no online dot and no "last seen" text. Nothing in the
 *     database says you chose Invisible; to everyone else you look like someone who has no activity.
 *   - Busy / Away: written to profiles.presence_status next to last_seen, so others can show it.
 *     (Needs step2b_presence_sql.sql. Until it is run, this falls back to last_seen only.)
 *
 * Returns { isOnline, getLastSeenLabel, getPresenceStatus }:
 *   isOnline(userId)           -> boolean
 *   getLastSeenLabel(userId)   -> "Last seen 2 minutes ago" | "Last seen yesterday" | '' (unknown/online/hidden)
 *   getPresenceStatus(userId)  -> 'online' | 'idle' | 'busy' | 'offline'
 */

// presence_status is a newer column. If it does not exist yet we stop asking for it and carry on.
let hasStatusColumn = true
const mentionsStatusColumn = (error) =>
  !!error && /presence_status/.test(`${error.message || ''} ${error.details || ''}`)

async function selectPresence(filter) {
  const cols = hasStatusColumn ? 'id, last_seen, presence_status' : 'id, last_seen'
  const res = await filter(supabase.from('profiles').select(cols))
  if (res.error && hasStatusColumn && mentionsStatusColumn(res.error)) {
    hasStatusColumn = false
    return selectPresence(filter)
  }
  return res
}

async function writePresence(userId, lastSeen, status) {
  const patch = { last_seen: lastSeen }
  if (hasStatusColumn) patch.presence_status = status
  const res = await supabase.from('profiles').update(patch).eq('id', userId)
  if (res.error && hasStatusColumn && mentionsStatusColumn(res.error)) {
    hasStatusColumn = false
    return writePresence(userId, lastSeen, status)
  }
  return res
}

export function usePresence(myUserId) {
  const [people, setPeople] = useState({}) // { [userId]: { lastSeen, status } }
  const knownIds = useRef(new Set())

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

  // ── Poll: refresh last_seen for every id we've been asked about ──
  const pollKnownIds = useCallback(() => {
    const ids = [...knownIds.current]
    if (ids.length === 0) return
    selectPresence((q) => q.in('id', ids))
      .then(({ data, error }) => {
        if (error) { console.error('[presence] poll failed:', error); return }
        setPeople((prev) => {
          const next = { ...prev }
          ;(data || []).forEach((row) => {
            next[row.id] = { lastSeen: row.last_seen, status: row.presence_status ?? null }
          })
          return next
        })
      })
  }, [])

  useEffect(() => {
    if (!myUserId) return undefined
    const interval = setInterval(pollKnownIds, POLL_MS)
    return () => clearInterval(interval)
  }, [myUserId, pollKnownIds])

  const registerAndFetch = useCallback((userId) => {
    if (!userId || knownIds.current.has(userId)) return
    knownIds.current.add(userId)
    selectPresence((q) => q.eq('id', userId).maybeSingle())
      .then(({ data }) => {
        if (data) {
          setPeople((prev) => ({ ...prev, [data.id]: { lastSeen: data.last_seen, status: data.presence_status ?? null } }))
        }
      })
  }, [])

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
