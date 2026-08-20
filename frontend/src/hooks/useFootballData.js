import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const memCache = new Map() // teamId -> { data, fetchedAt } — survives team switches within a session

export function usePlTeamsList() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase.functions.invoke('pulse-football?action=teams')
      .then(({ data, error: fnError }) => {
        if (cancelled) return
        if (fnError || !data?.ok) { setError('Could not load clubs'); setLoading(false); return }
        setTeams(data.teams || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { teams, loading, error }
}

export function useFootballData(teamId) {
  const [data, setData] = useState(() => memCache.get(teamId)?.data || null)
  const [loading, setLoading] = useState(!memCache.has(teamId))
  const [error, setError] = useState(null)
  const inFlight = useRef(new Set())

  const load = useCallback(async (force = false) => {
    if (!teamId) return
    const cached = memCache.get(teamId)
    if (cached && !force) { setData(cached.data); setLoading(false); return }
    if (inFlight.current.has(teamId)) return
    inFlight.current.add(teamId)

    setLoading(!cached) // optimistic UI: keep showing stale cached data while refreshing, if we have any
    setError(null)
    try {
      const { data: resp, error: fnError } = await supabase.functions.invoke(`pulse-football?action=team&teamId=${teamId}`)
      if (fnError || !resp?.ok) throw new Error(resp?.error || 'fetch failed')
      const bundle = { team: resp.team, nextMatch: resp.nextMatch, lastResult: resp.lastResult, standing: resp.standing }
      memCache.set(teamId, { data: bundle, fetchedAt: Date.now() })
      setData(bundle)
    } catch (e) {
      console.error('useFootballData failed:', e)
      // Keep whatever stale cache we had rather than blanking the section
      if (!cached) setError('Could not load team data')
    }
    inFlight.current.delete(teamId)
    setLoading(false)
  }, [teamId])

  useEffect(() => { load() }, [load])

  return { data, loading, error, refresh: () => load(true) }
}
