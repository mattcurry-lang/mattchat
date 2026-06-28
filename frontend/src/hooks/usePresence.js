import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Broadcasts YOUR presence and lets you check if any user ID is online.
 * @param {string} myUserId - the logged-in user's ID
 * @returns {(userId: string) => boolean} isOnline
 */
export function usePresence(myUserId) {
  const [onlineIds, setOnlineIds] = useState(new Set())

  useEffect(() => {
    if (!myUserId) return

    const channel = supabase.channel('online-users', {
      config: { presence: { key: myUserId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineIds(new Set(Object.keys(state)))
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineIds(prev => new Set([...prev, key]))
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineIds(prev => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [myUserId])

  return (userId) => onlineIds.has(userId)
}
