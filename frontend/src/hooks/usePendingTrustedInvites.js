import { useState, useEffect, useCallback } from 'react'
import { countPendingTrustedInvites } from '../lib/cycleTrust'

// Polls rather than subscribing to realtime — invites are rare/low-
// frequency events, so a lightweight interval is enough and avoids
// adding another realtime channel for something this infrequent.
export function usePendingTrustedInvites(userId, intervalMs = 60000) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      setCount(await countPendingTrustedInvites(userId))
    } catch (e) {
      console.error('countPendingTrustedInvites failed:', e)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [userId, intervalMs, refresh])

  return { count, refresh }
}
