// src/hooks/useDekutCatering.js
//
// Admin-only data layer for the catering menu (messes + items). This is
// the ONLY path real menu data enters Curry's world — see the migration
// comment for why (no confirmed DeKUT catering API, so this mirrors the
// admin-curated trust model already used for dekut_knowledge).

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useDekutCatering() {
  const [messes, setMesses] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: messData, error: messErr }, { data: itemData, error: itemErr }] = await Promise.all([
      supabase.from('dekut_catering_messes').select('*').order('name'),
      supabase.from('dekut_catering_menu_items').select('*').order('name'),
    ])
    if (messErr || itemErr) {
      console.error('load catering data failed:', messErr || itemErr)
      setError(messErr || itemErr)
    } else {
      setMesses(messData || [])
      setItems(itemData || [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveMess = useCallback(async (payload) => {
    const { error } = await supabase.from('dekut_catering_messes').upsert(payload)
    if (error) throw error
    await load()
  }, [load])

  const deleteMess = useCallback(async (id) => {
    const { error } = await supabase.from('dekut_catering_messes').delete().eq('id', id)
    if (error) throw error
    await load()
  }, [load])

  const saveItem = useCallback(async (payload) => {
    const { error } = await supabase.from('dekut_catering_menu_items').upsert(payload)
    if (error) throw error
    await load()
  }, [load])

  const deleteItem = useCallback(async (id) => {
    const { error } = await supabase.from('dekut_catering_menu_items').delete().eq('id', id)
    if (error) throw error
    await load()
  }, [load])

  return { messes, items, loading, error, saveMess, deleteMess, saveItem, deleteItem, reload: load }
}
