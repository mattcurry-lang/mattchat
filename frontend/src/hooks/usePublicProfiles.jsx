import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

/*
 * usePublicProfiles(userIds)
 *
 * Loads the public profile extras (status, note, bio, theme) for a set of people and keeps them
 * live. Expired statuses and notes disappear on their own at the moment they expire.
 *
 *   const extras = usePublicProfiles([userId, ...otherIds])
 *   const x = extras.get(someUserId)
 *   // x = { bio, theme, statusEmoji, statusText, note, noteExpiresAt } or null if not loaded yet
 *
 * Needs step2_public_profile_sql.sql (adds profiles to the realtime publication).
 */

const COLUMNS = 'id, bio, theme, status_emoji, status_text, status_expires_at, note_text, note_expires_at'
const CHUNK = 100               // realtime "in" filters accept up to 100 values
const MAX_TIMER = 2 ** 31 - 1   // setTimeout limit

const isLive = (iso) => !iso || new Date(iso).getTime() > Date.now()

function toView(row) {
  if (!row) return null
  const statusLive = !!(row.status_emoji || row.status_text) && isLive(row.status_expires_at)
  const noteLive = !!row.note_text && isLive(row.note_expires_at)
  return {
    bio: row.bio || '',
    theme: row.theme || 'violet',
    statusEmoji: statusLive ? row.status_emoji || '' : '',
    statusText: statusLive ? row.status_text || '' : '',
    note: noteLive ? row.note_text : '',
    noteExpiresAt: noteLive ? row.note_expires_at : null,
  }
}

export default function usePublicProfiles(userIds) {
  const [rows, setRows] = useState({})
  const [tick, setTick] = useState(0)

  // a stable string, so passing a fresh array every render does not refetch
  const key = useMemo(
    () => [...new Set((userIds || []).filter(Boolean))].sort().join(','),
    [userIds],
  )

  // load + subscribe
  useEffect(() => {
    const ids = key ? key.split(',') : []
    if (ids.length === 0) return undefined

    const chunks = []
    for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK))

    let cancelled = false

    chunks.forEach(async (chunk) => {
      const { data, error } = await supabase.from('profiles').select(COLUMNS).in('id', chunk)
      if (cancelled) return
      if (error) { console.error('usePublicProfiles load:', error); return }
      setRows((prev) => {
        const next = { ...prev }
        for (const r of data || []) next[r.id] = r
        return next
      })
    })

    const suffix = Math.random().toString(36).slice(2, 8)
    const channels = chunks.map((chunk, i) =>
      supabase
        .channel(`public-profiles:${i}:${suffix}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=in.(${chunk.join(',')})` },
          (payload) => {
            const row = payload.new
            if (!row?.id) return
            setRows((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] || {}), ...row } }))
          },
        )
        .subscribe(),
    )

    return () => {
      cancelled = true
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  }, [key])

  // wake up exactly when the next status or note expires
  useEffect(() => {
    const now = Date.now()
    let next = Infinity
    for (const r of Object.values(rows)) {
      for (const iso of [r.status_expires_at, r.note_expires_at]) {
        const t = iso ? new Date(iso).getTime() : 0
        if (t > now && t < next) next = t
      }
    }
    if (!Number.isFinite(next)) return undefined
    const id = setTimeout(() => setTick((n) => n + 1), Math.min(next - now + 250, MAX_TIMER))
    return () => clearTimeout(id)
  }, [rows, tick])

  const get = useCallback((id) => (id ? toView(rows[id]) : null), [rows, tick])  

  return useMemo(() => ({ get }), [get])
}
