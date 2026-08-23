import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// options: [{ key, label }, ...]
export function usePoll(matchId, pollType, options, userId) {
  const [results, setResults] = useState({}) // { [optionKey]: count }
  const [myVote, setMyVote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!matchId || !pollType) return
    setLoading(true)

    const [{ data: agg }, { data: mine }] = await Promise.all([
      supabase.rpc('pulse_get_poll_results', { p_match_id: matchId, p_poll_type: pollType }),
      userId
        ? supabase.from('pulse_poll_votes').select('option_key').eq('match_id', matchId).eq('poll_type', pollType).eq('user_id', userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const byKey = {}
    for (const opt of options) byKey[opt.key] = 0
    for (const row of agg || []) byKey[row.option_key] = Number(row.vote_count)

    setResults(byKey)
    setMyVote(mine?.option_key || null)
    setLoading(false)
  }, [matchId, pollType, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const vote = useCallback(async (optionKey) => {
    if (!userId || submitting) return
    const option = options.find(o => o.key === optionKey)
    if (!option) return

    setSubmitting(true)
    setMyVote(optionKey) // optimistic

    const { error } = await supabase.from('pulse_poll_votes').upsert({
      match_id: matchId, poll_type: pollType,
      option_key: option.key, option_label: option.label,
      user_id: userId,
    }, { onConflict: 'match_id,poll_type,user_id' })

    if (error) {
      console.error('vote failed:', error)
      setMyVote(null) // roll back optimistic update
    } else {
      await load()
    }
    setSubmitting(false)
  }, [matchId, pollType, options, userId, submitting, load])

  const totalVotes = Object.values(results).reduce((a, b) => a + b, 0)

  return { results, myVote, totalVotes, loading, submitting, vote }
}
