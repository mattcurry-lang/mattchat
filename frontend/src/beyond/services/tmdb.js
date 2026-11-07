// src/beyond/services/tmdb.js
//
// Movie data for Cinema, from The Movie Database via our own edge function
// (supabase/functions/beyond-tmdb). No API key exists in the browser.
//
// Caching: in memory plus sessionStorage, 30 minutes, so reopening Cinema or
// switching tabs does not hit the network again.
//
// Ratings here are TMDB audience ratings. They are always labelled "TMDB"; they are
// not IMDb or Rotten Tomatoes scores.

import { supabase } from '../../lib/supabase'

export const REGION = 'KE' // Kenya first; streaming data is shown for this region only
const TTL = 30 * 60 * 1000
const mem = new Map()

export class CinemaError extends Error {
  constructor(kind, message) { super(message || kind); this.kind = kind } // 'offline' | 'not_configured' | 'unavailable'
}

export async function tmdb(path, params = {}) {
  const key = path + '?' + JSON.stringify(params)
  const now = Date.now()
  const hit = mem.get(key)
  if (hit && now - hit.at < TTL) return hit.data
  try {
    const raw = sessionStorage.getItem('beyond:tmdb:' + key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (now - parsed.at < TTL) { mem.set(key, parsed); return parsed.data }
    }
  } catch { /* storage unavailable: fine */ }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new CinemaError('offline', 'You are offline')

  const { data, error } = await supabase.functions.invoke('beyond-tmdb', { body: { path, params } })
  if (error) {
    let body = null
    try { body = await error.context?.json?.() } catch { /* not json */ }
    if (body?.error === 'not_configured') throw new CinemaError('not_configured')
    // a missing/undeployed function surfaces as a relay/404 error from Supabase
    if (error.name === 'FunctionsRelayError' || error.context?.status === 404) throw new CinemaError('not_configured')
    throw new CinemaError('unavailable', body?.error || error.message)
  }
  const entry = { at: now, data }
  mem.set(key, entry)
  try { sessionStorage.setItem('beyond:tmdb:' + key, JSON.stringify(entry)) } catch { /* quota: ignore */ }
  return data
}

// TMDB's image CDN. Sizes are the documented ones.
export const img = (path, size = 'w500') => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null)

export const year = (d) => (d ? String(d).slice(0, 4) : '')
export const rating = (m) => (m && m.vote_count > 0 ? m.vote_average.toFixed(1) : '')
export const runtimeLabel = (min) => (min ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m` : '')

// ── lists for the Cinema home ──────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10)
const daysFromToday = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

export const LISTS = {
  trending: () => tmdb('/trending/movie/week'),
  topRated: () => tmdb('/movie/top_rated', { region: REGION }),
  newReleases: () => tmdb('/movie/now_playing', { region: REGION }),
  // good rating, but not already everywhere: "hidden gems"
  hiddenGems: () => tmdb('/discover/movie', {
    sort_by: 'vote_average.desc', 'vote_average.gte': 7.3, 'vote_count.gte': 300, 'vote_count.lte': 4000,
    'primary_release_date.lte': today(),
  }),
  comingSoon: () => tmdb('/discover/movie', {
    sort_by: 'primary_release_date.asc', 'primary_release_date.gte': daysFromToday(1),
    'primary_release_date.lte': daysFromToday(120), region: REGION,
  }),
  popular: () => tmdb('/movie/popular', { region: REGION }),
}

export const genres = async () => (await tmdb('/genre/movie/list')).genres || []

export function loadMovie(id) {
  return Promise.all([
    tmdb(`/movie/${id}`, { append_to_response: 'credits,videos,recommendations' }),
    tmdb(`/movie/${id}/watch/providers`).catch(() => null), // optional: never block the page on it
  ]).then(([movie, providers]) => ({ movie, providers: providers?.results?.[REGION] || null }))
}

export function browse({ query, genre, sort, page }) {
  if (query && query.trim()) return tmdb('/search/movie', { query: query.trim(), page })
  return tmdb('/discover/movie', {
    page, with_genres: genre || undefined, sort_by: sort || 'popularity.desc',
    'vote_count.gte': sort === 'vote_average.desc' ? 300 : undefined,
    'primary_release_date.lte': sort === 'primary_release_date.desc' ? today() : undefined,
  })
}

// ── details helpers ────────────────────────────────────────────────────────
export const director = (movie) => movie?.credits?.crew?.find((c) => c.job === 'Director')?.name || ''
export const mainCast = (movie, n = 4) => (movie?.credits?.cast || []).slice(0, n).map((c) => c.name)
export function trailerKey(movie) {
  const vids = (movie?.videos?.results || []).filter((v) => v.site === 'YouTube')
  const pick = vids.find((v) => v.type === 'Trailer' && v.official) || vids.find((v) => v.type === 'Trailer') || vids[0]
  return pick ? pick.key : null
}

// ── Tonight's pick ─────────────────────────────────────────────────────────
// Same pick all day for the same person (so it does not jump around), a new one
// tomorrow, and never one of the last 14 shown.
const SHOWN_KEY = 'beyond:cinema:shown'
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

export function tonightsPick(pool, userId) {
  const day = today()
  let shown = []
  try { shown = JSON.parse(localStorage.getItem(SHOWN_KEY) || '[]') } catch { /* ignore */ }
  const todays = shown.find((s) => s.day === day)
  if (todays) { const m = pool.find((p) => p.id === todays.id); if (m) return m }

  const recent = new Set(shown.slice(-14).map((s) => s.id))
  const lastGenres = new Set((shown[shown.length - 1] || {}).genres || [])
  const ranked = pool
    .filter((m) => m.backdrop_path && m.vote_count >= 200 && m.vote_average >= 6.8 && !recent.has(m.id))
    .map((m) => {
      const ageDays = m.release_date ? (Date.now() - Date.parse(m.release_date)) / 86400000 : 9999
      const fresh = ageDays < 365 ? 0.6 : ageDays < 1095 ? 0.3 : 0
      const diverse = (m.genre_ids || []).some((g) => lastGenres.has(g)) ? -0.5 : 0.3 // avoid repeating yesterday's genre
      return { m, score: m.vote_average * 0.6 + Math.log10(1 + (m.popularity || 0)) * 0.4 + fresh + diverse }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
  if (!ranked.length) return null
  const pick = ranked[hash(day + (userId || '')) % ranked.length].m
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...shown.filter((s) => s.day !== day), { day, id: pick.id, genres: pick.genre_ids || [] }].slice(-30)))
  } catch { /* ignore */ }
  return pick
}

// ── personal saves (this device only; the shared watchlist comes with "Our movie") ──
const SAVED_KEY = 'beyond:cinema:saved'
export const getSaved = () => { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') } catch { return [] } }
export function toggleSaved(movie) {
  const list = getSaved()
  const next = list.some((m) => m.id === movie.id)
    ? list.filter((m) => m.id !== movie.id)
    : [{ id: movie.id, title: movie.title, poster_path: movie.poster_path, release_date: movie.release_date }, ...list].slice(0, 100)
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  return next
}
