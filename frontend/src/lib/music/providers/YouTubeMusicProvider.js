import { supabase } from '../../supabase'

/**
 * lib/music/providers/YouTubeMusicProvider.js
 *
 * "Mainstream" source — searches YouTube's Music category for
 * official-audio uploads so mainstream/chart artists show up in
 * results. All actual YouTube Data API calls happen server-side in
 * the `youtube-music` Supabase Edge Function, which holds the real
 * API key (YOUTUBE_API_KEY secret) — this file never touches that
 * key directly, it just calls the Edge Function.
 *
 * Playback itself is NOT handled here — MusicPlayerContext checks
 * track.provider === 'youtube' and routes to YouTubeEngine.js, which
 * plays back through YouTube's own hidden IFrame player. This file
 * only ever returns metadata (title, artist, artwork, duration).
 */

export const YouTubeMusicProvider = {
  key: 'youtube',

  async search(query, opts = {}) {
    const tracks = await this.searchTracks(query, opts)
    return { tracks, artists: [], albums: [] } // no separate artist/channel search wired up yet
  },

  async searchTracks(query, { limit = 12 } = {}) {
    if (!query?.trim()) return []
    try {
      const { data, error } = await supabase.functions.invoke('youtube-music', {
        body: { action: 'search', query, limit },
      })
      if (error) throw error
      return data?.tracks || []
    } catch (err) {
      console.error('[YouTubeMusicProvider] search failed', err)
      return []
    }
  },

  async searchArtists() {
    return []
  },

  async searchAlbums() {
    return []
  },

  async getTrack() {
    return null // not needed — tracks resolve straight from search
  },

  async getArtist() {
    return null
  },

  async getTrending({ limit = 15, regionCode = 'US' } = {}) {
    try {
      const { data, error } = await supabase.functions.invoke('youtube-music', {
        body: { action: 'trending', limit, regionCode },
      })
      if (error) throw error
      return data?.tracks || []
    } catch (err) {
      console.error('[YouTubeMusicProvider] trending failed', err)
      return []
    }
  },

  // Never resolves a raw URL — MusicPlayerContext checks
  // track.provider === 'youtube' and routes to YouTubeEngine instead
  // of calling this at all. Kept here only so the provider shape
  // matches Audius/Mattchat for registration in MusicService.
  async streamTrack() {
    return null
  },
}
