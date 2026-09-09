import React from 'react'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { IconMusic, IconPlay, IconPause } from '../../Icons'

/**
 * components/Pulse/Music/MusicMessageBubble.jsx
 *
 * Renders a shared-song message inside a chat bubble (§20). Drop this
 * into wherever your message list switches on message type — e.g.:
 *
 *   {message.type === 'music'
 *     ? <MusicMessageBubble music={message.music} />
 *     : <TextMessageBubble ... />}
 *
 * `music` is the payload shape noted in ShareTrackSheet.jsx:
 *   { provider, providerTrackId, title, artist, artwork, duration }
 *
 * Tapping it plays the track through the same global player as
 * everything else — it does NOT open a separate mini audio player
 * inside the chat bubble, per §20/§30 (one playback system).
 */
export default function MusicMessageBubble({ music }) {
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = useMusicPlayer()

  if (!music) return null

  const track = {
    id: `${music.provider}:${music.providerTrackId}`,
    provider: music.provider,
    providerTrackId: music.providerTrackId,
    title: music.title,
    artist: music.artist,
    artwork: music.artwork,
    duration: music.duration || 0,
  }

  const isThisTrack = currentTrack?.id === track.id
  const isThisPlaying = isThisTrack && isPlaying

  const handlePress = () => {
    if (isThisTrack) togglePlayPause()
    else playTrack(track)
  }

  return (
    <button
      onClick={handlePress}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 260,
        background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.25)',
        borderRadius: 14, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
        background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {track.artwork ? (
          <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <IconMusic size={17} style={{ color: 'var(--text-muted)' }} />
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {track.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {track.artist}
        </div>
      </div>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isThisPlaying ? <IconPause size={13} /> : <IconPlay size={13} />}
      </div>
    </button>
  )
}
