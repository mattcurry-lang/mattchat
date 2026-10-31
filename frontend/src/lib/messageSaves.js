// src/lib/messageSaves.js
// "Saved for later": star a message and/or ask Mattchat to remind you about it.
// One row per (person, message) in public.message_saves (docs/step_message_saves.sql):
//   starred     - it shows under Starred
//   remind_at   - it comes back as a reminder at that time
// A row exists while it is starred OR has a reminder; clearing both removes it.
//
// Reminders are shown while Mattchat is open (in the app, plus a browser notification if allowed),
// and anything that came due while you were away appears as soon as you come back.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'

export const SAVES_SETUP_HINT = 'Saving isn’t switched on yet. Ask your admin to run docs/step_message_saves.sql in Supabase.'
const isMissingTable = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || (/message_saves/.test(e.message || '') && /does not exist|schema cache/i.test(e.message || '')))

const SELECT = `id, message_id, conversation_id, starred, remind_at, reminded_at, created_at,
  messages(content, created_at, sender_id, message_type, profiles!messages_sender_id_fkey(username))`

export async function fetchSaves(userId) {
  const { data, error } = await supabase.from('message_saves').select(SELECT).eq('user_id', userId).order('created_at', { ascending: false })
  if (error) { const err = new Error(isMissingTable(error) ? SAVES_SETUP_HINT : error.message); err.unavailable = isMissingTable(error); throw err }
  return data || []
}

async function writeSave(userId, message, existing, patch) {
  const next = { starred: existing?.starred ?? false, remind_at: existing?.remind_at ?? null, reminded_at: existing?.reminded_at ?? null, ...patch }
  if (!next.starred && !next.remind_at) {                                   // nothing left to keep
    if (existing) { const { error } = await supabase.from('message_saves').delete().eq('id', existing.id); if (error) throw error }
    return null
  }
  if (existing) {
    const { error } = await supabase.from('message_saves').update(next).eq('id', existing.id)
    if (error) throw error
    return { ...existing, ...next }
  }
  const row = { user_id: userId, message_id: message.id, conversation_id: message.conversation_id, ...next }
  const { data, error } = await supabase.from('message_saves').insert(row).select('id, created_at').maybeSingle()
  if (error) throw new Error(isMissingTable(error) ? SAVES_SETUP_HINT : error.message)
  return { ...row, id: data?.id ?? `local-${message.id}`, created_at: data?.created_at ?? new Date().toISOString() }
}

/**
 * useMessageSaves(userId) -> { saves, byMessage, isStarred, reminderFor, toggleStar, setReminder, remove, due, dismissDue, reload, unavailable, loading }
 * `due` = reminders whose time has come and haven't been dismissed yet.
 */
export function useMessageSaves(userId, { pollMs = 20000, now = () => Date.now() } = {}) {
  const [saves, setSaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [tick, setTick] = useState(0)
  const savesRef = useRef([])
  savesRef.current = saves
  const notified = useRef(new Set())

  const reload = useCallback(async () => {
    if (!userId) { setSaves([]); setLoading(false); return }
    try { setSaves(await fetchSaves(userId)); setUnavailable(false) }
    catch (e) { if (e.unavailable) setUnavailable(true) }
    setLoading(false)
  }, [userId])

  useEffect(() => { reload() }, [reload])
  useEffect(() => {                                   // keep the list fresh + notice reminders that come due
    if (!userId) return undefined
    const id = setInterval(() => setTick((t) => t + 1), pollMs)
    const onFocus = () => { setTick((t) => t + 1); reload() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  }, [userId, pollMs, reload])

  const byMessage = useMemo(() => new Map(saves.map((s) => [s.message_id, s])), [saves])
  const due = useMemo(
    () => saves.filter((s) => s.remind_at && !s.reminded_at && new Date(s.remind_at).getTime() <= now()),
    [saves, tick, now]  
  )

  useEffect(() => {                                   // one browser notification per due reminder (only if the person allowed it)
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    due.forEach((s) => {
      if (notified.current.has(s.id)) return
      notified.current.add(s.id)
      try { new Notification('Reminder', { body: (s.messages?.content || 'A message you saved').slice(0, 140) }) } catch { /* not allowed here */ }
    })
  }, [due])

  const apply = useCallback(async (message, patch) => {
    const existing = savesRef.current.find((s) => s.message_id === message.id)
    const before = savesRef.current
    const optimistic = (() => {                        // show it immediately, undo if the save fails
      const next = { starred: existing?.starred ?? false, remind_at: existing?.remind_at ?? null, reminded_at: existing?.reminded_at ?? null, ...patch }
      const rest = before.filter((s) => s.message_id !== message.id)
      if (!next.starred && !next.remind_at) return rest
      return [{ ...(existing || { id: `local-${message.id}`, message_id: message.id, conversation_id: message.conversation_id, created_at: new Date().toISOString(), messages: { content: message.content, created_at: message.created_at, sender_id: message.sender_id, message_type: message.message_type, profiles: message.profiles } }), ...next }, ...rest]
    })()
    setSaves(optimistic)
    try {
      await writeSave(userId, message, existing, patch)
      reload()                                         // pick up the real id / joined message
    } catch (e) {
      setSaves(before)
      if (/switched on/.test(e.message)) setUnavailable(true)
      throw e
    }
  }, [userId, reload])

  const toggleStar = useCallback((message) => apply(message, { starred: !(savesRef.current.find((s) => s.message_id === message.id)?.starred) }), [apply])
  const setReminder = useCallback((message, date) => apply(message, date ? { remind_at: new Date(date).toISOString(), reminded_at: null } : { remind_at: null, reminded_at: null }), [apply])
  const remove = useCallback(async (save) => {
    const before = savesRef.current
    setSaves(before.filter((s) => s.id !== save.id))
    try { const { error } = await supabase.from('message_saves').delete().eq('id', save.id); if (error) throw error }
    catch (e) { setSaves(before); throw e }
  }, [])
  const dismissDue = useCallback(async (save) => {
    const stamp = new Date().toISOString()
    setSaves((list) => list.map((s) => (s.id === save.id ? { ...s, reminded_at: stamp } : s)))
    await supabase.from('message_saves').update({ reminded_at: stamp }).eq('id', save.id)
  }, [])

  return {
    saves, loading, unavailable, byMessage, due, reload, toggleStar, setReminder, remove, dismissDue,
    isStarred: (messageId) => !!byMessage.get(messageId)?.starred,
    reminderFor: (messageId) => { const s = byMessage.get(messageId); return s?.remind_at && !s.reminded_at ? s.remind_at : null },
  }
}
