/**
 * lib/music/MusicProvider.js
 *
 * Abstract provider interface. Every music source (Audius, Spotify,
 * Boomplay, Mattchat's own catalog...) implements this shape.
 * The UI never talks to a provider directly — it only ever talks to
 * MusicService, which delegates to whichever provider is active.
 *
 * NORMALIZED TRACK MODEL — every provider must return tracks shaped
 * like this so the UI never has to know which provider it came from:
 *
 * {
 *   id: string,                // internal id, e.g. `${provider}:${providerTrackId}`
 *   provider: string,          // 'audius' | 'spotify' | 'boomplay' | 'mattchat'
 *   providerTrackId: string,   // the raw id from that provider
 *   title: string,
 *   artist: string,
 *   artistId: string | null,
 *   album: string | null,
 *   artwork: string | null,    // artwork URL
 *   duration: number,          // seconds
 *   streamUrl: string | null,  // may be null — resolved lazily via streamTrack()
 *   isDownloadable: boolean,
 * }
 */

export class MusicProvider {
  /** @type {string} unique provider key, e.g. 'audius' */
  key = 'base'

  /** @returns {Promise<{tracks: Array, albums: Array, artists: Array}>} */
  async search(_query, _opts) {
    throw new Error(`${this.key}: search() not implemented`)
  }

  async searchTracks(_query, _opts) {
    throw new Error(`${this.key}: searchTracks() not implemented`)
  }

  async searchArtists(_query, _opts) {
    throw new Error(`${this.key}: searchArtists() not implemented`)
  }

  async searchAlbums(_query, _opts) {
    throw new Error(`${this.key}: searchAlbums() not implemented`)
  }

  async getTrack(_providerTrackId) {
    throw new Error(`${this.key}: getTrack() not implemented`)
  }

  async getArtist(_providerArtistId) {
    throw new Error(`${this.key}: getArtist() not implemented`)
  }

  async getAlbum(_providerAlbumId) {
    throw new Error(`${this.key}: getAlbum() not implemented`)
  }

  async getTrending(_opts) {
    throw new Error(`${this.key}: getTrending() not implemented`)
  }

  /**
   * Resolve a playable stream URL for a track. Some providers can
   * return this directly in search results; others (rights-restricted)
   * need a separate signed-URL call. Must return null (not throw) if
   * the track cannot be streamed — the UI is expected to handle that
   * gracefully ("Track unavailable").
   * @returns {Promise<string|null>}
   */
  async streamTrack(_providerTrackId) {
    throw new Error(`${this.key}: streamTrack() not implemented`)
  }
}

export function makeTrackId(provider, providerTrackId) {
  return `${provider}:${providerTrackId}`
}
