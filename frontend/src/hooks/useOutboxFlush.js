import { useEffect } from 'react'
import { sendMessage as sendMsg } from '../lib/supabase'
import { flushOutbox } from '../lib/offlineStore'

export function useOutboxFlush(userId) {
  useEffect(() => {
    if (!userId) return
    const run = () => flushOutbox(sendMsg)
    run()
    window.addEventListener('online', run)
    return () => window.removeEventListener('online', run)
  }, [userId])
}
