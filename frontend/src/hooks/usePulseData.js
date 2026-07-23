import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getAllPulsePlugins } from '../lib/pulsePlugins'

async function fetchPulseData(session) {
  const { data, error } = await supabase.functions.invoke('pulse-data', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) throw error
  return data
}

/**
 * usePulseData
 *
 * FIX/REFACTOR: item-building used to be one growing function
 * (buildActivityItems) with an if/else branch per integration —
 * adding YouTube/Drive/Calendar/Spotify/Dropbox/OneDrive meant
 * growing that function indefinitely. Now every integration is a
 * self-contained plugin (see src/lib/pulsePlugins/) and this hook
 * just asks the registry for all of them.
 *
 * Bonus fix that falls out of the plugin split: local-only plugins
 * (right now just Mattchat's own unread counts) no longer wait on the
 * pulse-data network round trip to render — only plugins that
 * genuinely need `raw` (usesRemoteData: true) hold off. Previously
 * EVERYTHING, including your own unread Mattchat conversations, was
 * hidden until the Gmail/Instagram fetch finished. This is the
 * "Pulse should load progressively" requirement from the design
 * brief, not just an architecture cleanup.
 */
export function usePulseData(session, { conversations, unreadCounts, getConvoName } = {}) {
  const [raw, setRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPulseData(session)
      setRaw(data)
    } catch (e) {
      console.error('usePulseData failed:', e)
      setError(e.message)
    }
    setLoading(false)
  }, [session])

  useEffect(() => { load() }, [load])

  const ctx = { conversations, unreadCounts, getConvoName, session }

  const items = getAllPulsePlugins()
    .flatMap((plugin) => {
      if (plugin.usesRemoteData && !raw) return [] // still waiting on the fetch
      try {
        return plugin.buildItems(raw, ctx) || []
      } catch (e) {
        // One misbehaving integration should never take the whole
        // Pulse feed down with it.
        console.error(`[pulse] plugin "${plugin.id}" buildItems failed:`, e)
        return []
      }
    })
    .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))

  const totalUnread = items.reduce((sum, i) => sum + (i.count || 0), 0)

  return { items, totalUnread, loading, error, reload: load, raw }
}

export function usePulseSettings(userId) {
  const [privacyMode, setPrivacyModeState] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!userId) return
    supabase.from('pulse_settings').select('privacy_mode').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        setPrivacyModeState(!!data?.privacy_mode)
        setLoaded(true)
      })
  }, [userId])

  const setPrivacyMode = useCallback(async (value) => {
    setPrivacyModeState(value)
    await supabase.from('pulse_settings').upsert(
      { user_id: userId, privacy_mode: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  }, [userId])

  return { privacyMode, setPrivacyMode, loaded }
}
