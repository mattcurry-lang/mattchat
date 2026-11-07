// src/beyond/useContactBattery.js
//
// A contact's battery, READ side. Whether I may see it is decided by the database
// (device_status_shares + RLS). This hook only classifies what comes back, so a
// stale reading is never presented as current.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'
import { classifyBattery } from './services/batteryStatus'
import { classifyDbError, withTimeout } from './services/dbProblem'

const TICK_MS = 15 * 1000

export function useContactBattery({ conversationId, contactId }) {
  const [share, setShare] = useState(undefined) // undefined = loading
  const [row, setRow] = useState(null)
  const [problem, setProblem] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    if (!conversationId || !contactId) return
    try {
      const [s, r] = await withTimeout(Promise.all([
        supabase.from('device_status_shares').select('share_battery')
          .eq('owner_id', contactId).eq('conversation_id', conversationId).maybeSingle(),
        supabase.from('device_status').select('battery_level, charging, reported_at')
          .eq('user_id', contactId).maybeSingle(),
      ]))
      const err = s.error || r.error
      if (err) { console.error('[beyond] battery load failed:', err); setProblem(classifyDbError(err)); return }
      setProblem(null)
      setShare(s.data || null)
      setRow(r.data || null)
    } catch (e) {
      console.error('[beyond] battery load failed:', e)
      setProblem(classifyDbError(e))
    }
  }, [conversationId, contactId])

  useEffect(() => {
    if (!conversationId || !contactId) return undefined
    setShare(undefined); setRow(null); setProblem(null)
    load()
    return subscribeToChannel(
      `beyond-battery:${conversationId}:${contactId}`,
      (channel, emit) => channel
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'device_status_shares', filter: `owner_id=eq.${contactId}` },
          (p) => emit('share', p))
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'device_status', filter: `user_id=eq.${contactId}` },
          (p) => emit('row', p)),
      {
        onEvent: (type, p) => {
          if (type === 'row') { setRow(p.eventType === 'DELETE' ? null : p.new); return }
          load() // consent changed: re-read so the database decides what I may see
        },
        onResync: load,
      },
    )
  }, [conversationId, contactId, load])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  return useMemo(
    () => ({ ...classifyBattery({ share, row, now, loading: share === undefined && !problem }), problem }),
    [share, row, now, problem],
  )
}
