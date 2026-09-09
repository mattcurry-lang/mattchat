import { supabase } from '../../supabase'

const AUDIO_BUCKET = 'mattchat-music-audio'
const COVER_BUCKET = 'mattchat-music-covers'
const SIGNED_URL_TTL = 60 * 30 // 30 min

function normalize(row) {
  return {
    id: row.id,
    provider: 'mattchat',
    providerTrackId: row.id,
    title: row.title,
    artist: row.music_artists?.artist_name || 'Unknown artist',
    album: row.album,
    artwork: row.cover_path ? supabase.storage.from(COVER_BUCKET).getPublicUrl(row.cover_path).data.publicUrl : null,
    duration: row.duration_seconds,
    isDownloadable: row.is_downloadable,
  }
}

export const MattchatProvider = {
  async searchTracks(query, { limit = 10 } = {}) {
    const { data, error } = await supabase
      .from('mattchat_tracks')
      .select('*, music_artists(artist_name)')
      .eq('status', 'published')
      .or(`title.ilike.%${query}%,album.ilike.%${query}%`)
      .limit(limit)
    if (error) throw error
    return data.map(normalize)
  },

  async getTrack(trackId) {
    const { data, error } = await supabase
      .from('mattchat_tracks')
      .select('*, music_artists(artist_name)')
      .eq('id', trackId)
      .eq('status', 'published')
      .maybeSingle()
    if (error) throw error
    return data ? normalize(data) : null
  },

  // Matches the same signature every other provider's streamTrack uses in
  // MusicService (providerTrackId in, url out) so it drops into the generic path.
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

  async getTrending({ limit = 10 } = {}) {
    const { data, error } = await supabase
      .from('mattchat_tracks')
      .select('*, music_artists(artist_name)')
      .eq('status', 'published')
      .order('play_count', { ascending: false })
      .limit(limit)
    if (error) throw error
    return { tracks: data.map(normalize), artists: [], albums: [] }
  },

  async getArtist(artistId) {
    const { data, error } = await supabase.from('music_artists').select('*').eq('id', artistId).maybeSingle()
    if (error) throw error
    return data
  },

  // Full track object in, full track object required (not just an id) — called
  // directly by DownloadButton/ArtistDashboard, outside the MusicService routing.
  async getDownloadUrl(track) {
    const { data: row, error } = await supabase
      .from('mattchat_tracks')
      .select('audio_path, is_downloadable')
      .eq('id', track.providerTrackId || track.id)
      .single()
    if (error || !row || !row.is_downloadable) return null

    const { data: signed, error: signErr } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(row.audio_path, SIGNED_URL_TTL)
    if (signErr) return null

    await supabase.rpc('increment_track_download', { p_track_id: track.providerTrackId || track.id })
    return signed.signedUrl
  },
}

// Shaped to match `providers.audius` exactly (search/getTrending/getArtist/streamTrack)
// so it can be registered in MusicService's `providers` map with zero special-casing.
export const mattchatProviderAdapter = {
  search: (query, opts) => MattchatProvider.searchTracks(query, opts).then((tracks) => ({ tracks, artists: [], albums: [] })),
  getTrending: (opts) => MattchatProvider.getTrending(opts),
  getArtist: (id) => MattchatProvider.getArtist(id),
  streamTrack: (providerTrackId) => MattchatProvider.streamTrack(providerTrackId),
}
