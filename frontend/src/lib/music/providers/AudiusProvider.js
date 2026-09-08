import { MusicProvider, makeTrackId } from '../MusicProvider'

/**
 * lib/music/providers/AudiusProvider.js
 *
 * Audius is a fully open, permissionless music protocol — no OAuth,
 * no paid-tier account requirement (unlike the Spotify integration,
 * which stalled on Spotify's "app owner needs Premium" policy).
 * Good fit for Phase 1: real streamable tracks, zero credential setup.
 *
 * Docs: https://audiusproject.github.io/api-docs/
 *
 * Audius is a decentralized network of "discovery nodes" — there's no
 * single fixed base URL. We ask api.audius.co for a healthy host list
 * once, cache it, and fall back to the next host on failure.
 */

const APP_NAME = 'mattchat'
const HOST_DIRECTORY_URL = 'https://api.audius.co'
const FALLBACK_HOSTS = [
  'https://discoveryprovider.audius.co',
  'https://discoveryprovider2.audius.co',
  'https://discoveryprovider3.audius.co',
]

let cachedHosts = null
let cachedHostsAt = 0
const HOST_CACHE_MS = 10 * 60 * 1000

async function getHosts() {
  const isFresh = cachedHosts && Date.now() - cachedHostsAt < HOST_CACHE_MS
  if (isFresh) return cachedHosts

  try {
    const res = await fetch(HOST_DIRECTORY_URL)
    if (!res.ok) throw new Error('host directory unavailable')
    const json = await res.json()
    const hosts = Array.isArray(json?.data) && json.data.length ? json.data : FALLBACK_HOSTS
    cachedHosts = hosts
    cachedHostsAt = Date.now()
    return hosts
  } catch {
    cachedHosts = FALLBACK_HOSTS
    cachedHostsAt = Date.now()
    return FALLBACK_HOSTS
  }
}

/**
 * Try each known host in turn until one responds. Audius nodes are
 * independently operated and any single one can be slow/down, so we
 * don't want one bad node to mean "Music is temporarily unavailable"
 * for the whole app.
 */
async function fetchWithFallback(path, params = {}) {
  const hosts = await getHosts()
  const qs = new URLSearchParams({ app_name: APP_NAME, ...params }).toString()

  let lastError = null
  for (const host of hosts.slice(0, 4)) {
    try {
      const res = await fetch(`${host}${path}?${qs}`)
      if (!res.ok) throw new Error(`${host} responded ${res.status}`)
      const json = await res.json()
      return { json, host }
    } catch (err) {
      lastError = err
      continue
    }
  }
  throw lastError || new Error('All Audius hosts failed')
}

function toDurationSeconds(track) {
  return typeof track.duration === 'number' ? track.duration : 0
}

function bestArtwork(artworkObj) {
  if (!artworkObj) return null
  return artworkObj['480x480'] || artworkObj['150x150'] || artworkObj['1000x1000'] || null
}

function normalizeTrack(t) {
  return {
    id: makeTrackId('audius', t.id),
    provider: 'audius',
    providerTrackId: t.id,
    title: t.title,
    artist: t.user?.name || 'Unknown Artist',
    artistId: t.user?.id || null,
    album: null, // Audius tracks aren't grouped into albums the way Spotify tracks are
    artwork: bestArtwork(t.artwork),
    duration: toDurationSeconds(t),
    streamUrl: null, // resolved lazily via streamTrack() — keeps search results light
    isDownloadable: Boolean(t.downloadable),
  }
}

function normalizeArtist(u) {
  return {
    id: `audius:${u.id}`,
    provider: 'audius',
    providerArtistId: u.id,
    name: u.name,
    handle: u.handle,
    avatar: bestArtwork(u.profile_picture) || u.cover_photo?.['640x'] || null,
    followers: u.follower_count ?? 0,
    isVerified: Boolean(u.is_verified),
  }
}

export class AudiusProvider extends MusicProvider {
  key = 'audius'

  async search(query, opts = {}) {
    const [tracks, artists] = await Promise.all([
      this.searchTracks(query, opts),
      this.searchArtists(query, opts),
    ])
    return { tracks, artists, albums: [] } // Audius has no native "album" search endpoint
  }

  async searchTracks(query, { limit = 20 } = {}) {
    if (!query?.trim()) return []
    const { json } = await fetchWithFallback('/v1/tracks/search', { query, limit: String(limit) })
    return (json?.data || []).map(normalizeTrack)
  }

  async searchArtists(query, { limit = 10 } = {}) {
    if (!query?.trim()) return []
    const { json } = await fetchWithFallback('/v1/users/search', { query, limit: String(limit) })
    return (json?.data || []).map(normalizeArtist)
  }

  async searchAlbums() {
    return [] // not supported by Audius; provider abstraction just returns empty
  }

  async getTrack(providerTrackId) {
    const { json } = await fetchWithFallback(`/v1/tracks/${providerTrackId}`, {})
    return json?.data ? normalizeTrack(json.data) : null
  }

  async getArtist(providerArtistId) {
    const { json } = await fetchWithFallback(`/v1/users/${providerArtistId}`, {})
    return json?.data ? normalizeArtist(json.data) : null
  }

  async getAlbum() {
    return null
  }

  async getTrending({ genre, limit = 20 } = {}) {
    const params = { limit: String(limit) }
    if (genre) params.genre = genre
    const { json } = await fetchWithFallback('/v1/tracks/trending', params)
    return (json?.data || []).map(normalizeTrack)
  }

  /**
   * Audius streaming is a direct, unauthenticated redirect URL per
   * track — no separate token exchange needed.
   */
  async streamTrack(providerTrackId) {
    try {
      const hosts = await getHosts()
      const host = hosts[0]
      return `${host}/v1/tracks/${providerTrackId}/stream?app_name=${APP_NAME}`
    } catch {
      return null
    }
  }
}

export const audiusProvider = new AudiusProvider()
