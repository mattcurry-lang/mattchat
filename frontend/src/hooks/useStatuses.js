import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, markStatusViewed } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

// FIX: this channel listens to ALL changes on `statuses` and
// `status_views`, unfiltered — RLS already restricts what a client can
// SELECT, but it does NOT stop the postgres_changes trigger from
// firing for every row in the table, so every connected client was
// reloading its full status list on every OTHER user's status post or
// view, anywhere on the platform.
//
// TODO: `statuses` has no recipient-list column to filter by (who can
// see a given status depends on shared-conversation membership, which
// isn't expressible as a single-column postgres_changes filter). The
// real fix is either (a) a materialized "visible_to" column maintained
// by trigger, or (b) enabling Supabase's RLS-authorized Realtime for
// this table so the server itself only broadcasts rows the client is
// allowed to see. Neither is a client-side fix — flagging rather than
// guessing at a schema change.
//
// What IS fixed here: the channel is now deduped through the shared
// manager (previously fine, one channel already), and reloads are
// debounced so a burst of status activity doesn't trigger a reload per
// event — one reload per quiet window instead.
const RELOAD_DEBOUNCE_MS = 400

export function useStatuses(userId) {
  const [statusGroups, setStatusGroups] = useState([])
  const [myStatuses, setMyStatuses] = useState([])
  const [viewedIds, setViewedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const debounceTimer = useRef(null)

  const load = useCallback(async () => {
    if (!userId) return
    const { data: statuses, error } = await supabase
      .from('statuses')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) { console.error('load statuses failed:', error); setLoading(false); return }
    const rows = statuses || []

    const userIds = [...new Set(rows.map(s => s.user_id))]
    let profilesById = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds)
      profilesById = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    }

    const { data: views } = await supabase
      .from('status_views')
      .select('status_id')
      .eq('viewer_id', userId)
    const myViewed = new Set((views || []).map(v => v.status_id))
    setViewedIds(myViewed)
    setMyStatuses(rows.filter(s => s.user_id === userId))

    const othersMap = new Map()
    rows.filter(s => s.user_id !== userId).forEach(s => {
      if (!othersMap.has(s.user_id)) othersMap.set(s.user_id, [])
      othersMap.get(s.user_id).push(s)
    })
    const groups = [...othersMap.entries()].map(([uid, list]) => ({
      userId: uid,
      profile: profilesById[uid] || { username: 'Unknown' },
      statuses: list,
      allViewed: list.every(s => myViewed.has(s.id)),
    })).sort((a, b) => {
      if (a.allViewed !== b.allViewed) return a.allViewed ? 1 : -1
      return new Date(b.statuses[b.statuses.length - 1].created_at) -
             new Date(a.statuses[a.statuses.length - 1].created_at)
    })
    setStatusGroups(groups)
    setLoading(false)
  }, [userId])

  const debouncedLoad = useCallback(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(load, RELOAD_DEBOUNCE_MS)
  }, [load])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!userId) return
    const unsubscribe = subscribeToChannel(
      'statuses:all', // TODO(see above) — genuinely global until RLS-authorized realtime or a visibility column exists
      (channel, emit) => channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, (p) => emit('change', p))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'status_views' }, (p) => emit('change', p)),
      { onEvent: debouncedLoad, onResync: load }
    )
    return () => { clearTimeout(debounceTimer.current); unsubscribe() }
  }, [userId, debouncedLoad, load])

  const markViewed = useCallback(async (statusId) => {
    if (!userId || viewedIds.has(statusId)) return
    setViewedIds(prev => new Set(prev).add(statusId))
    try { await markStatusViewed(statusId, userId) } catch (e) { console.error('markStatusViewed failed:', e) }
  }, [userId, viewedIds])

  return { statusGroups, myStatuses, viewedIds, loading, markViewed, reload: load }
}
