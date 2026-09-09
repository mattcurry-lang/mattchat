import { audiusProvider } from './providers/AudiusProvider'
import { mattchatProviderAdapter } from './providers/MattchatProvider'
import { OfflineCache } from './OfflineCache'

/**
 * lib/music/MusicService.js
 *
 * UI  →  MusicService  →  Provider Adapter  →  Provider API
 *
 * The UI imports ONLY this file, never a provider directly. Mattchat's
 * own catalog (Phase 4) is now registered here and merged into every
 * search alongside whichever external provider is active — Mattchat
 * artists surface first, Audius (or Spotify/Boomplay in Phase 5) fills
 * the rest. When Spotify/Boomplay come online they register the same
 * way, with routing decided here, not in the UI.
 */

const providers = {
  audius: audiusProvider,
  mattchat: mattchatProviderAdapter,
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

    // Explicit provider request (e.g. opts.provider === 'mattchat') bypasses
    // the merge and behaves exactly like before — single provider, no overlay.
    if (opts.provider) {
      const data = await getProvider(opts.provider).search(query, opts)
      searchCache.set(key, { data, at: Date.now() })
      return data
    }

    const external = getProvider(activeProviderKey)
    const [externalResults, mattchatResults] = await Promise.all([
      external.search(query, opts),
      activeProviderKey === 'mattchat' ? Promise.resolve(null) : mattchatProviderAdapter.search(query, opts).catch(() => ({ tracks: [] })),
    ])

    const data = {
      tracks: mattchatResults ? [...mattchatResults.tracks, ...externalResults.tracks] : externalResults.tracks,
      artists: externalResults.artists || [],
      albums: externalResults.albums || [],
    }
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
   *
   * Offline-first: any track that was downloaded (currently only ever
   * Mattchat-provider tracks, since isDownloadable gates it) plays
   * straight from IndexedDB with zero network round trip.
   */
  async resolveStreamUrl(track) {
    if (track.streamUrl) return track.streamUrl

    const offline = await OfflineCache.getBlobUrl(track.id).catch(() => null)
    if (offline) return offline

    try {
      const provider = getProvider(track.provider)
      return await provider.streamTrack(track.providerTrackId)
    } catch {
      return null
    }
  },

  getActiveProviderKey: () => activeProviderKey,
}
