import { useEffect, useState, useSyncExternalStore } from 'react'
import { supabase } from './supabase'

// ── Tune these ────────────────────────────────────────────
export const OFFLINE_GRACE_MS = 1 * 60 * 60 * 1000   // 10 min. For 2 hours: 2 * 60 * 60 * 1000
const PING_ONLINE_MS = 20 * 1000    // how often to confirm we're really online
const PING_OFFLINE_MS = 5 * 1000    // how often to look for the connection coming back
const PING_TIMEOUT_MS = 4 * 1000
// ──────────────────────────────────────────────────────────

const KEY = 'mattchat:offlineSince'
const readSince = () => { try { return Number(localStorage.getItem(KEY)) || null } catch { return null } }
const writeSince = (v) => { try { v ? localStorage.setItem(KEY, String(v)) : localStorage.removeItem(KEY) } catch {} }

const startedOnline = typeof navigator === 'undefined' ? true : navigator.onLine
let state = startedOnline
  ? { online: true, offlineSince: null }
  : { online: false, offlineSince: readSince() || Date.now() }
writeSince(state.offlineSince)
if (!startedOnline) { try { supabase.auth.stopAutoRefresh() } catch {} }

const listeners = new Set()
const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb) }
const emit = () => listeners.forEach((l) => l())

function setOnline(next) {
  if (next === state.online) return
  if (next) {
    state = { online: true, offlineSince: null }
    writeSince(null)
    try { supabase.auth.startAutoRefresh() } catch {}
    // wake the outbox, chat refresh and other listeners, even if the browser never fired 'online'
    window.dispatchEvent(new Event('online'))
  } else {
    state = { online: false, offlineSince: state.offlineSince || Date.now() }
    writeSince(state.offlineSince)
    try { supabase.auth.stopAutoRefresh() } catch {}
  }
  emit()
}

async function ping() {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS)
  try {
    await fetch(`/logo.png?ping=${Date.now()}`, { method: 'HEAD', cache: 'no-store', signal: ctrl.signal })
    return true // any response means the network works
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

let timer = null
let fails = 0
async function check() {
  clearTimeout(timer)
  if (document.visibilityState === 'visible') {
    if (!navigator.onLine) { fails = 2; setOnline(false) }
    else if (await ping()) { fails = 0; setOnline(true) }
    else { fails++; if (fails >= 2) setOnline(false) } // two misses in a row, so one blip doesn't count
  }
  timer = setTimeout(check, fails === 1 ? 3000 : state.online ? PING_ONLINE_MS : PING_OFFLINE_MS)
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => { fails = 2; setOnline(false) })
  window.addEventListener('online', check)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  check()
}

export const isOnlineNow = () => state.online

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, () => state.online)
}

// status: 'online' | 'reconnecting' (inside the grace window) | 'offline' (grace window used up)
export function useConnectionStatus() {
  const s = useSyncExternalStore(subscribe, () => state)
  const [, tick] = useState(0)
  const left = s.online || !s.offlineSince ? 0 : Math.max(0, s.offlineSince + OFFLINE_GRACE_MS - Date.now())

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => tick((n) => n + 1), left + 50)
    return () => clearTimeout(t)
  }, [s, left])

  return { online: s.online, status: s.online ? 'online' : left > 0 ? 'reconnecting' : 'offline', graceLeftMs: left }
}
