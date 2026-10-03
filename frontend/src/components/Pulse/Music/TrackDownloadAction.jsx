import React from 'react'
import DownloadButton from './DownloadButton'
import { IconDownload } from '../../Icons'

export default function TrackDownloadAction({ track, size = 16 }) {
  if (!track) return null

  // Mattchat Artist uploads: real download (offline in Mattchat + save to device)
  if (track.provider === 'mattchat' && track.isDownloadable) {
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
