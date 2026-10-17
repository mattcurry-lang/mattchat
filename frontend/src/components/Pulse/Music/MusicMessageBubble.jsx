import React, { useEffect, useState } from 'react'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { OfflineCache } from '../../../lib/music/OfflineCache'
import { useOnlineStatus } from '../../../hooks/useOnlineStatus'
import { IconPlay, IconPause, IconCheck, IconLoader2 } from '../../Icons'
import TrackArt from './TrackArt'

export default function MusicMessageBubble({ music }) {
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = useMusicPlayer()
  const online = useOnlineStatus()
  const [saved, setSaved] = useState(false)

  const id = music ? `${music.provider}:${music.providerTrackId}` : null
  const downloadable = Boolean(music?.isDownloadable)

  useEffect(() => {
    if (!id) return undefined
    let cancelled = false
    const check = () => OfflineCache.isDownloaded(id).then((y) => { if (!cancelled) setSaved(y) }).catch(() => {})
    check()
    window.addEventListener('mattchat-downloads-changed', check)
    return () => { cancelled = true; window.removeEventListener('mattchat-downloads-changed', check) }
  }, [id])

  if (!music) return null

  const track = {
    id,
    provider: music.provider,
    providerTrackId: music.providerTrackId,
    title: music.title,
    artist: music.artist,
    artwork: music.artwork,
    duration: music.duration || 0,
    isDownloadable: downloadable,
  }

  const isThisTrack = currentTrack?.id === track.id
  const isThisPlaying = isThisTrack && isPlaying
  const unplayable = !online && !saved

  const handlePress = () => {
    if (isThisTrack) togglePlayPause()
    else playTrack(track, null, { origin: 'chat' })   // 'chat' = keep it for offline
  }

  let note = null
  if (saved) note = { text: 'Available offline', color: '#4ade80', icon: <IconCheck size={10} /> }
  else if (unplayable) note = { text: 'Needs internet', color: 'var(--text-muted)' }
  else if (downloadable && isThisPlaying) note = { text: 'Saving for offline…', color: '#a78bfa', icon: <IconLoader2 size={10} style={{ animation: 'mcBubbleSpin 1s linear infinite' }} /> }
  else if (downloadable) note = { text: 'Saves offline once played', color: 'var(--text-muted)' }

  return (
    <button
      onClick={handlePress}
      disabled={unplayable}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 270,
        background: 'rgba(167,139,250,0.10)', border: `1px solid ${saved ? 'rgba(74,222,128,0.35)' : 'rgba(167,139,250,0.25)'}`,
        borderRadius: 14, padding: '10px 12px', cursor: unplayable ? 'not-allowed' : 'pointer', textAlign: 'left',
        opacity: unplayable ? 0.6 : 1, fontFamily: 'inherit',
      }}
    >
      <style>{`@keyframes mcBubbleSpin{to{transform:rotate(360deg)}}`}</style>
      <TrackArt src={track.artwork} size={42} radius={10} iconSize={17} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {track.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {track.artist}
        </div>
        {note && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 10, fontWeight: 700, color: note.color }}>
            {note.icon}{note.text}
          </div>
        )}
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
