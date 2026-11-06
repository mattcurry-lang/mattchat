import { supabase } from '../supabase'
import { isOnlineNow } from '../connectivity'

/**
 * lib/music/CampusTrends.js
 *
 * The ONLY place the app talks to the Campus Trends database functions.
 * It never sends what anyone listens to or saves anywhere: it reads the published
 * chart and stores the student's two choices (campus, participation).
 * Nothing here is in the playback path, so a failure cannot interrupt music.
 *
 * Chart shape returned by getChart():
 *   { status: 'ok' | 'none_yet' | 'not_enough_data' | 'no_campus' | 'disabled',
 *     campus, period_start, period_end, stale, has_previous,
 *     tracks:  [{ rank, movement, rank_change, is_rising, rising_kind, track }],
 *     artists: [{ rank, name }],
 *     genres:  [{ rank, genre, share_pct }] }
 *   (plus fromCache / cachedAt when the saved copy was used because the network failed)
 */

// Bump when the privacy notice text changes materially. Opted-in students are then asked again.
export const NOTICE_VERSION = 'v1'
export const CAMPUS_TRENDS_EVENT = 'mattchat-campus-trends-changed'

const MEMO_MS = 10 * 60 * 1000 // the chart only changes weekly; no need to refetch on every tab switch
const CACHE_PREFIX = 'mattchat:campusTrends:chart:'
const FALLBACK = 'Something went wrong. Please try again.'
const OFFLINE = "You're offline. Try again when you're back online."

const BASE_TRACK = { album: null, artistId: null, streamUrl: null, isDownloadable: false }

let memo = null // { uid, at, data }

const readJSON = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb } catch { return fb } }
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode / full */ } }

// Our own database messages ("You can change your campus once every 28 days") are written for students; show them.
function friendly(error) {
  if (!error) return FALLBACK
  if ((error.code === 'P0001' || error.code === '22023') && error.message) return error.message
  if (error.code === '28000') return 'Please sign in again.'
  if (!isOnlineNow()) return OFFLINE
  return FALLBACK
}

async function call(name, args) {
  if (!isOnlineNow()) throw new Error(OFFLINE)
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(friendly(error))
  return data
}

function forgetChart() {
  memo = null
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k))
  } catch { /* ignore */ }
}

const announce = () => {
  try { window.dispatchEvent(new CustomEvent(CAMPUS_TRENDS_EVENT)) } catch { /* ignore */ }
}

/* ── the student's own state: campus, pending campus change, participation ── */

export async function getMyState() {
  return call('campus_trends_my_state')
}

export async function listCampuses() {
  const { data, error } = await supabase.from('campuses').select('id, slug, name').eq('is_active', true).order('name')
  if (error) throw new Error(friendly(error))
  return data || []
}

/** First pick is immediate; a later change takes effect next Monday (Nairobi time) and is limited to once per 28 days. */
export async function setMyCampus(campusId) {
  const out = await call('set_my_campus', { p_campus_id: campusId })
  forgetChart()
  announce()
  return out
}

/** "Contribute to campus trends" (true) or "Not now" (false). Takes effect from the next weekly chart. */
export async function setParticipation(enabled) {
  const out = await call('set_my_trend_participation', { p_enabled: !!enabled, p_notice_version: NOTICE_VERSION })
  announce()
  return out
}

/** Which onboarding screen to show, if any: 'campus' | 'consent' | 'reconsent' | null */
export function onboardingStep(state) {
  if (!state?.campus) return 'campus'
  const pref = state.preference
  if (!pref) return 'consent'
  if (pref.enabled && pref.notice_version !== NOTICE_VERSION) return 'reconsent'
  return null
}

/* ── the published chart ── */

export async function getChart(userId, { force = false } = {}) {
  if (!force && memo && memo.uid === userId && Date.now() - memo.at < MEMO_MS) return memo.data
  try {
    const data = await call('campus_trends_get_chart')
    if (data?.status === 'ok') {
      memo = { uid: userId, at: Date.now(), data }
      writeJSON(CACHE_PREFIX + userId, { at: Date.now(), data })
    } else {
      forgetChart() // never keep serving an old chart once the server says there isn't one
    }
    return data
  } catch (err) {
    // Network trouble: show the last published chart we saved (it is public aggregate data), clearly marked as saved.
    const saved = readJSON(CACHE_PREFIX + userId, null)
    if (saved?.data) return { ...saved.data, fromCache: true, cachedAt: saved.at }
    throw err
  }
}

/* ── helpers for the screens ── */

/** Tracks in the exact shape the player expects: playTrack(track, chartTracks(chart)). No second player. */
export function chartTracks(chart) {
  return (chart?.tracks || []).map((row) => ({ ...BASE_TRACK, ...row.track }))
}

/** What to show beside a song's rank. 'none' means show nothing: we never invent a movement. */
export function describeMovement(row) {
  switch (row?.movement) {
    case 'up': return { kind: 'up', label: `Up ${Math.abs(row.rank_change || 0)}`, amount: Math.abs(row.rank_change || 0) }
    case 'down': return { kind: 'down', label: `Down ${Math.abs(row.rank_change || 0)}`, amount: Math.abs(row.rank_change || 0) }
    case 'same': return { kind: 'same', label: 'Unchanged', amount: 0 }
    case 'new': return { kind: 'new', label: 'New', amount: 0 }
    case 'reentry': return { kind: 'reentry', label: 'Back', amount: 0 }
    default: return { kind: 'none', label: '', amount: 0 }
  }
}

/** "3 Nov to 9 Nov", in Nairobi time. period_end is the start of the next Monday, so the last day is a day earlier. */
export function formatPeriod(chart) {
  if (!chart?.period_start || !chart?.period_end) return ''
  const fmt = (d, o) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', ...o }).format(d)
  const first = new Date(chart.period_start)
  const last = new Date(new Date(chart.period_end).getTime() - 24 * 3600 * 1000)
  const withMonth = { day: 'numeric', month: 'short' }
  return `${fmt(first, withMonth)} to ${fmt(last, withMonth)}`
}
