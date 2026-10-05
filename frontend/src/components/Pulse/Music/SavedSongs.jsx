import React, { useEffect, useState } from 'react'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { OfflineCache } from '../../../lib/music/OfflineCache'
import { useOnlineStatus } from '../../../hooks/useOnlineStatus'
import { IconMusic, IconPlay } from '../../Icons'

export default function SavedSongs({ colors }) {
  const { likedTracks, playTrack, currentTrack } = useMusicPlayer()
  const online = useOnlineStatus()
  const [downloadedIds, setDownloadedIds] = useState(new Set())

  useEffect(() => {
    const load = () => OfflineCache.listDownloads()
      .then((d) => setDownloadedIds(new Set(d.map((x) => x.id))))
      .catch(() => {})
    load()
    window.addEventListener('mattchat-downloads-changed', load)
    return () => window.removeEventListener('mattchat-downloads-changed', load)
  }, [])

  if (!likedTracks.length) return null

  const offlineReady = likedTracks.filter((t) => downloadedIds.has(t.id))
  const isPlayable = (t) => online || downloadedIds.has(t.id)
  const queueFor = (t) => (online ? likedTracks : offlineReady)

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>Saved songs</div>
          <div style={{ fontSize: 11.5, color: colors.textMuted }}>
            {likedTracks.length} saved · {offlineReady.length} available offline
          </div>
        </div>
        {offlineReady.length > 0 && (
          <button
            onClick={() => playTrack(offlineReady[0], offlineReady)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '7px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', color: '#fff' }}
          >
            <IconPlay size={12} /> Play offline songs
          </button>
        )}
      </div>

      {likedTracks.map((t) => {
        const playable = isPlayable(t)
        const downloaded = downloadedIds.has(t.id)
        return (
          <button
            key={t.id}
            onClick={() => playable && playTrack(t, queueFor(t))}
            disabled={!playable}
            title={playable ? '' : 'Needs an internet connection'}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '8px 4px',
              background: 'transparent', border: 'none', textAlign: 'left', fontFamily: 'inherit',
              cursor: playable ? 'pointer' : 'not-allowed', opacity: playable ? 1 : 0.45,
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {t.artwork ? <img src={t.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={16} style={{ color: colors.textMuted }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: currentTrack?.id === t.id ? '#a78bfa' : colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
              <div style={{ fontSize: 11.5, color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</div>
            </div>
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
              color: downloaded ? '#4ade80' : colors.textMuted,
              background: downloaded ? 'rgba(74,222,128,0.14)' : 'rgba(255,255,255,0.06)',
            }}>
              {downloaded ? 'OFFLINE ✓' : online ? 'ONLINE' : 'NEEDS INTERNET'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
