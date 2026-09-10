import { MusicService } from './MusicService'

/**
 * lib/music/RecommendationEngine.js
 *
 * Original, metadata-based "keep playing similar music" engine —
 * NOT a reproduction of any streaming platform's proprietary system.
 * Uses only signals already available to us: artist name, title
 * keywords, and provider. This is the same category of technique
 * publicly described as "content-based similarity" — no private
 * algorithm, model, or reverse-engineered code involved.
 *
 * Purpose: when the queue runs out, generate a small batch of
 * related tracks so playback continues instead of just stopping —
 * the same *feel* as Spotify's autoplay, built independently.
 */

// Common filler words stripped before comparing titles, so
// "(Official Video)", "feat.", "Remix" etc. don't skew similarity.
const STOPWORDS = new Set([
  'official', 'video', 'audio', 'lyrics', 'lyric', 'feat', 'ft',
  'remix', 'live', 'hd', 'music', 'the', 'a', 'an', 'and', 'with',
])

function titleKeywords(title = '') {
  return title
    .toLowerCase()
    .replace(/[()[\]]/g, ' ')
    .split(/[\s\-–—.,!?]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

function scoreCandidate(candidate, seed, seedKeywords) {
  let score = 0

  // Strongest signal: same artist — this is the single biggest
  // driver of "this feels related" for a listener.
  if (candidate.artist && seed.artist && candidate.artist.toLowerCase() === seed.artist.toLowerCase()) {
    score += 50
  }

  // Secondary signal: shared title keywords (genre/mood words that
  // often appear in titles — "acoustic", "slow", "afrobeat", etc.)
  const candidateKeywords = titleKeywords(candidate.title)
  const overlap = candidateKeywords.filter((w) => seedKeywords.includes(w)).length
  score += overlap * 8

  // Mild same-provider boost — keeps playback within a source that's
  // already proven playable in this session (fewer "unavailable" hits)
  if (candidate.provider === seed.provider) score += 5

  return score
}

export const RecommendationEngine = {
  /**
   * Returns up to `limit` tracks related to `seedTrack`, excluding
   * anything in `excludeIds` (already played this session, or
   * already in the queue) so playback doesn't loop on itself.
   */
  async getSimilarTracks(seedTrack, excludeIds = new Set(), limit = 8) {
    if (!seedTrack) return []

    const seedKeywords = titleKeywords(seedTrack.title)
    const candidates = new Map()

    // Primary query: more from the same artist — cheapest, highest-
    // confidence signal available from existing search infrastructure.
    try {
      const byArtist = await MusicService.search(seedTrack.artist, { limit: 12 })
      for (const t of byArtist.tracks || []) {
        if (!excludeIds.has(t.id) && t.id !== seedTrack.id) candidates.set(t.id, t)
      }
    } catch { /* non-fatal — fall through to keyword search */ }

    // Secondary query: a keyword from the title, to widen the pool
    // beyond just the same artist (avoids "only ever this one artist")
    const keyword = seedKeywords[0]
    if (keyword) {
      try {
        const byKeyword = await MusicService.search(keyword, { limit: 10 })
        for (const t of byKeyword.tracks || []) {
          if (!excludeIds.has(t.id) && t.id !== seedTrack.id) candidates.set(t.id, t)
        }
      } catch { /* non-fatal */ }
    }

    const scored = Array.from(candidates.values())
      .map((t) => ({ track: t, score: scoreCandidate(t, seedTrack, seedKeywords) }))
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, limit).map((s) => s.track)
  },
}
