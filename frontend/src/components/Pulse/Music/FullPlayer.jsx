import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { useDominantColor, rgba } from '../../../lib/music/extractColor'
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

  // the whole "wow" ingredient: this screen's color comes from the
  // artwork on screen, not a fixed brand purple — same idea Spotify
  // uses for album/playlist pages
  const dominant = useDominantColor(currentTrack?.artwork)

  if (!currentTrack) return null

  const progress = duration > 0
    ? (isScrubbing ? scrubValue : currentTime) / duration * 100
    : 0
  const liked = isLiked(currentTrack.id)

  const handleScrubStart = (e) => { setIsScrubbing(true); updateScrub(e) }
  const updateScrub = (e) => {
    if (!barRef.current || !duration) return
    const rect = barRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    setScrubValue(ratio * duration)
  }
  const handleScrubMove = (e) => { if (isScrubbing) updateScrub(e) }
  const handleScrubEnd = () => { if (isScrubbing) seekTo(scrubValue); setIsScrubbing(false) }
  const openShareSheet = () => setShareSheetOpen(true)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 700,
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        overflow: 'hidden', background: '#0b0b13',
      }}
      onMouseMove={handleScrubMove}
      onMouseUp={handleScrubEnd}
      onTouchMove={handleScrubMove}
      onTouchEnd={handleScrubEnd}
    >
      {/* live color wash — crossfades between tracks instead of cutting */}
      <AnimatePresence mode="sync">
        <motion.div
          key={currentTrack.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0, zIndex: 0,
            background: `linear-gradient(180deg, ${rgba(dominant, 0.85)} 0%, ${rgba(dominant, 0.35)} 32%, #0b0b13 68%)`,
          }}
        />
      </AnimatePresence>
      {/* blurred artwork wash underneath, very low opacity — adds texture without fighting legibility */}
      {currentTrack.artwork && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${currentTrack.artwork})`, backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'blur(60px) saturate(1.4)', opacity: 0.35, transform: 'scale(1.2)',
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
          <button onClick={onClose} aria-label="Minimize player"
            style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IconChevronDown size={18} />
          </button>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: 1, textTransform: 'uppercase' }}>
            Now Playing
          </div>
          <button onClick={() => setIsQueueVisible(true)} aria-label="View queue"
            style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
            <IconListMusic size={17} />
            {queue.length > 1 && (
              <span style={{ position: 'absolute', top: -2, right: -2, fontSize: 9, fontWeight: 800, background: '#fff', color: '#0f0f1a', borderRadius: 8, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {queue.length}
              </span>
            )}
          </button>
        </div>

        {/* artwork — crossfades + scales in on track change */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', minHeight: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTrack.id}
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{
                width: '100%', maxWidth: 320, aspectRatio: '1 / 1', borderRadius: 20, overflow: 'hidden',
                background: 'var(--bg-surface-2)', boxShadow: `0 24px 60px ${rgba(dominant, 0.5)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 1,
              }}
            >
              {currentTrack.artwork ? (
                <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <IconMusic size={64} style={{ color: 'var(--text-muted)' }} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* title / artist / like */}
        <div style={{ padding: '0 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTrack.id}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.25 }}
              style={{ minWidth: 0 }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: -0.3 }}>
                {currentTrack.title}
              </div>
              <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentTrack.artist}
              </div>
            </motion.div>
          </AnimatePresence>
          <motion.button
            onClick={() => toggleLike(currentTrack)}
            whileTap={{ scale: 1.35 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            aria-label={liked ? 'Unlike' : 'Like'}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: liked ? '#f87171' : 'rgba(255,255,255,0.7)', flexShrink: 0, padding: 6 }}
          >
            <IconHeart size={22} filled={liked} />
          </motion.button>
        </div>

        {/* progress */}
        <div style={{ padding: '18px 24px 4px' }}>
          <div ref={barRef} onMouseDown={handleScrubStart} onTouchStart={handleScrubStart}
            style={{ height: 16, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ position: 'relative', width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress}%`, borderRadius: 2, background: '#fff', boxShadow: `0 0 12px ${rgba(dominant, 0.7)}` }} />
              <div style={{ position: 'absolute', top: '50%', left: `${progress}%`, transform: 'translate(-50%,-50%)', width: 13, height: 13, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
            <span>{formatTime(isScrubbing ? scrubValue : currentTime)}</span>
            <span>{error ? <span style={{ color: '#f87171' }}>{error}</span> : formatTime(duration)}</span>
          </div>
        </div>

        {/* transport */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '10px 24px 6px' }}>
          <button onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffle}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: shuffle ? '#fff' : 'rgba(255,255,255,0.5)', padding: 8 }}>
            <IconShuffle size={18} />
          </button>
          <button onClick={playPrevious} aria-label="Previous" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', padding: 8 }}>
            <IconSkipBack size={26} />
          </button>
          <motion.button
            onClick={togglePlayPause}
            whileTap={{ scale: 0.9 }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            disabled={isLoading}
            style={{
              width: 66, height: 66, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: '#fff', color: '#0f0f1a',
              display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isLoading ? 0.6 : 1,
              boxShadow: `0 10px 26px ${rgba(dominant, 0.55)}`,
            }}
          >
            {isPlaying ? <IconPause size={26} /> : <IconPlay size={26} />}
          </motion.button>
          <button onClick={playNext} aria-label="Next" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', padding: 8 }}>
            <IconSkipForward size={26} />
          </button>
          <button onClick={cycleRepeat} aria-label="Repeat" aria-pressed={repeatMode !== 'off'}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: repeatMode !== 'off' ? '#fff' : 'rgba(255,255,255,0.5)', padding: 8, position: 'relative' }}>
            <IconRepeat size={18} />
            {repeatMode === 'one' && <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: 8, fontWeight: 800 }}>1</span>}
          </button>
        </div>

        {/* volume + share */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 28px 24px' }}>
          <IconVolume2 size={16} style={{ color: 'rgba(255,255,255,0.55)', flexShrink: 0 }} />
          <input type="range" min={0} max={1} step={0.01} value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))} aria-label="Volume"
            style={{ flex: 1, accentColor: '#fff' }} />
          <button onClick={openShareSheet} aria-label="Share"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: 6, flexShrink: 0 }}>
            <IconShare2 size={17} />
          </button>
          {currentTrack.provider === 'mattchat' && currentTrack.isDownloadable && <DownloadButton track={currentTrack} />}
        </div>
      </div>

      <AnimatePresence>
        {isQueueVisible && <QueueDrawer onClose={() => setIsQueueVisible(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {shareSheetOpen && (
          <ShareTrackSheet
            track={currentTrack}
            conversations={conversations}
            onShare={(conversationId, track) => onShareTrack && onShareTrack(conversationId, track)}
            onClose={() => setShareSheetOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
