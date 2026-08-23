import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const LINEUP_WINDOW_MS = 75 * 60 * 1000 // only poll once kickoff is this close
const POLL_INTERVAL_MS = 10 * 60 * 1000  // lineups rarely change once posted — no need to hammer this

// match: { id, teamId, teamName, utcDate }
// Only pass a match when matchdayPhase === 'pre' — this hook does its
// own window check on top of that so it never fires far from kickoff.
export function usePreMatchLineups(match) {
  const [lineups, setLineups] = useState(null)
  const [loading, setLoading] = useState(false)

  const withinWindow = match ? (new Date(match.utcDate).getTime() - Date.now()) < LINEUP_WINDOW_MS : false

  const load = useCallback(async () => {
    if (!match?.id || !withinWindow) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        action: 'lineups-only',
        fdMatchId: match.id,
        fdTeamId: match.teamId,
        teamName: match.teamName,
        utcDate: match.utcDate,
      })
      const { data, error } = await supabase.functions.invoke(`pulse-football-live?${params.toString()}`)
      if (!error && data?.ok && data.lineups?.length > 0) {
        setLineups(data.lineups)
      }
    } catch (e) {
      console.error('usePreMatchLineups failed:', e)
    }
    setLoading(false)
  }, [match?.id, match?.teamId, match?.teamName, match?.utcDate, withinWindow])

  useEffect(() => {
    if (!withinWindow) return
    load()
    const id = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [load, withinWindow])

  return { lineups, loading }
}
