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
    const cleanQuery = query?.trim().toLowerCase() || ''
    if (!cleanQuery) return { tracks: [], artists: [], albums: [] }

    const key = cacheKey(cleanQuery, opts)
    const cached = searchCache.get(key)
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.data

    // If an explicit provider was requested in options, search ONLY that provider
    if (opts.provider) {
      const providerInstance = getProvider(opts.provider)
      let data = { tracks: [], artists: [], albums: [] }
      try {
        if (providerInstance && typeof providerInstance.search === 'function') {
          const res = await providerInstance.search(cleanQuery, opts)
          if (res) {
            data.tracks = res.tracks || []
            data.artists = res.artists || []
            data.albums = res.albums || []
          }
        }
      } catch (err) {
        console.warn('[MusicService] Explicit provider search error:', err)
      }
      searchCache.set(key, { data, at: Date.now() })
      return data
    }

    // Execute searches concurrently
    let ytResults = { tracks: [], artists: [], albums: [] }
    let mattchatResults = { tracks: [], artists: [], albums: [] }

    try {
      if (YouTubeMusicProvider && typeof YouTubeMusicProvider.search === 'function') {
        const res = await YouTubeMusicProvider.search(cleanQuery, opts)
        if (res) {
          ytResults.tracks = res.tracks || []
          ytResults.artists = res.artists || []
          ytResults.albums = res.albums || []
        }
      }
    } catch (err) {
      console.warn('[MusicService] YouTube provider search failed:', err)
    }

    try {
      if (mattchatProviderAdapter && typeof mattchatProviderAdapter.search === 'function') {
        const res = await mattchatProviderAdapter.search(cleanQuery, opts)
        if (res) {
          mattchatResults.tracks = res.tracks || []
          mattchatResults.artists = res.artists || []
          mattchatResults.albums = res.albums || []
        }
      }
    } catch (err) {
      console.warn('[MusicService] Mattchat provider search failed:', err)
    }

    // FIX: Filter Mattchat results strictly. If the query is very short (< 3 chars) 
    // or doesn't actually match the track title/artist, drop it so it doesn't hijack 
    // the search with random default/featured uploads (like 24kGoldn).
    let filteredMattchatTracks = []
    if (cleanQuery.length >= 2) {
      filteredMattchatTracks = (mattchatResults.tracks || []).filter(track => {
        const title = (track.title || '').toLowerCase()
        const artist = (track.artist || '').toLowerCase()
        return title.includes(cleanQuery) || artist.includes(cleanQuery)
      })
    }

    // Combine results: YouTube primary suggestions first, followed by valid Mattchat matches
    const data = {
      tracks: [
        ...(ytResults.tracks || []),
        ...filteredMattchatTracks,
      ],
      artists: [
        ...(ytResults.artists || []),
        ...(mattchatResults.artists || []),
      ],
      albums: [
        ...(ytResults.albums || []),
        ...(mattchatResults.albums || []),
      ],
    }

    searchCache.set(key, { data, at: Date.now() })
    return data
  },

  async getTrending(opts = {}) {
    try {
      const provider = getProvider(opts.provider)
      return provider && typeof provider.getTrending === 'function' 
        ? await provider.getTrending(opts) 
        : { tracks: [] }
    } catch {
      return { tracks: [] }
    }
  },

  async getArtist(providerArtistId, opts = {}) {
    try {
      const provider = getProvider(opts.provider)
      return provider && typeof provider.getArtist === 'function' 
        ? await provider.getArtist(providerArtistId) 
        : null
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
      return provider && typeof provider.streamTrack === 'function' 
        ? await provider.streamTrack(track.providerTrackId) 
        : null
    } catch {
      return null
    }
  },

  getActiveProviderKey: () => activeProviderKey,
}
