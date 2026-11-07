// Development-only demo data for the Campus tab. Switched on by running the dev server and opening
// the app with ?campusDemo=1. In a production build import.meta.env.DEV is false, so this cannot run.
const DEV = (() => { try { return Boolean(import.meta.env && import.meta.env.DEV) } catch { return false } })()
const EAT_MS = 3 * 3600 * 1000
const DAY = 86400000

export function demoEnabled() {
  if (!DEV || typeof window === 'undefined') return false
  try { return new URLSearchParams(window.location.search).get('campusDemo') === '1' } catch { return false }
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
  ['Demo Song Ten', 'Demo Artist D', 'Amapiano', 'up', 1, null],
  ['Demo Song Eleven', 'Demo Artist E', null, 'new', null, null],
  ['Demo Song Twelve', 'Demo Artist F', 'R&B', 'down', -4, null],
]

export function makeDemoChart() {
  const end = currentWeekStart()
  const start = end - 7 * DAY
  return {
    status: 'ok',
    campus: 'Demo campus (made-up data)',
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
