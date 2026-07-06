import { useState, useEffect, useCallback } from 'react'
import { supabase, markStatusViewed } from '../lib/supabase'

// Loads every status visible to this user (RLS already restricts that
// to: your own, plus anyone you share a conversation with — direct or
// group), groups them by poster, and tracks which ones you've viewed.
export function useStatuses(userId) {
  const [statusGroups, setStatusGroups] = useState([]) // others, grouped
  const [myStatuses, setMyStatuses] = useState([])
  const [viewedIds, setViewedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return

    const { data: statuses, error } = await supabase
      .from('statuses')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) { console.error('load statuses failed:', error); setLoading(false); return }
    const rows = statuses || []

    // Fetch posting profiles in a second pass rather than relying on
    // a guessed FK hint name (statuses has no confirmed FK alias to
    // profiles yet, unlike messages).
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
      // Unviewed first, then most-recently-posted first
      if (a.allViewed !== b.allViewed) return a.allViewed ? 1 : -1
      return new Date(b.statuses[b.statuses.length - 1].created_at) -
             new Date(a.statuses[a.statuses.length - 1].created_at)
    })

    setStatusGroups(groups)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('statuses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'status_views' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId, load])

  const markViewed = useCallback(async (statusId) => {
    if (!userId || viewedIds.has(statusId)) return
    setViewedIds(prev => new Set(prev).add(statusId))
    try { await markStatusViewed(statusId, userId) } catch (e) { console.error('markStatusViewed failed:', e) }
  }, [userId, viewedIds])

  return { statusGroups, myStatuses, viewedIds, loading, markViewed, reload: load }
}
