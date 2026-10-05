import React from 'react'
import TrackDownloadMenu from './TrackDownloadMenu'

export default function TrackDownloadAction({ track, size = 16 }) {
  if (!track) return null
  return <TrackDownloadMenu track={track} size={size} />
}
