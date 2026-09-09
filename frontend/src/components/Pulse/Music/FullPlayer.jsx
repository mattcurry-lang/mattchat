import React, { useState, useRef } from 'react'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import {
  IconPlay, IconPause, IconSkipBack, IconSkipForward, IconChevronDown,
  IconShuffle, IconRepeat, IconHeart, IconShare2, IconListMusic,
  IconVolume2, IconMusic,
} from '../../Icons'
import QueueDrawer from './QueueDrawer'
import ShareTrackSheet from './ShareTrackSheet'
import DownloadButton from './DownloadButton'

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * components/Pulse/Music/FullPlayer.jsx
 *
 * Mount this conditionally from wherever you track `showFullPlayer`
 * (the same place that renders <MiniPlayer onExpand={...} />). It
 * reads the same global MusicPlayerContext, so it's just a bigger
 * view onto the same playback state — no separate audio element.
 *
 *   {showFullPlayer && <FullPlayer onClose={() => setShowFullPlayer(false)} />}
 */
export default function FullPlayer({ onClose, conversations = [], onShareTrack }) {
  const {
    currentTrack, isPlaying, isLoading, error, currentTime, duration, volume,
    togglePlayPause, seekTo, setVolume, playNext, playPrevious,
    shuffle, toggleShuffle, repeatMode, cycleRepeat,
    isLiked, toggleLike, isQueueVisible, setIsQueueVisible, queue,
  } = useMusicPlayer()

  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubValue, setScrubValue] = useState(0)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const barRef = useRef(null)

  if (!currentTrack) return null

  const progress = duration > 0
    ? (isScrubbing ? scrubValue : currentTime) / duration * 100
    : 0
  const liked = isLiked(currentTrack.id)

  const handleScrubStart = (e) => {
    setIsScrubbing(true)
    updateScrub(e)
  }
  const updateScrub = (e) => {
    if (!barRef.current || !duration) return
    const rect = barRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    setScrubValue(ratio * duration)
  }
  const handleScrubMove = (e) => { if (isScrubbing) updateScrub(e) }
  const handleScrubEnd = () => {
    if (isScrubbing) seekTo(scrubValue)
    setIsScrubbing(false)
  }

  const openShareSheet = () => setShareSheetOpen(true)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 700,
        background: 'linear-gradient(180deg, #1a1530 0%, #0f0f1a 60%)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      onMouseMove={handleScrubMove}
      onMouseUp={handleScrubEnd}
      onTouchMove={handleScrubMove}
      onTouchEnd={handleScrubEnd}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
        <button
          onClick={onClose}
          aria-label="Minimize player"
          style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <IconChevronDown size={18} />
        </button>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Now Playing
        </div>
        <button
          onClick={() => setIsQueueVisible(true)}
          aria-label="View queue"
          style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
        >
          <IconListMusic size={17} />
          {queue.length > 1 && (
            <span style={{ position: 'absolute', top: -2, right: -2, fontSize: 9, fontWeight: 800, background: '#a78bfa', color: '#0f0f1a', borderRadius: 8, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
              {queue.length}
            </span>
          )}
        </button>
      </div>

      {/* artwork */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', minHeight: 0 }}>
        <div style={{
          width: '100%', maxWidth: 320, aspectRatio: '1 / 1', borderRadius: 20, overflow: 'hidden',
          background: 'var(--bg-surface-2)', boxShadow: '0 20px 50px rgba(108,99,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 1,
        }}>
          {currentTrack.artwork ? (
            <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <IconMusic size={64} style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
      </div>

      {/* title / artist / like */}
      <div style={{ padding: '0 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack.title}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack.artist}
          </div>
        </div>
        <button
          onClick={() => toggleLike(currentTrack)}
          aria-label={liked ? 'Unlike' : 'Like'}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: liked ? '#f87171' : 'var(--text-muted)', flexShrink: 0, padding: 6 }}
        >
          <IconHeart size={22} filled={liked} />
        </button>
      </div>

      {/* progress */}
      <div style={{ padding: '18px 24px 4px' }}>
        <div
          ref={barRef}
          onMouseDown={handleScrubStart}
          onTouchStart={handleScrubStart}
          style={{ height: 14, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{ position: 'relative', width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress}%`, borderRadius: 2, background: 'linear-gradient(90deg,#a78bfa,#6c63ff)' }} />
            <div style={{ position: 'absolute', top: '50%', left: `${progress}%`, transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
          <span>{formatTime(isScrubbing ? scrubValue : currentTime)}</span>
          <span>{error ? <span style={{ color: '#f87171' }}>{error}</span> : formatTime(duration)}</span>
        </div>
      </div>

      {/* transport */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '10px 24px 6px' }}>
        <button
          onClick={toggleShuffle}
          aria-label="Shuffle"
          aria-pressed={shuffle}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: shuffle ? '#a78bfa' : 'var(--text-muted)', padding: 8 }}
        >
          <IconShuffle size={18} />
        </button>
        <button onClick={playPrevious} aria-label="Previous" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 8 }}>
          <IconSkipBack size={26} />
        </button>
        <button
          onClick={togglePlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          disabled={isLoading}
          style={{
            width: 64, height: 64, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isLoading ? 0.6 : 1,
            boxShadow: '0 8px 20px rgba(108,99,255,0.35)',
          }}
        >
          {isPlaying ? <IconPause size={26} /> : <IconPlay size={26} />}
        </button>
        <button onClick={playNext} aria-label="Next" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 8 }}>
          <IconSkipForward size={26} />
        </button>
        <button
          onClick={cycleRepeat}
          aria-label="Repeat"
          aria-pressed={repeatMode !== 'off'}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: repeatMode !== 'off' ? '#a78bfa' : 'var(--text-muted)', padding: 8, position: 'relative' }}
        >
          <IconRepeat size={18} />
          {repeatMode === 'one' && (
            <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: 8, fontWeight: 800 }}>1</span>
          )}
        </button>
      </div>

      {/* volume + share */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 28px 24px' }}>
        <IconVolume2 size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          type="range" min={0} max={1} step={0.01} value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          aria-label="Volume"
          style={{ flex: 1, accentColor: '#a78bfa' }}
        />
        <button
          onClick={openShareSheet}
          aria-label="Share"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, flexShrink: 0 }}
        >
          <IconShare2 size={17} />
        </button>
         {currentTrack.provider === 'mattchat' && currentTrack.isDownloadable && (
         <DownloadButton track={currentTrack} />
       )}
      </div>

      {isQueueVisible && <QueueDrawer onClose={() => setIsQueueVisible(false)} />}
      {shareSheetOpen && (
        <ShareTrackSheet
          track={currentTrack}
          conversations={conversations}
          onShare={(conversationId, track) => onShareTrack && onShareTrack(conversationId, track)}
          onClose={() => setShareSheetOpen(false)}
        />
      )}
    </div>
  )
}
