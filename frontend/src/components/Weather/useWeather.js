import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchWeather, cachedWeather } from './weatherService'
import { placeKey } from './weatherStore'

const REFRESH_MS = 10 * 60 * 1000

/** Live weather for one place: shows cached data instantly, refreshes every 10 minutes and when you come back to the tab. */
export function useWeather(place) {
  const key = place ? placeKey(place) : null
  const placeRef = useRef(place)
  placeRef.current = place
  const reqId = useRef(0)
  const invalidate = useCallback(() => { reqId.current += 1 }, []) // makes any request still in flight ignore its result
  const [s, setS] = useState({ key: null, data: null, status: 'idle', error: null })

  const load = useCallback(async (force = false) => {
    const p = placeRef.current
    if (!p) return
    const id = ++reqId.current
    const warm = cachedWeather(p)
    setS((prev) => ({ key, data: prev.key === key && prev.data ? prev.data : warm, status: (prev.key === key && prev.data) || warm ? 'refreshing' : 'loading', error: null }))
    try {
      const data = await fetchWeather(p, { force })
      if (id === reqId.current) setS({ key, data: { ...data, place: p }, status: 'ready', error: null })
    } catch (e) {
      if (id === reqId.current) setS((prev) => ({ key, data: prev.key === key ? prev.data : null, status: 'error', error: (e && e.message) || 'Something went wrong' }))
    }
  }, [key])

  useEffect(() => {
    if (!key) { setS({ key: null, data: null, status: 'idle', error: null }); return undefined }
    load(false)
    const timer = setInterval(() => load(true), REFRESH_MS)
    const onVis = () => { if (typeof document !== 'undefined' && !document.hidden) { const p = placeRef.current; const c = p && cachedWeather(p); if (!c || Date.now() - c.fetchedAt > REFRESH_MS) load(true) } }
    document.addEventListener('visibilitychange', onVis)
    return () => { invalidate(); clearInterval(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [key, load, invalidate])

  return { data: s.key === key ? s.data : null, status: key ? s.status : 'idle', error: s.error, refresh: () => load(true) }
}
