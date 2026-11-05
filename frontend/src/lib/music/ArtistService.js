import { supabase } from '../supabase'

const AUDIO_BUCKET = 'mattchat-music-audio'
const COVER_BUCKET = 'mattchat-music-covers'

// Resolves public URLs through your local Vercel proxy so Brave Shields won't block them
function coverUrl(coverPath) {
  if (!coverPath) return null
  const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(coverPath)
  if (!data?.publicUrl) return null
  
  // Convert direct .supabase.co URLs to local proxy paths to keep Brave Shields happy
  return data.publicUrl.replace(/^https:\/\/[^/]+\.supabase\.co/, '/api/supabase')
}

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // 25MB — matches the storage bucket limit
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/x-m4a']

function extFor(file) {
  const fromName = file.name?.split('.').pop()
  if (fromName) return fromName.toLowerCase()
  return (file.type.split('/')[1] || 'mp3').replace('x-', '')
}

function readAudioDuration(file) {
  return new Promise((resolve) => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src)
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0)
    }
    audio.onerror = () => resolve(0)
    audio.src = URL.createObjectURL(file)
  })
}

export const ArtistService = {
  async getMyArtistProfile(userId) {
    const { data, error } = await supabase
      .from('music_artists')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  // Self-serve, auto-approved — the insert IS the approval.
  async applyAsArtist(userId, { artistName, bio = '', avatarFile = null }) {
    const trimmed = artistName.trim()
    if (!trimmed) throw new Error('Artist name is required')

    let avatarUrl = null
    if (avatarFile) {
      const path = `${userId}/avatar-${Date.now()}.${extFor(avatarFile)}`
      const { error: upErr } = await supabase.storage.from(COVER_BUCKET).upload(path, avatarFile, { upsert: true })
      if (upErr) throw upErr
      const rawUrl = supabase.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl
      avatarUrl = rawUrl?.replace(/^https:\/\/[^/]+\.supabase\.co/, '/api/supabase')
    }

    const { data, error } = await supabase
      .from('music_artists')
      .insert({ user_id: userId, artist_name: trimmed, bio, avatar_url: avatarUrl })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async uploadTrack(artistId, { title, album = null, audioFile, coverFile = null, publish = true }) {
    if (!audioFile) throw new Error('An audio file is required')
    if (audioFile.size > MAX_AUDIO_BYTES) throw new Error('Audio files are limited to 25MB')
    if (!ALLOWED_AUDIO_TYPES.includes(audioFile.type)) throw new Error('Unsupported audio format')

    const trimmedTitle = title.trim()
    if (!trimmedTitle) throw new Error('Title is required')

    const trackId = crypto.randomUUID()
    const { data: artistRow, error: artistErr } = await supabase
      .from('music_artists').select('user_id').eq('id', artistId).single()
    if (artistErr) throw artistErr
    const userId = artistRow.user_id

    const audioPath = `${userId}/${trackId}.${extFor(audioFile)}`
    const { error: audioUpErr } = await supabase.storage.from(AUDIO_BUCKET).upload(audioPath, audioFile)
    if (audioUpErr) throw audioUpErr

    let coverPath = null
    if (coverFile) {
      coverPath = `${userId}/${trackId}-cover.${extFor(coverFile)}`
      const { error: coverUpErr } = await supabase.storage.from(COVER_BUCKET).upload(coverPath, coverFile)
      if (coverUpErr) throw coverUpErr
    }

    const duration = await readAudioDuration(audioFile)

    const { data, error } = await supabase
      .from('mattchat_tracks')
      .insert({
        id: trackId,
        artist_id: artistId,
        title: trimmedTitle,
        album,
        audio_path: audioPath,
        cover_path: coverPath,
        duration_seconds: duration,
        file_size_bytes: audioFile.size,
        mime_type: audioFile.type,
        status: publish ? 'published' : 'draft',
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async listMyTracks(artistId) {
    const { data, error } = await supabase
      .from('mattchat_tracks')
      .select('*')
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false })
    if (error) throw error

    if (data.length === 0) return data
    const { data: likeRows } = await supabase
      .from('music_likes')
      .select('provider_track_id')
      .eq('provider', 'mattchat')
      .in('provider_track_id', data.map((t) => t.id))
    const likeCounts = {}
    for (const row of likeRows || []) likeCounts[row.provider_track_id] = (likeCounts[row.provider_track_id] || 0) + 1

    return data.map((t) => ({ ...t, like_count: likeCounts[t.id] || 0, cover_url: coverUrl(t.cover_path) }))
  },

  // Helper method to query related tracks via the Vercel proxy route
  async getRelatedTracks(artist, title, limit = 40) {
    const res = await fetch('/api/supabase/functions/v1/music-related', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist, title, limit }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to fetch related tracks')
    return data
  },

  async setTrackStatus(trackId, status) {
    const { error } = await supabase.from('mattchat_tracks').update({ status, updated_at: new Date().toISOString() }).eq('id', trackId)
    if (error) throw error
  },

  async deleteTrack(track) {
    if (track.audio_path) await supabase.storage.from(AUDIO_BUCKET).remove([track.audio_path])
    if (track.cover_path) await supabase.storage.from(COVER_BUCKET).remove([track.cover_path])
    const { error } = await supabase.from('mattchat_tracks').delete().eq('id', track.id)
    if (error) throw error
  },
}
