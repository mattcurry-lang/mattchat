// src/hooks/useFlowRunner.js
// Mount once (in ChatPage). Listens for ecosystem events and runs the
// user's automations; also catches up when the app returns to the screen
// or the connection comes back.

import { useEffect, useRef } from 'react'
import { subscribeToEvents, processEvent, catchUp } from '../lib/ecosystem'

export function useFlowRunner(userId, session) {
  const sessionRef = useRef(session)
  sessionRef.current = session   // always the freshest token, without re-subscribing

  useEffect(() => {
    if (!userId) return undefined
    const ctx = () => ({ userId, session: sessionRef.current })
    const fail = (e) => console.error('[ecosystem] runner error:', e)

    const runCatchUp = () => { catchUp(ctx()).catch(fail) }
    const onVisible = () => { if (document.visibilityState === 'visible') runCatchUp() }

    const startTimer = setTimeout(runCatchUp, 4000)   // let the app settle first
    const unsubscribe = subscribeToEvents(userId, (row) => { processEvent(row, ctx()).catch(fail) })
    window.addEventListener('online', runCatchUp)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(startTimer)
      unsubscribe()
      window.removeEventListener('online', runCatchUp)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId])
}
