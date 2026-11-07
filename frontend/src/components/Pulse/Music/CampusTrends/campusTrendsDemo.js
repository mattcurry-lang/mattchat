import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'

// Demo mode for the Campus tab. It needs BOTH of these, so students can never see it:
//   1) you ask for it: open the app with ?campusDemo=1, or run localStorage.setItem('campusDemo','1') in the browser console
//   2) the database confirms you are an admin (campus_trends_is_admin)
// It shows made-up data only, writes nothing, and plays nothing.
const FLAG_KEY = 'campusDemo'
const EAT_MS = 3 * 3600 * 1000
const DAY = 86400000

function requested() {
  try {
    if (new URLSearchParams(window.location.search).get('campusDemo') === '1') return true
    return localStorage.getItem(FLAG_KEY) === '1'
  } catch { return false }
}

export function useDemoMode() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!requested()) { setOn(false); return undefined }
    let alive = true
    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('campus_trends_is_admin')
        if (alive) setOn(!error && data === true)
      } catch {
        if (alive) setOn(false)
      }
    })()
    return () => { alive = false }
  }, [])
  return on
}

function currentWeekStart() {
  const l = new Date(Date.now() + EAT_MS)
  const dow = (l.getUTCDay() + 6) % 7
  return Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() - dow) - EAT_MS
}

// title, artist, genre, movement, rank_change, rising_kind
const SONGS = [
  ['Demo Song One', 'Demo Artist A', 'Afrobeats', 'same', 0, null],
  ['Demo Song Two', 'Demo Artist B', 'Hip-hop', 'up', 3, 'established'],
  ['Demo Song Three', 'Demo Artist A', 'Afrobeats', 'down', -1, null],
  ['Demo Song Four', 'Demo Artist C', 'Gospel', 'new', null, null],
  ['Demo Song Five', 'Demo Artist D', 'Amapiano', 'up', 2, 'emerging'],
  ['Demo Song Six', 'Demo Artist B', 'Hip-hop', 'reentry', null, null],
  ['Demo Song Seven', 'Demo Artist E', null, 'same', 0, null],
  ['Demo Song Eight', 'Demo Artist C', 'Gospel', 'down', -2, null],
  ['Demo Song Nine', 'Demo Artist F', 'R&B', 'new', null, null],
  ['Demo Song Ten', 'Demo Artist D', 'Amapiano', 'up', 1, 'emerging'],
  ['Demo Song Eleven', 'Demo Artist E', 'Afrobeats', 'new', null, null],
  ['Demo Song Twelve', 'Demo Artist F', 'Afrobeats', 'down', -4, null],
  ['Demo Song Thirteen', 'Demo Artist A', 'Afrobeats', 'same', 0, null],
  ['Demo Song Fourteen', 'Demo Artist B', 'Afrobeats', 'up', 1, null],
]

export function makeDemoChart() {
  const end = currentWeekStart()
  const start = end - 7 * DAY
  return {
    status: 'ok',
    campus: 'Demo Campus (DemoA)',
    period_start: new Date(start).toISOString(),
    period_end: new Date(end).toISOString(),
    stale: false,
    has_previous: true,
    tracks: SONGS.map(([title, artist, genre, movement, change, kind], i) => ({
      rank: i + 1, movement, rank_change: change, is_rising: Boolean(kind), rising_kind: kind,
      track: { id: `demo:${i + 1}`, provider: 'demo', providerTrackId: String(i + 1), title, artist, artwork: null, duration: 180, genre },
    })),
    artists: ['A', 'B', 'C', 'D', 'E', 'F'].map((l, i) => ({ rank: i + 1, name: `Demo Artist ${l}` })),
    genres: [
      { rank: 1, genre: 'Afrobeats', share_pct: 35 }, { rank: 2, genre: 'Hip-hop', share_pct: 25 },
      { rank: 3, genre: 'Gospel', share_pct: 20 }, { rank: 4, genre: 'Amapiano', share_pct: 15 }, { rank: 5, genre: 'Other', share_pct: 5 },
    ],
  }
}
const mk = (i, title, artist) => ({ id: `demo:${i}`, provider: 'demo', providerTrackId: String(i), title, artist, artwork: null, duration: 180, genre: null })

export function makeDemoWrapped() {
  const end = currentWeekStart()
  return {
    status: 'ok', campus: 'Demo Campus (DemoA)', weeks: 4, total: 12,
    period_start: new Date(end - 28 * DAY).toISOString(), period_end: new Date(end).toISOString(),
    song: { track: mk(1, 'Demo Song One', 'Demo Artist A'), weeks: 4, best_rank: 1 },
    staying: [
      { track: mk(2, 'Demo Song Two', 'Demo Artist B'), weeks: 3, best_rank: 2 },
      { track: mk(3, 'Demo Song Three', 'Demo Artist A'), weeks: 3, best_rank: 3 },
    ],
    newcomers: [{ track: mk(4, 'Demo Song Four', 'Demo Artist C'), best_rank: 4 }],
    artist: { name: 'Demo Artist A', songs: 3 },
  }
}

export function makeDemoBattle() {
  const end = currentWeekStart()
  return {
    status: 'ok', campus: 'Demo Campus (DemoA)', opponent: 'Demo University (DemoB)',
    period_start: new Date(end - 7 * DAY).toISOString(), period_end: new Date(end).toISOString(),
    my_songs: 14, their_songs: 14, shared_total: 5,
    shared: [
      { track: mk(1, 'Demo Song One', 'Demo Artist A'), my_rank: 1, their_rank: 2 },
      { track: mk(2, 'Demo Song Two', 'Demo Artist B'), my_rank: 2, their_rank: 4 },
    ],
    only_there: [{ track: mk(9, 'Demo Song Nine', 'Demo Artist F'), their_rank: 1 }],
  }
}
