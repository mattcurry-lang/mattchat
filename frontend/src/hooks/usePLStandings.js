import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function usePLStandings() {
  const [table, setTable] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          `pulse-football?action=standings`,
          { method: 'GET' }
        )
        if (cancelled) return
        if (fnError) throw fnError
        if (!data.ok) throw new Error(data.error || 'Could not load standings')
        setTable(data.table || [])
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return { table, loading, error }
}
