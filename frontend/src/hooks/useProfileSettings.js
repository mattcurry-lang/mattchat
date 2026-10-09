import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase' // adjust the path if your client lives elsewhere

/*
 * useProfileSettings(userId, { onError })
 *
 * Loads everything ProfileMenuSheet needs and saves every change it reports.
 *
 *   const { features, onFeatureChange, ready } = useProfileSettings(user?.id, { onError })
 *   <ProfileMenuSheet
 *     key={ready ? 'ready' : 'loading'}   // remounts once, so the sheet starts from saved values
 *     features={features}
 *     onFeatureChange={onFeatureChange}
 *     ...
 *   />
 *
 * Where each key is stored:
 *   profiles       theme, bio, statusEmoji, statusText, statusClear, note  (visible to other people)
 *   user_settings  every key in SETTING_KEYS, including presence (private, via the set_user_setting RPC)
 *   not saved yet  twoStep, chatLock, blockScreenshots, hideIp (they need real implementations)
 */

const PROFILE_KEYS = new Set(['theme', 'bio', 'statusEmoji', 'statusText', 'statusClear', 'note'])

const SETTING_KEYS = new Set([
  'presence', // private on purpose: other people must not be able to read that you chose Invisible
  'lastSeen', 'photoVis', 'showOnline', 'readReceipts', 'typing', 'whoCanAdd',
  'disappearing', 'keepArchived', 'enterToSend',
  'chatTheme', 'bubbleStyle', 'fontSize', 'autoplayMotion',
  'dnd', 'quietHours', 'previews', 'mentionsOnly',
  'dataSaver', 'autoDownload',
  'language', 'reduceMotion',
])

const PROFILE_COLUMNS =
  'bio, theme, status_emoji, status_text, status_expires_at, note_text, note_expires_at'

const FLUSH_DELAY_MS = 150 // the status form changes several keys at once; send them as one write
const NOTE_LIFETIME_MS = 24 * 60 * 60 * 1000

const isLive = (iso) => !iso || new Date(iso).getTime() > Date.now()

function statusExpiry(clear) {
  const now = new Date()
  if (clear === '1h') return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  if (clear === '4h') return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString()
  if (clear === 'today') {
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    return end.toISOString()
  }
  return null // 'never'
}

export default function useProfileSettings(userId, { onError } = {}) {
  const [features, setFeatures] = useState({})
  const [ready, setReady] = useState(false)

  const known = useRef({})   // latest value of every key we've seen, used to rebuild the status expiry
  const pending = useRef({}) // changes waiting to be sent
  const timer = useRef(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  // ---- load ----
  useEffect(() => {
    setReady(false)
    setFeatures({})
    known.current = {}
    if (!userId) return undefined

    let cancelled = false
    ;(async () => {
      const [profileRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
        supabase.from('user_settings').select('settings').eq('user_id', userId).maybeSingle(),
      ])
      if (cancelled) return

      const failure = profileRes.error || settingsRes.error
      if (failure) onErrorRef.current?.(failure)

      const next = { ...(settingsRes.data?.settings || {}) }
      const p = profileRes.data
      if (p) {
        if (p.theme) next.theme = p.theme
        if (p.bio != null) next.bio = p.bio
        if ((p.status_emoji || p.status_text) && isLive(p.status_expires_at)) {
          next.statusEmoji = p.status_emoji || ''
          next.statusText = p.status_text || ''
        }
        if (p.note_text && isLive(p.note_expires_at)) next.note = p.note_text
      }

      known.current = { ...next }
      setFeatures(next)
      setReady(true) // even after an error, so the sheet still opens with defaults
    })()

    return () => { cancelled = true }
  }, [userId])

  // ---- save ----
  const flush = useCallback(async () => {
    timer.current = null
    const batch = pending.current
    pending.current = {}
    const keys = Object.keys(batch)
    if (!userId || keys.length === 0) return

    const profilePatch = {}
    if ('theme' in batch) profilePatch.theme = batch.theme
    if ('bio' in batch) profilePatch.bio = batch.bio || null

    if ('statusEmoji' in batch || 'statusText' in batch || 'statusClear' in batch) {
      const k = known.current
      const hasStatus = !!(k.statusEmoji || k.statusText)
      profilePatch.status_emoji = k.statusEmoji || null
      profilePatch.status_text = k.statusText || null
      profilePatch.status_expires_at = hasStatus ? statusExpiry(k.statusClear) : null
    }

    if ('note' in batch) {
      profilePatch.note_text = batch.note || null
      profilePatch.note_expires_at = batch.note ? new Date(Date.now() + NOTE_LIFETIME_MS).toISOString() : null
    }

    const jobs = []
    if (Object.keys(profilePatch).length > 0) {
      jobs.push(supabase.from('profiles').update(profilePatch).eq('id', userId))
    }
    for (const key of keys) {
      if (SETTING_KEYS.has(key)) {
        jobs.push(supabase.rpc('set_user_setting', { p_key: key, p_value: batch[key] }))
      }
    }

    const results = await Promise.all(jobs)
    results.forEach((res) => { if (res.error) onErrorRef.current?.(res.error) })
  }, [userId])

  const onFeatureChange = useCallback((key, value) => {
    if (!PROFILE_KEYS.has(key) && !SETTING_KEYS.has(key)) return // not wired yet, stays local
    known.current = { ...known.current, [key]: value }
    pending.current = { ...pending.current, [key]: value }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, FLUSH_DELAY_MS)
  }, [flush])

  // send anything still waiting if the sheet unmounts or the tab is hidden
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden' && timer.current) { clearTimeout(timer.current); flush() } }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      if (timer.current) { clearTimeout(timer.current); flush() }
    }
  }, [flush])

  return { features, onFeatureChange, ready }
}
