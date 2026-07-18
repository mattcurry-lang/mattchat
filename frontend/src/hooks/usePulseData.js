import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

async function fetchPulseData(session) {
  const { data, error } = await supabase.functions.invoke('pulse-data', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) throw error
  return data
}

// Builds real activity cards only from real data. `conversations` and
// `unreadCounts` come from ChatPage's existing hooks — no new fetch
// needed for Mattchat's own unread state, it's already loaded there.
function buildActivityItems({ gmail, instagram, conversations, unreadCounts, getConvoName }) {
  const items = []

  // Mattchat's own unread conversations — always real, from the same
  // data ChatPage already renders in the sidebar.
  ;(conversations || []).forEach((c) => {
    const unread = unreadCounts?.[c.id] || 0
    if (unread === 0) return
    items.push({
      id: `mattchat-${c.id}`,
      app: 'mattchat',
      sender: getConvoName ? getConvoName(c) : 'Mattchat',
      title: `${unread} unread message${unread > 1 ? 's' : ''}`,
      count: unread,
      receivedAt: c.updated_at,
      importance: unread >= 4 ? 'high' : 'medium',
      conversationId: c.id,
    })
  })

  // Gmail — real unread counts per connected account.
  if (gmail?.connected) {
    gmail.accounts.forEach((acc) => {
      if (acc.error) {
        items.push({
          id: `gmail-error-${acc.email}`,
          app: 'gmail',
          sender: acc.email,
          title: acc.error === 'token_expired' ? 'Reconnect needed' : "Couldn't check inbox",
          count: 0,
          receivedAt: new Date().toISOString(),
          importance: 'low',
          error: true,
        })
        return
      }
      if (acc.unreadCount > 0) {
        items.push({
          id: `gmail-${acc.email}`,
          app: 'gmail',
          sender: acc.email,
          title: `${acc.unreadCount} unread email${acc.unreadCount > 1 ? 's' : ''}`,
          count: acc.unreadCount,
          receivedAt: new Date().toISOString(),
          importance: acc.unreadCount >= 5 ? 'high' : 'medium',
        })
      }
    })
  }

  // Instagram — connection status only (no DM/notification access
  // exists via the API), shown as an informational card, not framed
  // as "unread messages" since that data doesn't exist for Mattchat.
  if (instagram?.connected) {
    items.push({
      id: 'instagram-status',
      app: 'instagram',
      sender: `@${instagram.username}`,
      title: 'Connected — view your profile and posts in Mattchat',
      count: 0,
      receivedAt: new Date().toISOString(),
      importance: 'low',
      isStatusOnly: true,
    })
  }

  return items.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
}

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

  const items = raw
    ? buildActivityItems({ gmail: raw.gmail, instagram: raw.instagram, conversations, unreadCounts, getConvoName })
    : []

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
