import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import MusicSearch from '../MusicSearch'
import TrackRail from '../TrackRail'
import PlaylistsSection from '../PlaylistsSection'
import BecomeArtistModal from '../BecomeArtistModal'
import ArtistDashboard from '../ArtistDashboard'
import LibraryPanel from '../LibraryPanel'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { MusicService } from '../../lib/music/MusicService'
import { YouTubeMusicProvider } from '../../lib/music/providers/YouTubeMusicProvider'
import { ArtistService } from '../../lib/music/ArtistService'
import { PlaylistService } from '../../lib/music/PlaylistService'
import { useDominantColor, rgba } from '../../lib/music/extractColor'
import { useMusicColors } from '../../hooks/useMusicColors'
import {
  IconMusic, IconX, IconPlay, IconPause, IconMic, IconSearch, IconListMusic,
  IconSkipBack, IconSkipForward, IconShuffle, IconRepeat, IconHeart, IconVolume2, IconPlus,
  IconQueueList, IconLyrics, IconShare2, IconLoader2,
} from './Icons'
import { useIsMobile } from '../../hooks/useIsMobile'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PulseMusicEntryCard({ onOpen }) {
  const colors = useMusicColors()
  const { isPlaying, currentTrack } = useMusicPlayer()
  return (
    <button
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, rgba(167,139,250,0.18), rgba(108,99,255,0.10)), ${colors.surface2}`,
        border: '1px solid rgba(167,139,250,0.3)', borderRadius: 16, padding: '14px 16px',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
      }}
    >
      <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(108,99,255,0.4)', flexShrink: 0 }}>
        {isPlaying && currentTrack ? <EqBarsSmall /> : <IconMusic size={19} style={{ color: '#fff' }} />}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: colors.textPrimary }}>Music</div>
        <div style={{ fontSize: 11.5, color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isPlaying && currentTrack ? `Playing · ${currentTrack.title}` : 'Discover, search, and play — keeps going while you chat'}
        </div>
      </div>
    </button>
  )
}

function EqBarsSmall() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 14 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 2.5, background: '#fff', borderRadius: 1, animation: `mattchatEqSm 0.9s ease-in-out ${i * 0.15}s infinite` }} />
      ))}
      <style>{`@keyframes mattchatEqSm { 0%, 100% { height: 4px; } 50% { height: 14px; } }`}</style>
    </div>
  )
}

// ── Left icon rail ──
function LibraryRail({ playlists, colors, onOpenLibrary }) {
  const { likedTracks, playTrack } = useMusicPlayer()
  return (
    <div style={{
      width: 64, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 10, padding: '14px 0', background: colors.surface1, borderRight: `1px solid ${colors.border}`,
      height: '100%', overflowY: 'auto',
    }}>
      <button
        onClick={onOpenLibrary}
        title="Your Library"
        style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: colors.surface2, color: colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 4 }}
      >
        <IconListMusic size={17} />
      </button>

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => likedTracks.length && playTrack(likedTracks[0], likedTracks)}
        title="Liked Songs"
        style={{
          width: 44, height: 44, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <IconHeart size={18} filled style={{ color: '#fff' }} />
      </motion.button>

      {playlists.map((p) => (
        <motion.button
          key={p.id}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={onOpenLibrary}
          title={p.name}
          style={{
            width: 44, height: 44, borderRadius: 10, overflow: 'hidden', border: 'none', cursor: 'pointer', padding: 0,
            background: p.artwork_url ? colors.surface2 : 'linear-gradient(135deg, rgba(167,139,250,0.35), rgba(108,99,255,0.2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {p.artwork_url ? <img src={p.artwork_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconListMusic size={16} style={{ color: 'rgba(255,255,255,0.85)' }} />}
        </motion.button>
      ))}
    </div>
  )
}

// ── Real "Up Next" queue list — shared between desktop panel tab
// and the mobile QueueSheet. This is the Spotify-style piece: it
// reads the actual queue + queueIndex from context, lets you jump
// to or remove any upcoming track, and surfaces isAutoContinuing —
// the moment your RecommendationEngine kicks in once the manual
// queue runs out (Spotify calls this "autoplay") ──
function QueueList({ colors }) {
  const { queue, queueIndex, currentTrack, isAutoContinuing, playFromQueue, removeFromQueue, clearQueue } = useMusicPlayer()
  const upcoming = queue.slice(queueIndex + 1)

  return (
    <div>
      {currentTrack && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Now Playing
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', marginBottom: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {currentTrack.artwork ? <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={14} style={{ color: colors.textMuted }} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#a78bfa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTrack.title}</div>
              <div style={{ fontSize: 11, color: colors.textMuted }}>{currentTrack.artist}</div>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Next Up
        </div>
        {upcoming.length > 0 && (
          <button onClick={clearQueue} style={{ fontSize: 10.5, fontWeight: 700, color: '#a78bfa', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            Clear
          </button>
        )}
      </div>

      {upcoming.length === 0 && !isAutoContinuing && (
        <div style={{ fontSize: 12, color: colors.textMuted, padding: '6px 0 10px' }}>
          Nothing queued — add a song from its menu, or keep listening and we'll keep it going.
        </div>
      )}

      <AnimatePresence initial={false}>
        {upcoming.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}
          >
            <button
              onClick={() => playFromQueue(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t.artwork ? <img src={t.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={13} style={{ color: colors.textMuted }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                <div style={{ fontSize: 10.5, color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist}</div>
              </div>
            </button>
            <button onClick={() => removeFromQueue(t.id)} aria-label="Remove from queue" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, flexShrink: 0, padding: 4 }}>
              <IconX size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {isAutoContinuing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', color: colors.textMuted, fontSize: 12 }}
          >
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ display: 'flex' }}>
              <IconLoader2 size={14} />
            </motion.span>
            Finding similar tracks to keep playing…
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Right "Now Playing" panel — Now Playing / Up Next / Lyrics tabs ──
function NowPlayingPanel({ colors }) {
  const { currentTrack, isLiked, toggleLike, isQueueVisible, setIsQueueVisible } = useMusicPlayer()
  const dominant = useDominantColor(currentTrack?.artwork)
  const [localTab, setLocalTab] = useState('details') // 'details' | 'lyrics' — 'queue' is driven by context
  const [burst, setBurst] = useState(false)

  const tab = isQueueVisible ? 'queue' : localTab

  const selectTab = (next) => {
    if (next === 'queue') { setIsQueueVisible(true); return }
    setIsQueueVisible(false)
    setLocalTab(next)
  }

  if (!currentTrack) {
    return (
      <div style={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${colors.border}`, background: colors.surface1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', color: colors.textMuted, fontSize: 12.5 }}>
          <IconMusic size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
          <div>Play something to see it here</div>
        </div>
      </div>
    )
  }

  const liked = isLiked(currentTrack.id)

  const handleLike = () => {
    if (!liked) { setBurst(true); setTimeout(() => setBurst(false), 600) }
    toggleLike(currentTrack)
  }

  const share = () => {
    if (navigator.share) {
      navigator.share({ title: currentTrack.title, text: `${currentTrack.title} — ${currentTrack.artist}` }).catch(() => {})
    }
  }

  return (
    <div style={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${colors.border}`, background: colors.surface1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <TabButton active={tab === 'details'} onClick={() => selectTab('details')} icon={<IconMusic size={12} />} label="Now Playing" />
        <TabButton active={tab === 'queue'} onClick={() => selectTab('queue')} icon={<IconQueueList size={12} />} label="Up Next" />
        <TabButton active={tab === 'lyrics'} onClick={() => selectTab('lyrics')} icon={<IconLyrics size={12} />} label="Lyrics" />
      </div>

      {tab !== 'queue' && (
        <motion.div
          key={currentTrack.id}
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
          style={{
            width: '100%', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', marginBottom: 14,
            background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 16px 40px ${rgba(dominant, 0.35)}`,
          }}
        >
          {currentTrack.artwork ? (
            <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <IconMusic size={40} style={{ color: colors.textMuted }} />
          )}
        </motion.div>
      )}

      {tab !== 'queue' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {currentTrack.title}
            </div>
            <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexShrink: 0, position: 'relative' }}>
              <button onClick={handleLike} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: liked ? '#f87171' : colors.textMuted, position: 'relative' }}>
                <IconHeart size={17} filled={liked} />
                <AnimatePresence>
                  {burst && [0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 1, scale: 0.4, x: 0, y: 0 }}
                      animate={{ opacity: 0, scale: 1, x: (i - 1) * 14, y: -20 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                      style={{ position: 'absolute', top: 0, right: 0, color: '#f87171', pointerEvents: 'none' }}
                    >
                      <IconHeart size={10} filled />
                    </motion.span>
                  ))}
                </AnimatePresence>
              </button>
              <button onClick={share} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted }}>
                <IconShare2 size={16} />
              </button>
            </div>
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 18 }}>{currentTrack.artist}</div>
        </>
      )}

      <AnimatePresence mode="wait">
        {tab === 'lyrics' && (
          <motion.div key="lyrics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', color: colors.textMuted, fontSize: 12.5, padding: '30px 10px' }}>
            <IconLyrics size={26} style={{ marginBottom: 10, opacity: 0.5 }} />
            <div>Lyrics for this track aren't available yet.</div>
          </motion.div>
        )}
        {tab === 'queue' && (
          <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <QueueList colors={colors} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '6px 12px', borderRadius: 999,
        border: 'none', cursor: 'pointer', background: active ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : 'var(--mm-surface2, rgba(255,255,255,0.08))',
        color: active ? '#fff' : 'inherit', whiteSpace: 'nowrap',
      }}
    >
      {icon} {label}
    </button>
  )
}

// ── Mobile queue bottom sheet — same QueueList, sheet chrome ──
function QueueSheet({ colors, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
        style={{
          width: '100%', maxHeight: '75vh', overflowY: 'auto', background: colors.surface1,
          borderTop: `1px solid ${colors.border}`, borderTopLeftRadius: 18, borderTopRightRadius: 18,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.4)', padding: '18px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.border, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>Up Next</h3>
          <button onClick={onClose} aria-label="Close queue"
            style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', background: colors.surface2, color: colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconX size={14} />
          </button>
        </div>
        <QueueList colors={colors} />
      </motion.div>
    </motion.div>
  )
}

// ── Bottom playback bar ──
function PlaybackBar({ colors }) {
  const isMobile = useIsMobile()
  const {
    currentTrack, isPlaying, currentTime, duration, volume,
    togglePlayPause, seekTo, setVolume, playNext, playPrevious,
    shuffle, toggleShuffle, repeatMode, cycleRepeat, isLiked, toggleLike,
    isQueueVisible, setIsQueueVisible,
  } = useMusicPlayer()

  if (!currentTrack) {
    return (
      <div style={{ height: isMobile ? 56 : 72, borderTop: `1px solid ${colors.border}`, background: colors.surface1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontSize: 12 }}>
        Nothing playing
      </div>
    )
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const liked = isLiked(currentTrack.id)

  if (isMobile) {
    return (
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDragEnd={(e, info) => {
          if (info.offset.x < -60) playNext()
          else if (info.offset.x > 60) playPrevious()
        }}
        whileDrag={{ scale: 0.98 }}
        style={{ position: 'relative', height: 56, borderTop: `1px solid ${colors.border}`, background: colors.surface2, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8, touchAction: 'pan-y' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, height: 2, width: `${progress}%`, background: '#a78bfa' }} />
        <div style={{ width: 38, height: 38, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: colors.surface1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {currentTrack.artwork ? <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={14} style={{ color: colors.textMuted }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</div>
          <div style={{ fontSize: 10.5, color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.artist}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setIsQueueVisible(true) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, flexShrink: 0 }}>
          <IconQueueList size={16} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); toggleLike(currentTrack) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: liked ? '#f87171' : colors.textMuted, flexShrink: 0 }}>
          <IconHeart size={16} filled={liked} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); togglePlayPause() }}
          style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#fff', color: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          {isPlaying ? <IconPause size={13} /> : <IconPlay size={13} />}
        </button>
      </motion.div>
    )
  }

  return (
    <div style={{ height: 72, borderTop: `1px solid ${colors.border}`, background: colors.surface1, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 220, minWidth: 0 }}>
        <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {currentTrack.artwork ? <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={16} style={{ color: colors.textMuted }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</div>
          <div style={{ fontSize: 11, color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.artist}</div>
        </div>
        <button onClick={() => toggleLike(currentTrack)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: liked ? '#f87171' : colors.textMuted, flexShrink: 0 }}>
          <IconHeart size={15} filled={liked} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button onClick={toggleShuffle} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: shuffle ? '#a78bfa' : colors.textMuted }}><IconShuffle size={15} /></button>
          <button onClick={playPrevious} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textPrimary }}><IconSkipBack size={17} /></button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={togglePlayPause}
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#fff', color: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isPlaying ? <IconPause size={14} /> : <IconPlay size={14} />}
          </motion.button>
          <button onClick={playNext} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textPrimary }}><IconSkipForward size={17} /></button>
          <button onClick={cycleRepeat} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: repeatMode !== 'off' ? '#a78bfa' : colors.textMuted, position: 'relative' }}>
            <IconRepeat size={15} />
            {repeatMode === 'one' && <span style={{ position: 'absolute', bottom: -3, right: -3, fontSize: 7, fontWeight: 800 }}>1</span>}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <span style={{ fontSize: 10.5, color: colors.textMuted, width: 32, textAlign: 'right' }}>{formatTime(currentTime)}</span>
          <div
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seekTo(((e.clientX - r.left) / r.width) * duration) }}
            style={{ flex: 1, height: 4, borderRadius: 2, background: colors.surface2, cursor: 'pointer', position: 'relative' }}
          >
            <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${progress}%`, borderRadius: 2, background: '#a78bfa' }} />
          </div>
          <span style={{ fontSize: 10.5, color: colors.textMuted, width: 32 }}>{formatTime(duration)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: 180, justifyContent: 'flex-end' }}>
        <button onClick={() => setIsQueueVisible((v) => !v)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isQueueVisible ? '#a78bfa' : colors.textMuted }}>
          <IconQueueList size={16} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconVolume2 size={15} style={{ color: colors.textMuted }} />
          <input
            type="range" min={0} max={1} step={0.01} value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ width: 80, accentColor: '#a78bfa' }}
          />
        </div>
      </div>
    </div>
  )
}

function QuickPickTile({ track, onPress, index, colors }) {
  return (
    <motion.button
      onClick={onPress}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.25 }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, background: colors.surface2,
        border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
        padding: 0, textAlign: 'left', height: 56,
      }}
    >
      <div style={{ width: 56, height: 56, flexShrink: 0, background: colors.surface1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {track.artwork ? <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={16} style={{ color: colors.textMuted }} />}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 10 }}>
        {track.title}
      </div>
    </motion.button>
  )
}

function Section({ delay = 0, children, style }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35, ease: 'easeOut' }} style={style}>
      {children}
    </motion.div>
  )
}

function ForYouCarousel({ tracks, onPress, isMobile }) {
  const [index, setIndex] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (tracks.length < 2) return
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % tracks.length), 5000)
    return () => clearInterval(timerRef.current)
  }, [tracks.length])

  if (!tracks || tracks.length === 0) return null
  const track = tracks[index]

  const restartTimer = () => {
    clearInterval(timerRef.current)
    if (tracks.length > 1) timerRef.current = setInterval(() => setIndex((i) => (i + 1) % tracks.length), 5000)
  }

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#fff', marginBottom: 10, letterSpacing: -0.2, textShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>
        For You
      </div>
      <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', height: isMobile ? 150 : 190 }}>
        <AnimatePresence mode="wait">
          <motion.button
            key={track.id}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(e, info) => {
              if (info.offset.x < -50) setIndex((i) => (i + 1) % tracks.length)
              else if (info.offset.x > 50) setIndex((i) => (i - 1 + tracks.length) % tracks.length)
              restartTimer()
            }}
            onClick={() => onPress(track)}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'absolute', inset: 0, width: '100%', border: 'none', cursor: 'pointer', padding: 0,
              background: track.artwork ? `url(${track.artwork}) center/cover no-repeat` : 'linear-gradient(135deg,#a78bfa,#6c63ff)',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.15) 100%)' }} />
            <div style={{ position: 'absolute', left: isMobile ? 14 : 22, bottom: isMobile ? 12 : 18, right: 70, textAlign: 'left' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Recommended</div>
              <div style={{ fontSize: isMobile ? 15 : 19, fontWeight: 900, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</div>
            </div>
            <div style={{ position: 'absolute', right: isMobile ? 12 : 20, bottom: isMobile ? 12 : 18, width: 42, height: 42, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.4)' }}>
              <IconPlay size={17} style={{ color: '#0f0f1a', marginLeft: 2 }} />
            </div>
          </motion.button>
        </AnimatePresence>
      </div>
      {tracks.length > 1 && (
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 10 }}>
          {tracks.slice(0, 8).map((_, i) => (
            <button
              key={i}
              onClick={() => { setIndex(i); restartTimer() }}
              style={{
                width: i === index ? 16 : 6, height: 6, borderRadius: 3, border: 'none', cursor: 'pointer',
                background: i === index ? '#a78bfa' : 'rgba(255,255,255,0.25)', transition: 'width 0.2s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const TABS = ['All', 'Songs', 'Playlists']

export function PulseMusicOverlay({ onClose }) {
  const { userId, recentlyPlayed, likedTracks, playTrack, isQueueVisible, setIsQueueVisible } = useMusicPlayer()
  const colors = useMusicColors()
  const isMobile = useIsMobile()
  const [trending, setTrending] = useState([])
  const [mainstream, setMainstream] = useState([])
  const [trendingError, setTrendingError] = useState(false)
  const [artistProfile, setArtistProfile] = useState(null)
  const [artistChecked, setArtistChecked] = useState(false)
  const [showBecomeArtist, setShowBecomeArtist] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [activeTab, setActiveTab] = useState('All')
  const [playlists, setPlaylists] = useState([])

  useEffect(() => {
    let cancelled = false
    MusicService.getTrending({ limit: 15 }).then((t) => { if (!cancelled) setTrending(t) }).catch(() => { if (!cancelled) setTrendingError(true) })
    YouTubeMusicProvider.getTrending({ limit: 15 }).then((t) => { if (!cancelled) setMainstream(t) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const loadPlaylists = useCallback(async () => {
    if (!userId) return
    try { setPlaylists(await PlaylistService.listPlaylists(userId)) } catch { /* non-fatal */ }
  }, [userId])
  useEffect(() => { loadPlaylists() }, [loadPlaylists])

  const refreshArtistProfile = useCallback(async () => {
    if (!userId) { setArtistChecked(true); return }
    try { setArtistProfile(await ArtistService.getMyArtistProfile(userId)) }
    catch { setArtistProfile(null) }
    finally { setArtistChecked(true) }
  }, [userId])
  useEffect(() => { refreshArtistProfile() }, [refreshArtistProfile])

  const heroTrack = mainstream[0] || trending[0] || recentlyPlayed[0] || likedTracks[0] || null
  const dominant = useDominantColor(heroTrack?.artwork)
  const quickPicks = [...recentlyPlayed.slice(0, 4), ...likedTracks.slice(0, 4)].slice(0, 6)
  const forYou = [...mainstream, ...trending].slice(0, 8)
  const openArtistStudio = () => (artistProfile ? setShowDashboard(true) : setShowBecomeArtist(true))

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{ position: 'fixed', inset: 0, zIndex: 600, background: colors.surface1, display: 'flex', flexDirection: 'column' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        background: colors.surface1, borderBottom: `1px solid ${colors.border}`, flexShrink: 0,
      }}>
        <button
          onClick={() => setShowSearch((s) => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: colors.surface2,
            border: `1px solid ${colors.border}`, borderRadius: 999,
            padding: isMobile ? '8px 10px' : '8px 16px',
            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: colors.textMuted, fontSize: 13,
            width: isMobile ? 36 : 340, height: 36, justifyContent: 'center',
          }}
        >
          <IconSearch size={14} />
          {!isMobile && 'What do you want to play?'}
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={openArtistStudio}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: isMobile ? '0 10px' : '0 12px', borderRadius: 999, border: `1px solid ${colors.border}`, cursor: 'pointer', background: colors.surface2, color: colors.textPrimary, fontSize: 11.5, fontWeight: 700 }}
        >
          <IconMic size={13} /> {!isMobile && (artistProfile ? 'Your Studio' : 'Become an Artist')}
        </button>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <IconX size={16} />
        </button>
      </div>

      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden', borderBottom: `1px solid ${colors.border}`, background: colors.surface1, flexShrink: 0 }}
          >
            <div style={{ padding: '14px 16px', maxWidth: 640 }}>
              <MusicSearch autoFocus />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {!isMobile && (
          <LibraryRail playlists={playlists} colors={colors} onOpenLibrary={() => setShowLibrary(true)} />
        )}

        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
            style={{
              position: 'relative', padding: isMobile ? '14px 14px 16px' : '18px 24px 20px',
              background: `linear-gradient(180deg, ${rgba(dominant, 0.4)} 0%, ${rgba(dominant, 0.12)} 55%, ${colors.surface1} 100%)`,
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.12) 60%, transparent 100%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                      border: 'none', color: activeTab === tab ? '#0f0f1a' : '#fff',
                      background: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.18)',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: '0 0 14px', letterSpacing: -0.4, textShadow: '0 2px 12px rgba(0,0,0,0.45)' }}>
                {greeting()}
              </h2>
            </div>
          </motion.div>

          <div style={{ padding: isMobile ? '0 14px 100px' : '0 24px 40px' }}>
            {(activeTab === 'All') && forYou.length > 0 && (
              <Section>
                <ForYouCarousel tracks={forYou} isMobile={isMobile} onPress={(t) => playTrack(t, forYou)} />
              </Section>
            )}

            {artistChecked && !artistProfile && (
              <Section>
                <button
                  onClick={() => setShowBecomeArtist(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginBottom: 24, maxWidth: 640,
                    background: 'linear-gradient(135deg, rgba(167,139,250,0.14), rgba(108,99,255,0.08))',
                    border: '1px solid rgba(167,139,250,0.28)', borderRadius: 14, padding: '12px 14px',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconMic size={16} style={{ color: '#fff' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: colors.textPrimary }}>Make music? Publish it here.</div>
                    <div style={{ fontSize: 11.5, color: colors.textMuted }}>Upload tracks, get real plays and likes from Mattchat listeners</div>
                  </div>
                </button>
              </Section>
            )}

            {(activeTab === 'All' || activeTab === 'Songs') && quickPicks.length > 0 && (
              <Section delay={0.03} style={{ marginBottom: 26 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: isMobile ? 8 : 10 }}>
                  {quickPicks.map((t, i) => (
                    <QuickPickTile key={t.id} track={t} index={i} colors={colors} onPress={() => playTrack(t, quickPicks)} />
                  ))}
                </div>
              </Section>
            )}

            {(activeTab === 'All' || activeTab === 'Songs') && mainstream.length > 0 && (
              <Section delay={0.06}><TrackRail title="Mainstream Hits" tracks={mainstream} /></Section>
            )}
            {(activeTab === 'All' || activeTab === 'Songs') && trending.length > 0 && (
              <Section delay={0.09}><TrackRail title="Trending on Mattchat" tracks={trending} /></Section>
            )}
            {trendingError && trending.length === 0 && (
              <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 18 }}>Trending is temporarily unavailable.</div>
            )}
            {(activeTab === 'All' || activeTab === 'Playlists') && (
              <Section delay={0.12}><PlaylistsSection /></Section>
            )}
            {(activeTab === 'All' || activeTab === 'Songs') && recentlyPlayed.length > 0 && (
              <Section delay={0.15}><TrackRail title="Recently Played" tracks={recentlyPlayed} /></Section>
            )}
            {(activeTab === 'All' || activeTab === 'Songs') && likedTracks.length > 0 && (
              <Section delay={0.18}><TrackRail title="Liked Music" tracks={likedTracks} /></Section>
            )}
          </div>
        </div>

        {!isMobile && <NowPlayingPanel colors={colors} />}
      </div>

      <PlaybackBar colors={colors} />

      <AnimatePresence>
        {isMobile && isQueueVisible && (
          <QueueSheet colors={colors} onClose={() => setIsQueueVisible(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showLibrary && (
          <LibraryPanel
            playlists={playlists}
            onOpenPlaylist={() => {}}
            onClose={() => setShowLibrary(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showBecomeArtist && (
          <BecomeArtistModal userId={userId} onClose={() => setShowBecomeArtist(false)} onCreated={(a) => { setArtistProfile(a); setShowBecomeArtist(false); setShowDashboard(true) }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDashboard && <ArtistDashboard userId={userId} onClose={() => setShowDashboard(false)} />}
      </AnimatePresence>
    </motion.div>
  )
}

export default function PulseMusicCard({ onFullscreenChange }) {
  const [open, setOpen] = useState(false)

  const handleOpen = () => { setOpen(true); onFullscreenChange?.(true) }
  const handleClose = () => { setOpen(false); onFullscreenChange?.(false) }

  return (
    <>
      <PulseMusicEntryCard onOpen={handleOpen} />
      <AnimatePresence>{open && <PulseMusicOverlay onClose={handleClose} />}</AnimatePresence>
    </>
  )
}
