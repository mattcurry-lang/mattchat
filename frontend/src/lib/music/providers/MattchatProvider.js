import { supabase } from '../../supabase'

const AUDIO_BUCKET = 'mattchat-music-audio'
const COVER_BUCKET = 'mattchat-music-covers'
const SIGNED_URL_TTL = 60 * 30 // 30 min — long enough for a full track + some skipping around

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

  async streamTrack(track) {
    const { data: row, error } = await supabase
      .from('mattchat_tracks')
      .select('audio_path')
      .eq('id', track.providerTrackId || track.id)
      .single()
    if (error || !row) return null

    const { data: signed, error: signErr } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(row.audio_path, SIGNED_URL_TTL)
    if (signErr) return null

    // fire-and-forget — don't block playback on this
    supabase.rpc('increment_track_play', { p_track_id: track.providerTrackId || track.id }).then(() => {})

    return signed.signedUrl
  },

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
