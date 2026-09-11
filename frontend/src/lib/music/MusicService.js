import { audiusProvider } from './providers/AudiusProvider'
import { mattchatProviderAdapter } from './providers/MattchatProvider'
import { YouTubeMusicProvider } from './providers/YouTubeMusicProvider'
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
 *
 * NOTE: provider lookup is intentionally LAZY (a function, not a
 * module-scope object literal). Some providers import this file back
 * (e.g. to call setActiveProvider), which makes this a circular
 * import. Building `{ audius: audiusProvider, ... }` at module load
 * time reads those bindings before the cycle has finished resolving,
 * which throws "Cannot access '<name>' before initialization". Doing
 * the lookup inside a function defers it until call time, by which
 * point every module involved has finished initializing.
 */

let activeProviderKey = 'audius'

export function setActiveProvider(key) {
  if (getProvider(key)) activeProviderKey = key
}

function getProvider(key) {
  switch (key || activeProviderKey) {
    case 'audius':
      return audiusProvider
    case 'mattchat':
      return mattchatProviderAdapter
    case 'youtube':
      return YouTubeMusicProvider
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
      const data = await getProvider(opts.provider).search(query, opts)
      searchCache.set(key, { data, at: Date.now() })
      return data
    }

    const external = getProvider(activeProviderKey)
    const [externalResults, mattchatResults, youtubeResults] = await Promise.all([
      external.search(query, opts),
      activeProviderKey === 'mattchat' ? Promise.resolve(null) : mattchatProviderAdapter.search(query, opts).catch(() => ({ tracks: [] })),
      YouTubeMusicProvider.search(query, { limit: 8 }).catch(() => ({ tracks: [] })),
    ])

    const data = {
      // Mattchat artists first (your own catalog), then mainstream
      // YouTube results, then whichever external provider is active
      tracks: [
        ...(mattchatResults ? mattchatResults.tracks : []),
        ...youtubeResults.tracks,
        ...externalResults.tracks,
      ],
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
