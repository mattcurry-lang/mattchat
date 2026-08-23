import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// match: { id, teamId, teamName, utcDate, isFinal }
// Only call this hook when a match is actually live or finished — it's
// pointless (and wastes API-Football's small quota) for upcoming fixtures
// with no events yet.
export function useMatchDetail(match, enabled) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!enabled || !match?.id) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        action: 'match-detail',
        fdMatchId: match.id,
        fdTeamId: match.teamId,
        teamName: match.teamName,
        utcDate: match.utcDate,
        isFinal: String(!!match.isFinal),
      })
      const { data, error: fnError } = await supabase.functions.invoke(`pulse-football-live?${params.toString()}`)
      if (fnError || !data?.ok) throw new Error(data?.error || 'Could not load match details')
      setDetail(data)
    } catch (e) {
      console.error('useMatchDetail failed:', e)
      setError(e.message)
    }
    setLoading(false)
  }, [enabled, match?.id, match?.teamId, match?.teamName, match?.utcDate, match?.isFinal])

  useEffect(() => { load() }, [load])

  return { detail, loading, error, refresh: load }
}
