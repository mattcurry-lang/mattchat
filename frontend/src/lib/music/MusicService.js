import { audiusProvider } from './providers/AudiusProvider'

/**
 * lib/music/MusicService.js
 *
 * UI  →  MusicService  →  Provider Adapter  →  Provider API
 *
 * The UI imports ONLY this file, never a provider directly. When
 * Spotify/Boomplay/Mattchat's own catalog come online (Phase 5),
 * they register here and this file decides routing — e.g. "prefer
 * Mattchat catalog, fall back to Audius" — without any UI changes.
 */

const providers = {
  audius: audiusProvider,
}

let activeProviderKey = 'audius'

export function setActiveProvider(key) {
  if (providers[key]) activeProviderKey = key
}

function getProvider(key) {
  return providers[key || activeProviderKey]
}

// Tiny in-memory cache so retyping/backspacing during a debounced
// search doesn't refire identical network requests.
const searchCache = new Map()
const CACHE_MS = 60 * 1000

function cacheKey(query, opts) {
  return `${activeProviderKey}:${query.trim().toLowerCase()}:${JSON.stringify(opts)}`
}

export const MusicService = {
  async search(query, opts = {}) {
    if (!query?.trim()) return { tracks: [], artists: [], albums: [] }
    const key = cacheKey(query, opts)
    const cached = searchCache.get(key)
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.data

    const provider = getProvider(opts.provider)
    const data = await provider.search(query, opts)
    searchCache.set(key, { data, at: Date.now() })
    return data
  },

  async getTrending(opts = {}) {
    const provider = getProvider(opts.provider)
    return provider.getTrending(opts)
  },

  async getArtist(providerArtistId, opts = {}) {
    const provider = getProvider(opts.provider)
    return provider.getArtist(providerArtistId)
  },

  /**
   * Resolves a playable URL for a track, filling it in on the track
   * object if it wasn't already present from search results.
   * Returns null (never throws) if the track can't be streamed so
   * the player can show "Track unavailable" instead of crashing.
   */
  async resolveStreamUrl(track) {
    if (track.streamUrl) return track.streamUrl
    try {
      const provider = getProvider(track.provider)
      return await provider.streamTrack(track.providerTrackId)
    } catch {
      return null
    }
  },

  getActiveProviderKey: () => activeProviderKey,
}
