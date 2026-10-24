import { MusicService } from './MusicService'
import { OfflineCache } from './OfflineCache'
import { RelatedService } from './RelatedService'
import { YouTubeMusicProvider } from './providers/YouTubeMusicProvider'
import { isOnlineNow } from '../connectivity'

/**
 * lib/music/RadioEngine.js
 *
 * "Song radio": pick a song and the music that follows is *similar to it* -
 * never the list of search results you picked it from.
 *
 * Built from the publicly documented ingredients of music radio (it is NOT a copy of
 * Spotify's private system, whose recommendation endpoints are closed to new apps):
 *
 *   1. CANDIDATES  - songs like the seed, from three places, best first:
 *        a. RelatedService  (Deezer radio/related artists, optional Last.fm similar tracks)
 *        b. your own library (liked + recently played) for a little familiarity
 *        c. free providers (Audius/Jamendo) and ONE budgeted YouTube lookup, only if (a) is empty
 *   2. SCORING     - similarity, same-artist affinity, your taste, title keywords, minus
 *                    "quality" penalties (remix/live/slowed/cover...) and recent-skip penalties
 *   3. DIVERSITY   - artist spacing: never the same artist back to back, at most 2 per batch
 *   4. LEARNING    - skip a song quickly and that artist is down-ranked for days; finish it and it recovers
 *   5. RESOLVING   - candidates are only { artist, title } until the moment they are about to play.
 *                    Then they are matched to a playable track (cache -> Audius/Jamendo -> budgeted YouTube).
 *                    This keeps YouTube quota use (100 units per search!) as low as possible.
 *   6. OFFLINE     - with no connection the radio is built from songs saved in Mattchat.
 */

// ── tunables ──────────────────────────────────────────────
export const RADIO_CONFIG = {
  batch: 10,                 // songs added per refill
  maxPerArtist: 2,           // per refill
  resolveThreshold: 85,      // how sure we must be that a found track IS the wanted song
  youtubePerHour: 15,        // YouTube searches this device may spend per hour on radio
  resolvedCacheMax: 800,
  skipSeconds: 30,           // leaving before this counts as a skip
  skipHalfLifeDays: 3,
}

const KEY_RESOLVED = 'mattchat:music:radio:resolved'
const KEY_SIGNALS = 'mattchat:music:radio:signals'
const KEY_YT = 'mattchat:music:radio:yt'

const readJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb } catch { return fb } }
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage full/blocked */ } }
const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))

// ── text helpers ──────────────────────────────────────────
const STOP = new Set(['official', 'video', 'audio', 'lyrics', 'lyric', 'feat', 'ft', 'remix', 'live', 'hd', 'music', 'the', 'a', 'an', 'and', 'with', 'version', 'remastered', 'full', 'song', 'new'])
const BAD_TAGS = ['remix', 'live', 'cover', 'karaoke', 'instrumental', 'slowed', 'sped up', 'speed up', 'nightcore', '8d', 'reverb', 'mashup', 'loop', '1 hour', '10 hours', 'tribute']
const BAD_RE = new RegExp(`\\b(${BAD_TAGS.join('|')})\\b`, 'i')

export const norm = (s = '') => String(s).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
  .replace(/\b(feat|ft|featuring)\b\.?.*$/, ' ')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ').trim()

// "DJ PHAPHANE - Topic", "ArtistVEVO" -> "dj phaphane", "artist"
export const normArtist = (s = '') => norm(s).replace(/\b(topic|vevo|official)\b/g, ' ').replace(/([a-z0-9])vevo$/, '$1').replace(/\s+/g, ' ').trim()

const tokens = (s) => norm(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w))
const badTags = (s = '') => (String(s).toLowerCase().match(new RegExp(BAD_RE.source, 'gi')) || []).map((x) => x.toLowerCase())

// remix / live versions are different songs: keep that in the identity key
export const pairKey = (artist, title) => `${normArtist(artist)}|${norm(title)}|${[...new Set(badTags(title))].sort().join('+')}`
export const trackKey = (t) => pairKey(t?.artist, t?.title)

// ── skip / finish learning ────────────────────────────────
function readSignals() {
  const s = readJSON(KEY_SIGNALS, null)
  return s && typeof s === 'object' ? { skips: s.skips || {}, ids: s.ids || {} } : { skips: {}, ids: {} }
}

export function skipPenaltyFor(artist, now = Date.now(), signals = readSignals()) {
  const list = signals.skips[normArtist(artist)] || []
  const halfLife = RADIO_CONFIG.skipHalfLifeDays * 86400000
  return list.reduce((sum, ts) => sum + Math.pow(0.5, (now - ts) / halfLife), 0)
}

// ── scoring (pure) ────────────────────────────────────────
export function buildTaste({ recentlyPlayed = [], liked = [] } = {}) {
  const artists = new Map()
  recentlyPlayed.forEach((t, i) => {
    const a = normArtist(t.artist); if (!a) return
    artists.set(a, (artists.get(a) || 0) + 1 / (1 + i * 0.1))
  })
  liked.forEach((t) => {
    const a = normArtist(t.artist); if (!a) return
    artists.set(a, (artists.get(a) || 0) + 2)
  })
  return { artists, likedKeys: new Set(liked.map(trackKey)), likedIds: new Set(liked.map((t) => t.id)) }
}

export function scoreCandidate(c, ctx) {
  const { seed, taste, rand = Math.random, now = Date.now(), signals } = ctx
  let score = clamp01(c.base) * 40                                    // how similar the source says it is

  const ca = normArtist(c.artist)
  const sameArtist = ca && ca === normArtist(seed.artist)
  if (sameArtist) score += 18

  const tasteW = taste.artists.get(ca) || 0
  score += Math.min(10, tasteW * 4)                                   // artists you actually listen to
  if (taste.likedKeys.has(pairKey(c.artist, c.title))) score += 8

  const seedWords = new Set(tokens(seed.title))
  score += Math.min(12, tokens(c.title).filter((w) => seedWords.has(w)).length * 4)

  const seedBad = new Set(badTags(seed.title)); const candBad = badTags(c.title)
  if (candBad.some((t) => !seedBad.has(t))) score -= 25               // remix/live/slowed... unless the seed is one

  const d = c.duration || c.track?.duration || 0
  if (d && (d < 60 || d > 720)) score -= 30                           // snippets and hour-long loops

  score -= Math.min(40, skipPenaltyFor(c.artist, now, signals) * 20)  // you skipped them recently
  score += rand() * 6                                                 // jitter: not the same station every time
  return score
}

/** artist spacing + per-artist cap. Pure. */
export function diversify(scored, { limit, lastArtist = '', maxPerArtist = RADIO_CONFIG.maxPerArtist } = {}) {
  const pool = [...scored].sort((a, b) => b.score - a.score)
  const out = []
  const counts = new Map()
  let prev = normArtist(lastArtist)
  while (out.length < limit && pool.length) {
    let best = -1; let bestVal = -Infinity
    for (let i = 0; i < pool.length; i++) {
      const a = normArtist(pool[i].artist)
      const n = counts.get(a) || 0
      if (n >= maxPerArtist || a === prev) continue
      const val = pool[i].score - 14 * n                                // each repeat of an artist costs more
      if (val > bestVal) { bestVal = val; best = i }
    }
    if (best === -1) {
      // The cap blocked everything left: relax the cap but keep the spacing...
      for (let i = 0; i < pool.length; i++) {
        if (normArtist(pool[i].artist) !== prev && pool[i].score > bestVal) { bestVal = pool[i].score; best = i }
      }
      // ...and if only one artist is left at all, a short station beats an empty one: take the best remaining.
      if (best === -1) best = 0
    }
    const [pick] = pool.splice(best, 1)
    out.push(pick)
    const a = normArtist(pick.artist)
    counts.set(a, (counts.get(a) || 0) + 1)
    prev = a
  }
  return out
}

// ── candidates -> tracks ──────────────────────────────────
export const isPending = (t) => Boolean(t?.pending)

function toPending(c) {
  return {
    id: `radio:${pairKey(c.artist, c.title)}`, provider: 'pending', pending: true, providerTrackId: null,
    title: c.title, artist: c.artist, artistId: null, album: null, artwork: c.artwork || null,
    duration: c.duration || 0, streamUrl: null, isDownloadable: false, radioSource: c.source || 'related',
  }
}

// ── YouTube budget ────────────────────────────────────────
function takeYoutube() {
  const hour = Math.floor(Date.now() / 3600000)
  const b = readJSON(KEY_YT, { hour, n: 0 })
  const cur = b.hour === hour ? b : { hour, n: 0 }
  if (cur.n >= RADIO_CONFIG.youtubePerHour) return false
  writeJSON(KEY_YT, { hour, n: cur.n + 1 })
  return true
}

// ── session memory ────────────────────────────────────────
const playedKeys = new Set()
const memIndex = new Map() // pairKey -> playable track seen in any search this session
const failedAt = new Map() // pairKey -> when a lookup came up empty (don't pay for the same dead end twice)
const FAIL_TTL = 60 * 60 * 1000

// ── resolving ─────────────────────────────────────────────
export function matchQuality(found, want) {
  const fa = normArtist(found.artist); const wa = normArtist(want.artist)
  const ft = norm(found.title); const wtTokens = tokens(want.title)
  if (!wtTokens.length) return 0
  const artistOk = !!wa && (fa === wa || fa.includes(wa) || wa.includes(fa) || ft.includes(wa))
  const foundTokens = new Set(tokens(`${found.title} ${found.artist}`))
  const recall = wtTokens.filter((w) => foundTokens.has(w)).length / wtTokens.length
  const wantBad = new Set(badTags(want.title))
  const mismatch = badTags(found.title).some((t) => !wantBad.has(t)) ? 1 : 0
  return recall * 60 + (artistOk ? 30 : 0) - mismatch * 35
}

function pickBest(results, want) {
  let best = null; let bestQ = -Infinity
  for (const r of results) {
    const q = matchQuality(r, want)
    if (q > bestQ) { bestQ = q; best = r }
  }
  return bestQ >= RADIO_CONFIG.resolveThreshold ? best : null
}

const slim = ({ streamUrl, ...rest }) => rest

function remember(track) { memIndex.set(trackKey(track), track) }

async function searchFree(q) {
  const out = await Promise.all(['audius', 'jamendo'].map((provider) =>
    MusicService.search(q, { provider, limit: 6 }).then((r) => r.tracks || []).catch(() => [])))
  return out.flat()
}

// ── public API ────────────────────────────────────────────
export const RadioEngine = {
  isPending,

  resetSession() { playedKeys.clear(); failedAt.clear() },
  markPlayed(track) { if (track) playedKeys.add(trackKey(track)) },

  noteSkip(track, playedSeconds = 0) {
    if (!track?.artist || playedSeconds >= RADIO_CONFIG.skipSeconds) return
    const s = readSignals(); const a = normArtist(track.artist)
    const cutoff = Date.now() - 30 * 86400000
    s.skips[a] = [...(s.skips[a] || []).filter((ts) => ts > cutoff), Date.now()].slice(-12)
    s.ids[track.id] = Date.now()
    writeJSON(KEY_SIGNALS, s)
  },

  noteFinish(track) {                              // listening to the end earns the artist some forgiveness
    if (!track?.artist) return
    const s = readSignals(); const a = normArtist(track.artist)
    if (s.skips[a]?.length) { s.skips[a].shift(); writeJSON(KEY_SIGNALS, s) }
  },

  /**
   * @param {object} o
   * @param {object[]} o.seeds        [primary, ...secondary] seed tracks (primary = what's playing now)
   * @param {Set<string>} [o.excludeIds]
   * @param {object[]} [o.excludeTracks] songs already queued (matched by identity, so placeholders count too)
   * @param {object[]} [o.library]    recently played / liked tracks (real tracks)
   * @param {object[]} [o.liked]
   * @param {number} [o.limit]
   * @param {boolean} [o.online]
   * @param {string} [o.lastArtist]   artist of the song before the new batch, for spacing
   * @returns {Promise<object[]>} tracks (real, or `pending` placeholders that resolve() at play time)
   */
  async build({ seeds, excludeIds = new Set(), excludeTracks = [], library = [], liked = [], limit = RADIO_CONFIG.batch, online = isOnlineNow(), lastArtist = '', rand } = {}) {
    const list = (seeds || []).filter(Boolean)
    if (!list.length) return []
    const seed = list[0]
    const taste = buildTaste({ recentlyPlayed: library, liked })
    const signals = readSignals()

    const excludeKeys = new Set(excludeTracks.map(trackKey))
    const excluded = (c) => {
      const t = c.track
      if (t?.id && excludeIds.has(t.id)) return true
      const k = pairKey(c.artist, c.title)
      if (playedKeys.has(k) || excludeKeys.has(k)) return true
      return list.some((s) => trackKey(s) === k)
    }

    let candidates = []
    if (!online) {
      const saved = (await OfflineCache.listDownloads().catch(() => [])).map((d) => d.track).filter(Boolean)
      candidates = saved.map((t) => ({ artist: t.artist, title: t.title, duration: t.duration, track: t, source: 'offline', base: normArtist(t.artist) === normArtist(seed.artist) ? 0.8 : 0.4 }))
    } else {
      const remote = await Promise.all(list.map((s, i) => RelatedService.get(s).then((items) => ({ items, w: i === 0 ? 1 : 0.6 })).catch(() => ({ items: [], w: 0 }))))
      for (const { items, w } of remote) {
        for (const r of items) candidates.push({ artist: r.artist, title: r.title, artwork: r.artwork, duration: r.duration, source: r.source || 'related', base: clamp01(r.score ?? 0.5) * w })
      }

      // familiar songs: only ones that fit the station, so a few of YOUR songs mix in
      const relatedArtists = new Set(candidates.map((c) => normArtist(c.artist)))
      relatedArtists.add(normArtist(seed.artist))
      const familiar = [...liked, ...library].filter((t) => relatedArtists.has(normArtist(t.artist)) || taste.likedIds.has(t.id)).slice(0, 8)
      for (const t of familiar) candidates.push({ artist: t.artist, title: t.title, duration: t.duration, track: t, source: 'library', base: 0.3 })

      // Related data thin or missing (function not deployed, unknown artist)? Top up from the providers.
      // Free providers first; the single budgeted YouTube lookup only if that is STILL not enough.
      const need = Math.ceil(limit / 2)
      const remoteCount = () => candidates.filter((c) => c.source !== 'library' && c.source !== 'provider' && c.source !== 'youtube').length
      if (remoteCount() < need) {
        const free = await searchFree(seed.artist)
        for (const t of free) { remember(t); candidates.push({ artist: t.artist, title: t.title, duration: t.duration, artwork: t.artwork, track: t, source: 'provider', base: normArtist(t.artist) === normArtist(seed.artist) ? 0.55 : 0.3 }) }
        if (remoteCount() + free.length < need && takeYoutube()) {
          const yt = await YouTubeMusicProvider.searchTracks(seed.artist, { limit: 12 }).catch(() => [])
          for (const t of yt) { remember(t); candidates.push({ artist: t.artist, title: t.title, duration: t.duration, artwork: t.artwork, track: t, source: 'youtube', base: normArtist(t.artist) === normArtist(seed.artist) ? 0.5 : 0.25 }) }
        }
      }
    }

    // de-duplicate by song identity, keeping the strongest copy (and a playable one if we have it)
    const byKey = new Map()
    for (const c of candidates) {
      if (excluded(c)) continue
      const k = pairKey(c.artist, c.title)
      const prev = byKey.get(k)
      if (!prev || c.base > prev.base) byKey.set(k, { ...c, track: c.track || prev?.track })
      else if (!prev.track && c.track) prev.track = c.track
    }

    const ctx = { seed, taste, signals, rand }
    const scored = [...byKey.values()].map((c) => ({ ...c, score: scoreCandidate(c, ctx) }))
    const chosen = diversify(scored, { limit, lastArtist: lastArtist || seed.artist })
    return chosen.map((c) => c.track || toPending(c))
  },

  /** pending placeholder -> playable track, or null. Costs YouTube quota only as a last resort. */
  async resolve(pending) {
    if (!isPending(pending)) return pending
    const want = { artist: pending.artist, title: pending.title }
    const key = pairKey(want.artist, want.title)

    const cache = readJSON(KEY_RESOLVED, {})
    if (cache[key]) { const hit = cache[key]; delete cache[key]; cache[key] = hit; writeJSON(KEY_RESOLVED, cache); return hit.track }
    if (memIndex.has(key)) return memIndex.get(key)
    if (!isOnlineNow()) return null
    if (Date.now() - (failedAt.get(key) || 0) < FAIL_TTL) return null

    const q = `${want.artist} ${want.title}`
    let found = pickBest(await searchFree(q), want)
    if (!found && takeYoutube()) {
      const yt = await YouTubeMusicProvider.searchTracks(q, { limit: 6 }).catch(() => [])
      yt.forEach(remember)                           // one search teaches us several songs
      found = pickBest(yt, want)
    }
    if (!found) { failedAt.set(key, Date.now()); return null }

    const track = { ...slim(found), artwork: found.artwork || pending.artwork }
    cache[key] = { track, at: Date.now() }
    const keys = Object.keys(cache)
    if (keys.length > RADIO_CONFIG.resolvedCacheMax) keys.slice(0, keys.length - RADIO_CONFIG.resolvedCacheMax).forEach((k) => delete cache[k])
    writeJSON(KEY_RESOLVED, cache)
    return track
  },
}
