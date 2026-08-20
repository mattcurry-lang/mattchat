import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const memCache = new Map()

export function useTeamNews(teamId, teamName) {
  const [articles, setArticles] = useState(() => memCache.get(teamId) || null)
  const [loading, setLoading] = useState(!memCache.has(teamId))
  const inFlight = useRef(new Set())

  useEffect(() => {
    if (!teamId || !teamName) return
    const cached = memCache.get(teamId)
    if (cached) { setArticles(cached); setLoading(false); return }
    if (inFlight.current.has(teamId)) return
    inFlight.current.add(teamId)

    setLoading(true)
    supabase.functions.invoke(`pulse-team-news?teamId=${teamId}&teamName=${encodeURIComponent(teamName)}`)
      .then(({ data, error }) => {
        inFlight.current.delete(teamId)
        if (error || !data?.ok) { setArticles([]); setLoading(false); return } // news optional — fail silent
        memCache.set(teamId, data.articles)
        setArticles(data.articles)
        setLoading(false)
      })
  }, [teamId, teamName])

  return { articles: articles || [], loading }
}
