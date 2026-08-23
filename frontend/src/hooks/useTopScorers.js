import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

let cache = null // module-level, shared across the whole session

export function useTopScorers() {
  const [players, setPlayers] = useState(() => cache?.players || [])
  const [loading, setLoading] = useState(!cache)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (cache) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('pulse-football-live?action=topscorers')
        if (cancelled) return
        if (fnError || !data?.ok) throw new Error(data?.error || 'Could not load top scorers')
        cache = { players: data.players || [] }
        setPlayers(cache.players)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return { players, loading, error }
}
