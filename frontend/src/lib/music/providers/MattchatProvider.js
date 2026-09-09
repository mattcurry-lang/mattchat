import { supabase } from '../../supabase'
import { makeTrackId } from '../MusicProvider'

const AUDIO_BUCKET = 'mattchat-music-audio'
const COVER_BUCKET = 'mattchat-music-covers'
const SIGNED_URL_TTL = 60 * 30 // 30 min

function coverUrl(coverPath) {
  return coverPath ? supabase.storage.from(COVER_BUCKET).getPublicUrl(coverPath).data.publicUrl : null
}

function normalizeTrack(row) {
  return {
    id: makeTrackId('mattchat', row.id),
    provider: 'mattchat',
    providerTrackId: row.id,
    title: row.title,
    artist: row.music_artists?.artist_name || 'Unknown artist',
    artistId: row.artist_id || null,
    album: row.album,
    artwork: coverUrl(row.cover_path),
    duration: row.duration_seconds,
    streamUrl: null, // resolved lazily via streamTrack(), same as Audius
    isDownloadable: row.is_downloadable,
  }
}

function normalizeArtist(row) {
  return {
    id: `mattchat:${row.id}`,
    provider: 'mattchat',
    providerArtistId: row.id,
    name: row.artist_name,
    handle: null,
    avatar: row.avatar_url,
    followers: 0,
    isVerified: false,
  }
}

export const MattchatProvider = {
  key: 'mattchat',

  async search(query, opts = {}) {
    const [tracks, artists] = await Promise.all([
      this.searchTracks(query, opts),
      this.searchArtists(query, opts),
    ])
    return { tracks, artists, albums: [] }
  },

  async searchTracks(query, { limit = 10 } = {}) {
    if (!query?.trim()) return []
    const { data, error } = await supabase
      .from('mattchat_tracks')
      .select('*, music_artists(artist_name)')
      .eq('status', 'published')
      .or(`title.ilike.%${query}%,album.ilike.%${query}%`)
      .limit(limit)
    if (error) throw error
    return data.map(normalizeTrack)
  },

  async searchArtists(query, { limit = 5 } = {}) {
    if (!query?.trim()) return []
    const { data, error } = await supabase
      .from('music_artists')
      .select('*')
      .eq('status', 'active')
      .ilike('artist_name', `%${query}%`)
      .limit(limit)
    if (error) return []
    return data.map(normalizeArtist)
  },

  async searchAlbums() {
    return [] // Mattchat tracks aren't grouped into albums yet
  },

  async getTrack(providerTrackId) {
    const { data, error } = await supabase
      .from('mattchat_tracks')
      .select('*, music_artists(artist_name)')
      .eq('id', providerTrackId)
      .eq('status', 'published')
      .maybeSingle()
    if (error) throw error
    return data ? normalizeTrack(data) : null
  },

  async getArtist(providerArtistId) {
    const { data, error } = await supabase.from('music_artists').select('*').eq('id', providerArtistId).maybeSingle()
    if (error) throw error
    return data ? normalizeArtist(data) : null
  },

  async getAlbum() {
    return null
  },

  // Matches Audius's shape: bare array of tracks, not {tracks, artists, albums}.
  async getTrending({ limit = 20 } = {}) {
    const { data, error } = await supabase
      .from('mattchat_tracks')
      .select('*, music_artists(artist_name)')
      .eq('status', 'published')
      .order('play_count', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data.map(normalizeTrack)
  },

  // Same signature as AudiusProvider.streamTrack: raw providerTrackId in, url out.
  async streamTrack(providerTrackId) {
    const { data: row, error } = await supabase
      .from('mattchat_tracks')
      .select('audio_path')
      .eq('id', providerTrackId)
      .eq('status', 'published')
      .single()
    if (error || !row) return null

    const { data: signed, error: signErr } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(row.audio_path, SIGNED_URL_TTL)
    if (signErr) return null

    supabase.rpc('increment_track_play', { p_track_id: providerTrackId }).then(() => {})
    return signed.signedUrl
  },

  // Called directly (not through MusicService) by DownloadButton/ArtistDashboard —
  // takes the full track object since it needs isDownloadable, but always looks
  // the row up by providerTrackId, never the composite id.
  async getDownloadUrl(track) {
    const providerTrackId = track.providerTrackId || track.id
    const { data: row, error } = await supabase
      .from('mattchat_tracks')
      .select('audio_path, is_downloadable')
      .eq('id', providerTrackId)
      .single()
    if (error || !row || !row.is_downloadable) return null

    const { data: signed, error: signErr } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(row.audio_path, SIGNED_URL_TTL)
    if (signErr) return null

    await supabase.rpc('increment_track_download', { p_track_id: providerTrackId })
    return signed.signedUrl
  },
}

// Shaped to match `providers.audius` exactly (search/getTrending/getArtist/streamTrack)
// so it registers in MusicService's `providers` map with zero special-casing.
export const mattchatProviderAdapter = {
  key: 'mattchat',
  search: (query, opts) => MattchatProvider.search(query, opts),
  getTrending: (opts) => MattchatProvider.getTrending(opts),
  getArtist: (id) => MattchatProvider.getArtist(id),
  streamTrack: (providerTrackId) => MattchatProvider.streamTrack(providerTrackId),
}
