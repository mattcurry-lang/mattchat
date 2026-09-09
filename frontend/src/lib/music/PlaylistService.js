import { supabase } from '../supabase'

/**
 * lib/music/PlaylistService.js
 *
 * UI talks to this file, never to `supabase.from('music_playlists')`
 * directly — same "one layer of indirection" pattern as MusicService
 * for providers. RLS (music_schema.sql) enforces ownership; this file
 * just shapes requests/responses.
 */

function normalizeTrackRow(row) {
  return {
    id: `${row.provider}:${row.provider_track_id}`,
    provider: row.provider,
    providerTrackId: row.provider_track_id,
    title: row.title,
    artist: row.artist,
    artwork: row.artwork_url,
    duration: row.duration_seconds || 0,
    // playlist-specific extras, harmless for the player to ignore
    _playlistTrackRowId: row.id,
    _addedAt: row.added_at,
  }
}

export const PlaylistService = {
  async listPlaylists(userId) {
    if (!userId) return []
    const { data, error } = await supabase
      .from('music_playlists')
      .select('id, name, description, artwork_url, is_public, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data
  },

  async createPlaylist(userId, name) {
    const { data, error } = await supabase
      .from('music_playlists')
      .insert({ user_id: userId, name: name.trim() })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async renamePlaylist(playlistId, name) {
    const { error } = await supabase
      .from('music_playlists')
      .update({ name: name.trim() })
      .eq('id', playlistId)
    if (error) throw error
  },

  async deletePlaylist(playlistId) {
    const { error } = await supabase
      .from('music_playlists')
      .delete()
      .eq('id', playlistId)
    if (error) throw error
  },

  async getPlaylistTracks(playlistId) {
    const { data, error } = await supabase
      .from('music_playlist_tracks')
      .select('*')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true })
    if (error) throw error
    return data.map(normalizeTrackRow)
  },

  /** Auto-generates playlist artwork client-side from the first track added, if the playlist has none yet. */
  async addTrack(playlistId, track) {
    const { data: existing, error: countErr } = await supabase
      .from('music_playlist_tracks')
      .select('position')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: false })
      .limit(1)
    if (countErr) throw countErr

    const nextPosition = existing.length ? existing[0].position + 1 : 0

    const { error } = await supabase
      .from('music_playlist_tracks')
      .insert({
        playlist_id: playlistId,
        provider: track.provider,
        provider_track_id: track.providerTrackId,
        title: track.title,
        artist: track.artist,
        artwork_url: track.artwork,
        duration_seconds: track.duration || null,
        position: nextPosition,
      })
    // Unique-constraint violation just means "already in this playlist" — not a real error.
    if (error && error.code !== '23505') throw error

    if (nextPosition === 0 && track.artwork) {
      await supabase
        .from('music_playlists')
        .update({ artwork_url: track.artwork })
        .eq('id', playlistId)
        .is('artwork_url', null)
    }
  },

  async removeTrack(playlistTrackRowId) {
    const { error } = await supabase
      .from('music_playlist_tracks')
      .delete()
      .eq('id', playlistTrackRowId)
    if (error) throw error
  },
}
