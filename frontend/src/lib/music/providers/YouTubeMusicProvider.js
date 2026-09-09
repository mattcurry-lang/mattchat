/**
 * lib/music/providers/YouTubeMusicProvider.js
 *
 * "Mainstream" source — searches YouTube's Music category for
 * official-audio uploads so mainstream/chart artists show up in
 * results. This is legal because we're playing back an official,
 * licensed upload through YouTube's own embedded player (IFrame API,
 * see YouTubeEngine.js) — we never extract or rehost the audio file
 * itself, which is what actually requires a label deal.
 */

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY
const BASE = 'https://www.googleapis.com/youtube/v3'
const MUSIC_CATEGORY_ID = '10'

function parseISODuration(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '')
  if (!m) return 0
  const [, h, min, s] = m
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0)
}

function normalizeSearchItem(item) {
  return {
    id: `youtube:${item.id.videoId}`,
    provider: 'youtube',
    providerTrackId: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    artistId: item.snippet.channelId || null,
    album: null,
    artwork: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || null,
    duration: 0, // filled in by hydrateDurations()
    streamUrl: null, // playback goes through YouTubeEngine, never a direct URL
    isDownloadable: false,
  }
}

// search.list doesn't return duration — needs a second call to videos.list
async function hydrateDurations(tracks) {
  const ids = tracks.map((t) => t.providerTrackId).filter(Boolean)
  if (!ids.length) return tracks
  const url = `${BASE}/videos?part=contentDetails&id=${ids.join(',')}&key=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) return tracks
  const json = await res.json()
  const byId = {}
  for (const v of json.items || []) byId[v.id] = parseISODuration(v.contentDetails?.duration)
  return tracks.map((t) => ({ ...t, duration: byId[t.providerTrackId] || 0 }))
}

export const YouTubeMusicProvider = {
  key: 'youtube',

  async search(query, opts = {}) {
    const tracks = await this.searchTracks(query, opts)
    return { tracks, artists: [], albums: [] } // no separate artist/channel search wired up yet
  },

  async searchTracks(query, { limit = 12 } = {}) {
    if (!query?.trim() || !API_KEY) return []
    const q = encodeURIComponent(`${query} official audio`)
    const url = `${BASE}/search?part=snippet&type=video&videoCategoryId=${MUSIC_CATEGORY_ID}&maxResults=${limit}&q=${q}&key=${API_KEY}`
    try {
      const res = await fetch(url)
      if (!res.ok) return []
      const json = await res.json()
      const tracks = (json.items || []).map(normalizeSearchItem)
      return hydrateDurations(tracks)
    } catch {
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
    if (!API_KEY) return []
    const url = `${BASE}/videos?part=snippet,contentDetails&chart=mostPopular&videoCategoryId=${MUSIC_CATEGORY_ID}&regionCode=${regionCode}&maxResults=${limit}&key=${API_KEY}`
    try {
      const res = await fetch(url)
      if (!res.ok) return []
      const json = await res.json()
      return (json.items || []).map((v) => ({
        id: `youtube:${v.id}`,
        provider: 'youtube',
        providerTrackId: v.id,
        title: v.snippet.title,
        artist: v.snippet.channelTitle,
        artistId: v.snippet.channelId || null,
        album: null,
        artwork: v.snippet.thumbnails?.high?.url || null,
        duration: parseISODuration(v.contentDetails?.duration),
        streamUrl: null,
        isDownloadable: false,
      }))
    } catch {
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
