import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const OFFLINE_GRACE_MS = 5000   // wait this long before marking someone
                                 // offline, so a brief network blip doesn't
                                 // flicker the dot on and off
const HEARTBEAT_MS = 25000      // re-announce presence periodically so a
                                 // single dropped track() doesn't silently
                                 // leave us out of the online set

export function usePresence(myUserId) {
  const [onlineIds, setOnlineIds] = useState(new Set())
  const offlineTimers = useRef({})

  useEffect(() => {
    if (!myUserId) return
    let channel, heartbeat, retryTimeout
    let stopped = false

    const clearOfflineTimer = (id) => {
      if (offlineTimers.current[id]) {
        clearTimeout(offlineTimers.current[id])
        delete offlineTimers.current[id]
      }
    }

    const scheduleOffline = (id) => {
      if (offlineTimers.current[id]) return
      offlineTimers.current[id] = setTimeout(() => {
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
        config: { presence: { key: myUserId } },
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          const nowOnline = new Set(Object.keys(channel.presenceState()))
          nowOnline.forEach(clearOfflineTimer)
          setOnlineIds(prev => new Set([...prev, ...nowOnline]))
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          clearOfflineTimer(key)
          setOnlineIds(prev => new Set([...prev, key]))
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          scheduleOffline(key) // grace window instead of instant flip
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ online_at: new Date().toISOString() })
            heartbeat = setInterval(() => {
              channel.track({ online_at: new Date().toISOString() })
            }, HEARTBEAT_MS)
          }
          if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) && !stopped) {
            clearInterval(heartbeat)
            supabase.removeChannel(channel)
            retryTimeout = setTimeout(connect, 2000) // auto-reconnect
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
