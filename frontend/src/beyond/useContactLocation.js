// src/beyond/useContactLocation.js
//
// A contact's live location, READ side. One shared realtime channel through
// lib/realtimeManager (no polling, no second subscription), re-fetch on resync,
// and every render goes through classifyLocation so a stale or stopped share can
// never be drawn as live.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { classifyLocation } from './services/locationFreshness'
import { classifyDbError, withTimeout } from './services/dbProblem'

const TICK_MS = 15 * 1000 // re-evaluate age so "live" turns into "recent" on its own

export function useContactLocation({ conversationId, contactId }) {
  const viewerOnline = useOnlineStatus()
  const [share, setShare] = useState(undefined) // undefined = not loaded yet, null = no share row
  const [fix, setFix] = useState(null)
  const [problem, setProblem] = useState(null) // null | { kind, message }
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    if (!conversationId || !contactId) return
    try {
      const [s, f] = await withTimeout(Promise.all([
        supabase.from('live_location_shares').select('expires_at, stopped_at')
          .eq('owner_id', contactId).eq('conversation_id', conversationId).maybeSingle(),
        // RLS only returns this row while the share is active and unexpired
        supabase.from('live_locations').select('lat, lng, accuracy, speed, heading, recorded_at')
          .eq('user_id', contactId).maybeSingle(),
      ]))
      const err = s.error || f.error
      if (err) { console.error('[beyond] location load failed:', err); setProblem(classifyDbError(err)); return }
      setProblem(null)
      setShare(s.data || null)
      setFix(f.data || null)
    } catch (e) {
      console.error('[beyond] location load failed:', e)
      setProblem(classifyDbError(e))
    }
  }, [conversationId, contactId])

  useEffect(() => {
    if (!conversationId || !contactId) return undefined
    setShare(undefined); setFix(null); setProblem(null)
    load()
    return subscribeToChannel(
      `beyond-loc:${conversationId}:${contactId}`,
      (channel, emit) => channel
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'live_location_shares', filter: `owner_id=eq.${contactId}` },
          (p) => emit('share', p))
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'live_locations', filter: `user_id=eq.${contactId}` },
          (p) => emit('fix', p)),
      {
        onEvent: (type, p) => {
          if (type === 'fix') { setFix(p.eventType === 'DELETE' ? null : p.new); return }
          load() // share changed (start/stop/extend): re-read, so RLS decides what I may see
        },
        onResync: load,
      },
    )
  }, [conversationId, contactId, load])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const loc = useMemo(() => classifyLocation({
    share: share ? { active: true, expiresAt: share.expires_at, stoppedAt: share.stopped_at } : null,
    fix: fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy ?? undefined, speed: fix.speed ?? undefined, heading: fix.heading ?? undefined, recordedAt: fix.recorded_at } : null,
    now,
    viewerOnline,
    loading: share === undefined && !problem,
  }), [share, fix, now, viewerOnline, problem])

  return { loc, problem, loadError: !!problem, reload: load }
}
