import { mattchatProviderAdapter } from './providers/MattchatProvider'
import { YouTubeMusicProvider } from './providers/YouTubeMusicProvider'
import { OfflineCache } from './OfflineCache'

/**
 * lib/music/MusicService.js
 *
 * UI  →  MusicService  →  Provider Adapter  →  Provider API
 *
 * Configured exclusively for YouTube Music and Mattchat catalog.
 */

let activeProviderKey = 'youtube'

export function setActiveProvider(key) {
  if (getProvider(key)) activeProviderKey = key
}

function getProvider(key) {
  switch (key || activeProviderKey) {
    case 'youtube':
      return YouTubeMusicProvider
    case 'mattchat':
      return mattchatProviderAdapter
    default:
      return null
  }
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

    if (opts.provider) {
      try {
        const provider = getProvider(opts.provider)
        const data = provider ? await provider.search(query, opts) : { tracks: [], artists: [], albums: [] }
        searchCache.set(key, { data, at: Date.now() })
        return data
      } catch (err) {
        console.warn('[MusicService] Explicit provider search error:', err)
        return { tracks: [], artists: [], albums: [] }
      }
    }

    const external = getProvider(activeProviderKey) || YouTubeMusicProvider

    // Run searches independently. Even if the YouTube Edge Function returns a 500 error, 
    // Mattchat results will still load successfully instead of crashing the entire view.
    const [externalResults, mattchatResults] = await Promise.all([
      external.search(query, opts).catch((err) => {
        console.warn('[MusicService] YouTube Edge Function error (500/Network):', err?.message || err)
        return { tracks: [], artists: [], albums: [] }
      }),
      activeProviderKey === 'mattchat' 
        ? Promise.resolve({ tracks: [], artists: [], albums: [] }) 
        : mattchatProviderAdapter.search(query, opts).catch((err) => {
            console.warn('[MusicService] Mattchat search failed:', err)
            return { tracks: [], artists: [], albums: [] }
          }),
    ])

    const data = {
      tracks: [
        ...(externalResults?.tracks || []),
        ...(mattchatResults?.tracks || []),
      ],
      artists: [
        ...(externalResults?.artists || []),
        ...(mattchatResults?.artists || []),
      ],
      albums: [
        ...(externalResults?.albums || []),
        ...(mattchatResults?.albums || []),
      ],
    }

    searchCache.set(key, { data, at: Date.now() })
    return data
  },

  async getTrending(opts = {}) {
    try {
      const provider = getProvider(opts.provider)
      return provider ? await provider.getTrending(opts) : { tracks: [] }
    } catch {
      return { tracks: [] }
    }
  },

  async getArtist(providerArtistId, opts = {}) {
    try {
      const provider = getProvider(opts.provider)
      return provider ? await provider.getArtist(providerArtistId) : null
    } catch {
      return null
    }
  },

  /**
   * Resolves a playable URL for a track.
   */
  async resolveStreamUrl(track) {
    if (!track) return null
    const offline = await OfflineCache.getBlobUrl(track.id).catch(() => null)
    if (offline) return offline

    if (track.streamUrl) return track.streamUrl

    try {
      const provider = getProvider(track.provider)
      return provider ? await provider.streamTrack(track.providerTrackId) : null
    } catch {
      return null
    }
  },

  getActiveProviderKey: () => activeProviderKey,
}
