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
  const [rateLimited, setRateLimited] = useState(false)
  const inFlight = useRef(new Set())
  const retryTimer = useRef(null)

  const load = useCallback(async (force = false) => {
    if (!teamId) return
    const cached = memCache.get(teamId)
    if (cached && !force) { setData(cached.data); setLoading(false); return }
    if (inFlight.current.has(teamId)) return
    inFlight.current.add(teamId)
    setLoading(!cached)
    setError(null)
    try {
      const { data: resp, error: fnError } = await supabase.functions.invoke(`pulse-football?action=team&teamId=${teamId}`)
      if (fnError || !resp?.ok) {
        const err = new Error(resp?.error || 'fetch failed')
        err.rateLimited = !!resp?.rateLimited
        throw err
      }

      const bundle = { ...resp }
      delete bundle.ok

      memCache.set(teamId, { data: bundle, fetchedAt: Date.now() })
      setData(bundle)
      setRateLimited(false)
    } catch (e) {
      console.error('useFootballData failed:', e)
      if (e.rateLimited) {
        // football-data.org's free tier is 10 req/min — this is a
        // temporary condition, not a real failure. Auto-retry once
        // instead of leaving the user stuck on a dead-end error.
        setRateLimited(true)
        if (!cached) setError('rate_limited')
        clearTimeout(retryTimer.current)
        retryTimer.current = setTimeout(() => load(true), 15000)
      } else if (!cached) {
        setError('generic')
      }
    }
    inFlight.current.delete(teamId)
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    load()
    return () => clearTimeout(retryTimer.current)
  }, [load])

  return { data, loading, error, rateLimited, refresh: () => load(true) }
}
