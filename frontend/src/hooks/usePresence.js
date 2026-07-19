import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const OFFLINE_GRACE_MS = 5000
const HEARTBEAT_MS = 25000

export function usePresence(myUserId) {
  const [onlineIds, setOnlineIds] = useState(new Set())
  const offlineTimers = useRef({})

  // Lets you check the live state from the console at any time:
  //   [...window.__presenceOnline]
  useEffect(() => {
    window.__presenceOnline = onlineIds
  }, [onlineIds])


  useEffect(() => {
    if (!myUserId) return
    let channel, heartbeat, retryTimeout
    let stopped = false

    console.log('[presence] mounting for user', myUserId)

    const clearOfflineTimer = (id) => {
      if (offlineTimers.current[id]) {
        clearTimeout(offlineTimers.current[id])
        delete offlineTimers.current[id]
      }
    }

    const scheduleOffline = (id) => {
      if (offlineTimers.current[id]) return
      offlineTimers.current[id] = setTimeout(() => {
        console.log('[presence] marking OFFLINE after grace period:', id)
        setOnlineIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        delete offlineTimers.current[id]
      }, OFFLINE_GRACE_MS)
    }

    const connect = () => {
 channel = supabase.channel('online-users', {
  config: { presence: { key: myUserId }, private: true },
})
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          const nowOnline = new Set(Object.keys(state))
          console.log('[presence] SYNC event. Raw state:', state, '-> online keys:', [...nowOnline])
          nowOnline.forEach(clearOfflineTimer)
          setOnlineIds(prev => new Set([...prev, ...nowOnline]))
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('[presence] JOIN event, key:', key, newPresences)
          clearOfflineTimer(key)
          setOnlineIds(prev => new Set([...prev, key]))
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          console.log('[presence] LEAVE event, key:', key)
          scheduleOffline(key)
        })
        .subscribe(async (status, err) => {
          console.log('[presence] subscribe status:', status, err || '')
          if (status === 'SUBSCRIBED') {
            const trackResult = await channel.track({ online_at: new Date().toISOString() })
            console.log('[presence] track() result:', trackResult, 'for key', myUserId)
            heartbeat = setInterval(() => {
              channel.track({ online_at: new Date().toISOString() })
            }, HEARTBEAT_MS)
          }
          if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) && !stopped) {
            console.log('[presence] connection problem, status:', status, '- reconnecting in 2s')
            clearInterval(heartbeat)
            supabase.removeChannel(channel)
            retryTimeout = setTimeout(connect, 2000)
          }
        })
    }

    connect()

    return () => {
      stopped = true
      clearInterval(heartbeat)
      clearTimeout(retryTimeout)
      Object.values(offlineTimers.current).forEach(clearTimeout)
      offlineTimers.current = {}
      if (channel) { channel.untrack(); supabase.removeChannel(channel) }
    }
  }, [myUserId])

  return (userId) => onlineIds.has(userId)
}
