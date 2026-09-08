import React from 'react'
import { useMusicPlayer } from '../../../context/MusicPlayerContext'
import { IconPlay, IconPause, IconMusic, IconX, IconChevronUp } from '../../Icons'

/**
 * components/Pulse/Music/MiniPlayer.jsx
 *
 * Mount this ONCE at the app shell level (sibling to your bottom nav),
 * not inside PulsePage — it needs to stay visible while the user is
 * in Chat, not just while they're in Pulse. It reads from the global
 * MusicPlayerContext, so it already reflects whatever is playing
 * regardless of which screen started it.
 */

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MiniPlayer({ onExpand, bottomOffset = 0 }) {
  const { currentTrack, isPlaying, isLoading, error, currentTime, duration, isMiniPlayerVisible, togglePlayPause, closeMiniPlayer } = useMusicPlayer()

  if (!isMiniPlayerVisible || !currentTrack) return null

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div
      style={{
        position: 'fixed', left: 0, right: 0, bottom: bottomOffset, zIndex: 500,
        background: 'var(--bg-surface-1, #14141f)', borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div style={{ height: 2, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#a78bfa,#6c63ff)', transition: 'width 0.2s linear' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', maxWidth: 640, margin: '0 auto' }}>
        <button
          onClick={onExpand}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
            background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {currentTrack.artwork ? (
              <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <IconMusic size={16} style={{ color: 'var(--text-muted)' }} />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {currentTrack.title}
            </div>
            <div style={{ fontSize: 11, color: error ? '#f87171' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {error || `${currentTrack.artist} · ${formatTime(currentTime)} / ${formatTime(duration)}`}
            </div>
          </div>
        </button>

        <button
          onClick={togglePlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          disabled={isLoading}
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isPlaying ? <IconPause size={15} /> : <IconPlay size={15} />}
        </button>

        <button
          onClick={onExpand}
          aria-label="Expand player"
          style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer',
            background: 'var(--bg-surface-2)', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IconChevronUp size={15} />
        </button>

        <button
          onClick={closeMiniPlayer}
          aria-label="Close player"
          style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer',
            background: 'transparent', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IconX size={14} />
        </button>
      </div>
    </div>
  )
}
