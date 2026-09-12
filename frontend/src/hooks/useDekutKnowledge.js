// src/hooks/useDekutKnowledge.js
//
// Admin-only data layer for dekut_knowledge (spec §28). Reads go direct
// to Supabase; writes always go through the dekut-knowledge-ingest edge
// function so every row's embedding is recomputed from its actual
// title/content — never let a title/content edit save without a
// matching embedding update, or retrieval quietly goes stale.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useDekutKnowledge() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('dekut_knowledge')
      .select('id, title, content, category, source, authority, status, version, updated_at')
      .order('updated_at', { ascending: false })
    if (error) {
      console.error('load dekut_knowledge failed:', error)
      setError(error)
    } else {
      setItems(data || [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Creates a new item, or updates an existing one when `payload.id` is
  // set. Returns the ingest result so the caller can show per-item
  // errors (e.g. embedding failed and nothing was saved).
  const saveItem = useCallback(async (payload) => {
    setSaving(true)
    try {
      const { data, error } = await supabase.functions.invoke('dekut-knowledge-ingest', {
        body: { items: [payload] },
      })
      if (error) throw error
      const result = data?.results?.[0]
      if (result?.ok) await load()
      return result
    } finally {
      setSaving(false)
    }
  }, [load])

  const archiveItem = useCallback(async (id) => {
    const { error } = await supabase.from('dekut_knowledge').update({ status: 'archived' }).eq('id', id)
    if (error) throw error
    await load()
  }, [load])

  const deleteItem = useCallback(async (id) => {
    const { error } = await supabase.from('dekut_knowledge').delete().eq('id', id)
    if (error) throw error
    await load()
  }, [load])

  return { items, loading, error, saving, saveItem, archiveItem, deleteItem, reload: load }
}
