import { supabase } from '../supabase'
import { MusicService } from './MusicService'

const histKey = (uid) => `mattchat:music:history:${uid}`
const lastKey = (uid) => `mattchat:music:last:${uid}`
const mixKey  = (uid) => `mattchat:music:mixes:${uid}`

const read = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb } catch { return fb } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export const loadHistoryLocal = (uid) => read(histKey(uid), [])
export const loadLastPlayed = (uid) => read(lastKey(uid), null)
export const saveLastPlayed = (uid, track) => { if (uid && track) write(lastKey(uid), track) }
export const loadMixesLocal = (uid) => read(mixKey(uid), null)

// Counts as a "play" after 30s, same rule Spotify uses
export async function recordPlay(uid, track) {
  if (!uid || !track) return
  const hist = [{ track, played_at: new Date().toISOString() }, ...loadHistoryLocal(uid)].slice(0, 300)
  write(histKey(uid), hist)
  supabase.from('music_history').insert({ user_id: uid, track_id: track.id, track }).then(() => {})
}

export async function fetchHistory(uid, limit = 300) {
  const { data, error } = await supabase
    .from('music_history').select('track, played_at')
    .eq('user_id', uid).order('played_at', { ascending: false }).limit(limit)
  if (error) throw error
  write(histKey(uid), data)
  return data
}

const dedupe = (tracks) => {
  const seen = new Set()
  return tracks.filter(t => t?.id && !seen.has(t.id) && seen.add(t.id))
}
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5)

// Content-based "Daily Mix": your top artists (recent plays weigh more),
// plus fresh tracks found by searching each artist.
export async function buildDailyMixes(uid, history, maxMixes = 4) {
  const today = new Date().toDateString()
  const cached = loadMixesLocal(uid)
  if (cached && cached.day === today && cached.sourceCount === history.length) return cached.mixes
  if (history.length < 3) return []

  const score = {}
  history.forEach((h, i) => {
    const a = h.track.artist
    if (a) score[a] = (score[a] || 0) + 1 / (1 + i * 0.05)
  })
  const topArtists = Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, maxMixes).map(([a]) => a)

  const mixes = await Promise.all(topArtists.map(async (artist, i) => {
    const played = dedupe(history.filter(h => h.track.artist === artist).map(h => h.track))
    let discovered = []
    try { discovered = (await MusicService.search(artist, { limit: 15 })).tracks || [] } catch {}
    const tracks = dedupe([...played.slice(0, 5), ...shuffle(discovered)]).slice(0, 25)
    return {
      id: `mix-${i + 1}`,
      name: `Daily Mix ${i + 1}`,
      subtitle: [artist, ...topArtists.filter(a => a !== artist).slice(0, 2)].join(', ') + ' and more',
      tracks,
    }
  }))

  const result = mixes.filter(m => m.tracks.length > 0)
  write(mixKey(uid), { day: today, sourceCount: history.length, mixes: result })
  return result
}
