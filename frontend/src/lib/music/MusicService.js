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

    // If an explicit provider was requested in options, search ONLY that provider
    if (opts.provider) {
      const providerInstance = getProvider(opts.provider)
      const data = providerInstance
        ? await providerInstance.search(query, opts).catch(() => ({ tracks: [], artists: [], albums: [] }))
        : { tracks: [], artists: [], albums: [] }
      searchCache.set(key, { data, at: Date.now() })
      return data
    }

    // Determine the external/active provider
    const externalProvider = getProvider(activeProviderKey)

    // Execute searches concurrently for active provider and Mattchat catalog
    const [externalResults, mattchatResults] = await Promise.all([
      externalProvider
        ? externalProvider.search(query, opts).catch((err) => {
            console.warn('[MusicService] External search error:', err)
            return { tracks: [], artists: [], albums: [] }
          })
        : Promise.resolve({ tracks: [], artists: [], albums: [] }),
      
      // Always pull Mattchat catalog unless activeProviderKey is already explicitly 'mattchat'
      activeProviderKey === 'mattchat'
        ? Promise.resolve({ tracks: [], artists: [], albums: [] })
        : mattchatProviderAdapter.search(query, opts).catch((err) => {
            console.warn('[MusicService] Mattchat search error:', err)
            return { tracks: [], artists: [], albums: [] }
          }),
    ])

    // Combine tracks, artists, and albums from both catalog sources
    const data = {
      tracks: [
        ...(mattchatResults?.tracks || []),
        ...(externalResults?.tracks || []),
      ],
      artists: [
        ...(mattchatResults?.artists || []),
        ...(externalResults?.artists || []),
      ],
      albums: [
        ...(mattchatResults?.albums || []),
        ...(externalResults?.albums || []),
      ],
    }

    searchCache.set(key, { data, at: Date.now() })
    return data
  },

  async getTrending(opts = {}) {
    const provider = getProvider(opts.provider)
    return provider ? provider.getTrending(opts) : { tracks: [] }
  },

  async getArtist(providerArtistId, opts = {}) {
    const provider = getProvider(opts.provider)
    return provider ? provider.getArtist(providerArtistId) : null
  },

  /**
   * Resolves a playable URL for a track.
   */
  async resolveStreamUrl(track) {
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
