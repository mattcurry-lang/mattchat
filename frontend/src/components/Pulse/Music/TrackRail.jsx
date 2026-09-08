import React, { useState, useRef, useEffect } from 'react'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { IconMusic, IconHeart, IconMoreHorizontal, IconPlus, IconPlay } from '../../Icons'

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * components/Pulse/Music/TrackRail.jsx
 *
 * Generic "Recently Played" / "Liked Music" / "Trending" style rail.
 * Tapping a card plays it with the *rest of the rail* as queue
 * context, so e.g. tapping song 2 of "Recently Played" queues songs
 * 3, 4, 5... after it — matches how MusicSearch.jsx now passes
 * `tracks` as context to playTrack.
 */
export default function TrackRail({ title, tracks, emptyMessage }) {
  const { playTrack, currentTrack, isPlaying } = useMusicPlayer()

  if (!tracks || tracks.length === 0) {
    if (!emptyMessage) return null
    return (
      <div style={{ marginBottom: 22 }}>
        <RailHeader title={title} />
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '4px 2px' }}>{emptyMessage}</div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <RailHeader title={title} />
      <div
        style={{
          display: 'flex', gap: 12, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 4,
          WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
          overscrollBehaviorX: 'contain', touchAction: 'pan-x',
        }}
      >
        {tracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            isActive={currentTrack?.id === track.id}
            isPlaying={isPlaying && currentTrack?.id === track.id}
            onPress={() => playTrack(track, tracks)}
          />
        ))}
      </div>
    </div>
  )
}

function RailHeader({ title }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
      {title}
    </div>
  )
}

function TrackCard({ track, isActive, isPlaying, onPress }) {
  const { isLiked, toggleLike, addToQueue } = useMusicPlayer()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const liked = isLiked(track.id)
  const durationLabel = formatDuration(track.duration)

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  return (
    <div style={{ width: 128, flexShrink: 0, position: 'relative' }}>
      <button
        onClick={onPress}
        style={{
          width: 128, height: 128, borderRadius: 12, overflow: 'hidden', border: 'none', padding: 0,
          cursor: 'pointer', position: 'relative', background: 'var(--bg-surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          outline: isActive ? '2px solid #a78bfa' : 'none', outlineOffset: -2,
        }}
        aria-label={`Play ${track.title}`}
      >
        {track.artwork ? (
          <img src={track.artwork} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <IconMusic size={28} style={{ color: 'var(--text-muted)' }} />
        )}
        {isActive && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(15,15,26,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isPlaying ? <EqualizerBars /> : <IconPlay size={22} style={{ color: '#fff' }} />}
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); toggleLike(track) }}
          aria-label={liked ? 'Unlike' : 'Like'}
          style={{
            position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%',
            border: 'none', cursor: 'pointer', background: 'rgba(15,15,26,0.55)',
            color: liked ? '#f87171' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IconHeart size={13} filled={liked} />
        </button>
        {durationLabel && (
          <div style={{
            position: 'absolute', bottom: 6, right: 6, fontSize: 10, fontWeight: 700, color: '#fff',
            background: 'rgba(15,15,26,0.55)', borderRadius: 5, padding: '1px 5px',
          }}>
            {durationLabel}
          </div>
        )}
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 6 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {track.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {track.artist}
          </div>
        </div>

        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="More options"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
          >
            <IconMoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: 20, right: 0, zIndex: 20, minWidth: 140,
              background: '#1e1a30', border: '1px solid var(--border)', borderRadius: 10,
              boxShadow: '0 8px 20px rgba(0,0,0,0.35)', overflow: 'hidden',
            }}>
              <MenuItem icon={<IconPlus size={14} />} label="Add to queue" onClick={() => { addToQueue(track); setMenuOpen(false) }} />
              <MenuItem icon={<IconHeart size={14} filled={liked} />} label={liked ? 'Unlike' : 'Like'} onClick={() => { toggleLike(track); setMenuOpen(false) }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MenuItem({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)',
      }}
    >
      <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{icon}</span>
      {label}
    </button>
  )
}

function EqualizerBars() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 3, background: '#a78bfa', borderRadius: 2,
            animation: `mattchatEq 0.9s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes mattchatEq {
          0%, 100% { height: 5px; }
          50% { height: 16px; }
        }
      `}</style>
    </div>
  )
}
