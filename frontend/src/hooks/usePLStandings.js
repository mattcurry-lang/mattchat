import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

let standingsCache = null // { data, fetchedAt } — module-level, same pattern as useFootballData's memCache
const STANDINGS_MEM_TTL_MS = 3 * 60 * 1000 // short client-side reuse window; server cache handles the real TTL

export function usePLStandings() {
  const [table, setTable] = useState(() => standingsCache?.data || [])
  const [loading, setLoading] = useState(!standingsCache)
  const [error, setError] = useState(null)
  const inFlight = useRef(false)

  const load = useCallback(async (force = false) => {
    const isFresh = standingsCache && (Date.now() - standingsCache.fetchedAt) < STANDINGS_MEM_TTL_MS
    if (isFresh && !force) { setTable(standingsCache.data); setLoading(false); return }
    if (inFlight.current) return
    inFlight.current = true
    setLoading(!standingsCache)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pulse-football?action=standings')
      if (fnError || !data?.ok) throw new Error(data?.error || 'Could not load standings')
      standingsCache = { data: data.table || [], fetchedAt: Date.now() }
      setTable(standingsCache.data)
    } catch (e) {
      console.error('usePLStandings failed:', e)
      if (!standingsCache) setError('Could not load the table right now')
    }
    inFlight.current = false
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { table, loading, error, refresh: () => load(true) }
}
