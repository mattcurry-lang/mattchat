import React from 'react'
import DownloadButton from './DownloadButton'
import { IconDownload } from '../../Icons'

// Providers whose tracks can legitimately be downloaded (when the track allows it)
const DOWNLOADABLE_PROVIDERS = ['mattchat', 'audius', 'jamendo']

export default function TrackDownloadAction({ track, size = 16 }) {
  if (!track) return null

  // Mattchat artist uploads, Audius and Jamendo: real download into Mattchat offline storage
  if (track.isDownloadable && DOWNLOADABLE_PROVIDERS.includes(track.provider)) {
    return <DownloadButton track={track} size={size} />
  }

  // Mainstream (YouTube): hand off to YouTube Music's own offline feature
  if (track.provider === 'youtube') {
    return (
      <a
        href={`https://music.youtube.com/watch?v=${track.providerTrackId}`}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        title="Download with YouTube Music Premium"
        aria-label="Download with YouTube Music Premium"
        style={{ display: 'flex', alignItems: 'center', padding: 6, color: 'var(--text-muted)', textDecoration: 'none' }}
      >
        <IconDownload size={size} />
      </a>
    )
  }

  return null
}
