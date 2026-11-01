// src/lib/curryMediaFlow.js
// Finds what Curry was asked to play and builds Curry's reply message.
//
//   songs   MusicService.search() merges your Mattchat catalogue, Jamendo, YouTube Music
//           and the active provider. We re-rank by how well title + artist match what was
//           asked, because the merged list is ordered by SOURCE, not relevance.
//   videos  your youtube-search function; videos that can't be embedded are skipped
//           (they would show "Video unavailable" in the player).
//
// buildMediaReply(request, { session, userText }) -> an assistant message:
//   { role: 'assistant', content, media: { kind, query, tracks | videos, approximate } | null,
//     speak: true }                       on success
//   { role: 'assistant', content, error: true, retryText }      on failure

import { MusicService } from './music/MusicService'
import { searchYouTube } from './supabase'
import { fetchYouTubeOEmbed } from './youtube'
import { isValidVideoId } from './youtubeThumb'

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

// ── ranking ──────────────────────────────────────────────
// A result is "relevant" when at least 60% of the words you typed appear in its title or artist.
export const RELEVANT_RATIO = 0.6

export function rankTracks(tracks, query, { preferProvider = null } = {}) {
  const q = norm(query)
  const words = q.split(' ').filter(Boolean)
  const seen = new Set()
  const scored = []
  ;(tracks || []).forEach((t, index) => {
    if (!t || !t.title) return
    const key = `${norm(t.artist)}|${norm(t.title)}`
    if (seen.has(key)) return                       // the same song from two providers appears once
    seen.add(key)
    const hay = norm(`${t.artist} ${t.title}`)
    const hits = words.filter((w) => hay.includes(w)).length
    scored.push({
      track: t,
      ratio: words.length ? hits / words.length : 0,
      artistHit: q && norm(t.artist).includes(q) ? 1 : 0,
      preferred: preferProvider && t.provider === preferProvider ? 1 : 0,
      index,
    })
  })
  scored.sort((a, b) => b.ratio - a.ratio || b.artistHit - a.artistHit || b.preferred - a.preferred || a.index - b.index)
  return scored
}

export async function findSongs(query, { limit = 3, preferProvider = null, search } = {}) {
  const run = search || ((q) => MusicService.search(q))
  const data = await run(query)
  const ranked = rankTracks(data?.tracks, query, { preferProvider })
  const relevant = ranked.filter((r) => r.ratio >= RELEVANT_RATIO)
  const pool = relevant.length ? relevant : ranked      // nothing matched well: show the closest and say so
  return { tracks: pool.slice(0, limit).map((r) => r.track), approximate: relevant.length === 0 && ranked.length > 0 }
}

export async function findVideos(session, query, { limit = 3, search, oembed } = {}) {
  const run = search || ((s, q) => searchYouTube(s, q))
  const check = oembed || fetchYouTubeOEmbed
  const res = await run(session, query)
  const list = (res && res.ok ? res.results || [] : []).filter((v) => v && isValidVideoId(v.videoId))
  const candidates = list.slice(0, limit * 2)
  const results = await Promise.all(candidates.map((v) => Promise.resolve(check(v.videoId)).then((d) => !!d).catch(() => false)))
  // If NOTHING passed, the check itself probably failed (offline?) rather than every video being blocked.
  const playable = results.some(Boolean) ? candidates.filter((_, i) => results[i]) : candidates
  return playable.slice(0, limit)
}

// ── Curry's reply ────────────────────────────────────────
const QUOTE = (s) => `“${s}”`

export async function buildMediaReply(req, { session, userText, songs = findSongs, videos = findVideos } = {}) {
  const speakable = (content, media) => ({ role: 'assistant', content, media, speak: true })

  if (!req.query) {
    const what = req.kind === 'video' ? 'a video' : 'a song'
    return speakable(`Which artist or ${req.kind === 'video' ? 'topic' : 'song'}? Try ${req.kind === 'video' ? '“show me a video of how to tie a tie”' : '“play Overload by Luh Kel”'} and I’ll find ${what} for you.`, null)
  }

  try {
    if (req.kind === 'video') {
      const found = await videos(session, req.query, { limit: req.plural ? 4 : 3 })
      if (!found.length) return speakable(`I couldn’t find a video for ${QUOTE(req.query)}. Try different words.`, null)
      const content = found.length === 1 || !req.plural ? `Here’s a video for ${QUOTE(req.query)}.` : `Here are some videos for ${QUOTE(req.query)}.`
      return speakable(content, { kind: 'video', query: req.query, videos: found })
    }

    const { tracks, approximate } = await songs(req.query, { limit: req.plural ? 5 : 3, preferProvider: req.source === 'youtube' ? 'youtube' : null })
    if (!tracks.length) return speakable(`I couldn’t find ${QUOTE(req.query)}. Try the artist and song name together, like “Overload Luh Kel”.`, null)
    const top = tracks[0]
    let content
    if (approximate) content = `I couldn’t find an exact match for ${QUOTE(req.query)}, but these are close.`
    else if (req.plural) content = `Here are some songs for ${QUOTE(req.query)}.`
    else content = `Here’s ${QUOTE(top.title)} by ${top.artist}.${tracks.length > 1 ? ` I found ${tracks.length - 1} more below.` : ''}`
    return speakable(content, { kind: 'song', query: req.query, tracks, approximate })
  } catch (e) {
    console.error('Curry media search failed:', e)
    return { role: 'assistant', content: 'I couldn’t search for that right now. Check your connection and try again.', error: true, retryText: userText || req.query }
  }
}
