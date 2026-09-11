import { supabase } from '../supabase'
import { makeTrackId } from './MusicProvider'

/**
 * lib/music/RingtoneService.js
 *
 * Lets a user pick a track from the existing music library and use
 * it as their personal Mattchat ringtone. Scoped to Audius +
 * Mattchat-artist tracks only — YouTube tracks play through the
 * hidden IFrame player, which isn't reliable to trigger during a
 * call-ringing overlay, so they're excluded from ringtone selection.
 *
 * Playback here is fully independent of MusicPlayerContext's <audio>
 * element — a ringtone needs to be able to play even if the user is
 * already listening to something else, so it gets its own <audio>
 * instance rather than touching the main player's state.
 */

let ringtoneAudio = null
function getRingtoneAudioEl() {
  if (!ringtoneAudio && typeof Audio !== 'undefined') {
    ringtoneAudio = new Audio()
    ringtoneAudio.loop = true
  }
  return ringtoneAudio
}

export const RingtoneService = {
  async getMyRingtone(userId) {
    if (!userId) return null
    const { data, error } = await supabase
      .from('music_ringtone_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      id: makeTrackId(data.provider, data.provider_track_id),
      provider: data.provider,
      providerTrackId: data.provider_track_id,
      title: data.title,
      artist: data.artist,
      artwork: data.artwork_url,
    }
  },

  async setRingtone(userId, track) {
    if (!userId || !track) throw new Error('Missing user or track')
    if (track.provider === 'youtube') {
      throw new Error('YouTube tracks can\u2019t be used as a ringtone yet \u2014 pick an Audius or Mattchat artist track')
    }
    const { error } = await supabase
      .from('music_ringtone_preferences')
      .upsert({
        user_id: userId,
        provider: track.provider,
        provider_track_id: track.providerTrackId,
        title: track.title,
        artist: track.artist,
        artwork_url: track.artwork,
        updated_at: new Date().toISOString(),
      })
    if (error) throw error
  },

  async clearRingtone(userId) {
    if (!userId) return
    const { error } = await supabase
      .from('music_ringtone_preferences')
      .delete()
      .eq('user_id', userId)
    if (error) throw error
  },

  /**
   * Resolves and plays the user's chosen ringtone on loop. Call this
   * from wherever your incoming-call UI currently starts its default
   * tone. Falls back silently (returns false) if the user has no
   * ringtone set or the track can't be resolved, so callers can
   * fall back to a default tone.
   */
async playRingtone(track) {
  if (!track) return false
  const audio = getRingtoneAudioEl()
  if (!audio) return false
  try {
    const { MusicService } = await import('./MusicService') // lazy — breaks any load-order cycle
    const url = await MusicService.resolveStreamUrl(track)
    if (!url) return false
    audio.src = url
    audio.currentTime = 0
    await audio.play()
    return true
  } catch {
    return false
  }
},

  stopRingtone() {
    if (ringtoneAudio) {
      ringtoneAudio.pause()
      ringtoneAudio.currentTime = 0
    }
  },

  /** Preview a track for a few seconds while picking, without setting it yet. */
  async previewTrack(track, durationMs = 8000) {
    const played = await this.playRingtone(track)
    if (!played) return
    setTimeout(() => this.stopRingtone(), durationMs)
  },
}
