// src/beyond/useMyBatteryShare.js
//
// MY battery sharing. Mounted through useLiveShare (so ChatPage needs no extra line).
// The reporter runs only while at least one conversation has battery sharing on,
// only where the browser supports it, and only while the app is visible.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'
import { setBatterySharing, startBatteryReporter, supportsBatteryReporting } from './services/batteryStatus'

export function useMyBatteryShare(userId) {
  const [on, setOn] = useState(() => new Set()) // conversation ids where I share my battery
  const [error, setError] = useState(null)
  const supported = supportsBatteryReporting()

  const reload = useCallback(async () => {
    if (!userId) return
    const { data, error: e } = await supabase
      .from('device_status_shares').select('conversation_id').eq('owner_id', userId).eq('share_battery', true)
    if (e) { console.error('[beyond] could not load battery shares:', e); return }
    setOn(new Set((data || []).map((r) => r.conversation_id)))
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined
    reload()
    return subscribeToChannel(
      `beyond-mybattery:${userId}`,
      (channel, emit) => channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_status_shares', filter: `owner_id=eq.${userId}` },
        (p) => emit('change', p),
      ),
      { onEvent: reload, onResync: reload },
    )
  }, [userId, reload])

  const anyOn = on.size > 0
  useEffect(() => {
    if (!userId || !anyOn || !supported) return undefined
    const stop = startBatteryReporter(supabase, userId)
    return () => { if (stop) stop() }
  }, [userId, anyOn, supported])

  const set = useCallback(async (conversationId, value) => {
    setError(null)
    if (value && !supported) { setError('unsupported'); return }
    try {
      await setBatterySharing(supabase, userId, conversationId, value)
      await reload()
    } catch (e) {
      console.error(e)
      setError('failed')
    }
  }, [userId, supported, reload])

  return useMemo(
    () => ({ isOn: (cid) => on.has(cid), set, supported, error }),
    [on, set, supported, error],
  )
}
