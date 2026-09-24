import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useDekutRoutes({ isAdmin }) {
  const [drafts, setDrafts] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!isAdmin) return
    const { data } = await supabase.from('dekut_location_routes')
      .select('*, dekut_locations(name)').eq('status', 'draft').order('created_at', { ascending: false })
    setDrafts(data || [])
  }, [isAdmin])
  useEffect(() => { load() }, [load])

  const generate = useCallback(async (locationId) => {
    setBusyId(locationId); setError(null)
    try {
      const { data, error: err } = await supabase.functions.invoke('dekut-video-route', { body: { location_id: locationId } })
      if (err) {
        let msg = err.message
        try { msg = (await err.context.json()).error || msg } catch { /* keep default */ }
        throw new Error(msg)
      }
      if (data?.error) throw new Error(data.error)
      await load()
      return true
    } catch (e) { setError(e.message); return false } finally { setBusyId(null) }
  }, [load])

  const approve = useCallback(async (id, steps) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('dekut_location_routes')
      .update({ status: 'approved', steps, approved_by: user?.id, approved_at: new Date().toISOString() }).eq('id', id)
    load()
  }, [load])

  const reject = useCallback(async (id) => {
    await supabase.from('dekut_location_routes').update({ status: 'rejected' }).eq('id', id)
    load()
  }, [load])

  return { drafts, busyId, error, generate, approve, reject }
}
