import React, { useState, useEffect, useCallback } from 'react'
import { OfflineCache } from '../../../lib/music/OfflineCache'
import { MattchatProvider } from '../../../lib/music/providers/MattchatProvider'
import { IconDownload, IconCheck, IconTrash, IconLoader2 } from '../../Icons'

/**
 * Only render this for track.provider === 'mattchat' && track.isDownloadable —
 * other providers never resolve a download URL, so the button would just error.
 */
export default function DownloadButton({ track, size = 17 }) {
  const [status, setStatus] = useState('checking') // checking | none | downloading | done
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false
    OfflineCache.isDownloaded(track.id).then((yes) => {
      if (!cancelled) setStatus(yes ? 'done' : 'none')
    })
    return () => { cancelled = true }
  }, [track.id])

  const handleDownload = useCallback(async (e) => {
    e.stopPropagation()
    if (status === 'downloading') return
    if (status === 'done') {
      await OfflineCache.deleteDownload(track.id)
      setStatus('none')
      return
    }
    setStatus('downloading')
    setProgress(0)
    try {
      const url = await MattchatProvider.getDownloadUrl(track)
      if (!url) { setStatus('none'); return }
      await OfflineCache.downloadTrack(track, url, setProgress)
      setStatus('done')
    } catch {
      setStatus('none')
    }
  }, [status, track])

  if (status === 'checking') return null

  return (
    <button
      onClick={handleDownload}
      aria-label={status === 'done' ? 'Remove download' : 'Download for offline playback'}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer', padding: 6,
        color: status === 'done' ? '#a78bfa' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      }}
    >
      {status === 'downloading' && (
        <>
          <IconLoader2 size={size} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ position: 'absolute', bottom: -14, fontSize: 9, fontWeight: 700 }}>{progress}%</span>
        </>
      )}
      {status === 'done' && <IconCheck size={size} />}
      {status === 'none' && <IconDownload size={size} />}
    </button>
  )
}
