import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { useDominantColor, rgba } from '../../../lib/music/extractColor'
import {
  IconPlay, IconPause, IconSkipBack, IconSkipForward, IconChevronDown,
  IconShuffle, IconRepeat, IconHeart, IconShare2, IconListMusic,
  IconVolume2, IconMusic,
} from '../../Icons'
import QueueDrawer from './QueueDrawer'
import ShareTrackSheet from './ShareTrackSheet'
import TrackDownloadAction from './TrackDownloadAction'

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// "DJ PHAPHANE - Topic" -> "DJ PHAPHANE"
const cleanArtist = (a = '') => a.replace(/\s*-\s*Topic\s*$/i, '').trim()

// "Song (Official Video) [HD]" -> "Song"
const cleanTitle = (t = '') =>
  t.replace(/\s*[\(\[][^)\]]*(official|video|audio|lyrics?|hd|4k|visuali[sz]er)[^)\]]*[\)\]]/gi, '').trim()

// YouTube thumbnails come with black bars baked in. Zooming the image
// inside the square crops them out. Tune this one number if needed.
const YT_ART_ZOOM = 1.34
const artZoom = (url = '') => (/ytimg|ggpht|googleusercontent/i.test(url) ? YT_ART_ZOOM : 1)

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]
const SLEEP_OPTIONS = [
  { label: 'Off', minutes: 0 },
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '60 minutes', minutes: 60 },
  { label: 'End of this song', minutes: -1 },
]

const lyricsCache = new Map()

/* small inline icons so we don't depend on new exports in Icons.jsx */
const Svg = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const IconMoon = (p) => <Svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Svg>
const IconLyrics = (p) => <Svg {...p}><path d="M4 6h16M4 12h10M4 18h14" /></Svg>
const IconGauge = (p) => <Svg {...p}><path d="M12 14l4-4" /><path d="M3.3 17a9 9 0 1 1 17.4 0" /></Svg>

/* ------------------------------------------------------------------ */
/* bottom sheet shell                                                  */
/* ------------------------------------------------------------------ */

function Sheet({ title, onClose, children }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.55)' }}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) onClose() }}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 21,
          maxHeight: '72%', display: 'flex', flexDirection: 'column',
          background: 'rgba(18,18,28,0.97)', backdropFilter: 'blur(20px)',
          borderRadius: '22px 22px 0 0', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)', margin: '10px auto 6px' }} />
        <div style={{ padding: '4px 20px 12px', fontSize: 16, fontWeight: 800, color: '#fff' }}>{title}</div>
        <div style={{ overflowY: 'auto', padding: '0 12px 18px' }}>{children}</div>
      </motion.div>
    </>
  )
}

const rowStyle = (active) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  width: '100%', padding: '13px 10px', border: 'none', borderRadius: 12, cursor: 'pointer',
  background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
  color: active ? '#fff' : 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: active ? 700 : 500, textAlign: 'left',
})

/* ------------------------------------------------------------------ */
/* lyrics sheet (Boomplay-style) — free lyrics.ovh lookup, cached      */
/* ------------------------------------------------------------------ */

function LyricsSheet({ track, onClose }) {
  const [state, setState] = useState({ status: 'loading', text: '' })

  useEffect(() => {
    const artist = cleanArtist(track.artist)
    const title = cleanTitle(track.title)
    const key = `${artist}::${title}`.toLowerCase()
    if (lyricsCache.has(key)) { setState(lyricsCache.get(key)); return }

    const ctrl = new AbortController()
    setState({ status: 'loading', text: '' })
    fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then((d) => {
        const next = d?.lyrics
          ? { status: 'ok', text: d.lyrics.trim() }
          : { status: 'none', text: '' }
        lyricsCache.set(key, next)
        setState(next)
      })
      .catch((e) => { if (e.name !== 'AbortError') setState({ status: 'none', text: '' }) })
    return () => ctrl.abort()
  }, [track.id, track.artist, track.title])

  return (
    <Sheet title="Lyrics" onClose={onClose}>
      {state.status === 'loading' && (
        <div style={{ padding: 24, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Finding lyrics…</div>
      )}
      {state.status === 'none' && (
        <div style={{ padding: 24, color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.5 }}>
          No lyrics found for this song. Many mainstream tracks aren't covered by the free lyrics source.
        </div>
      )}
      {state.status === 'ok' && (
        <div style={{ padding: '4px 10px 16px', whiteSpace: 'pre-wrap', color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1.6 }}>
          {state.text}
        </div>
      )}
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/* up next sheet                                                       */
/* ------------------------------------------------------------------ */

function UpNextSheet({ queue, currentTrack, onPlay, onOpenQueue, onClose }) {
  const idx = queue.findIndex((t) => t.id === currentTrack.id)
  const upcoming = idx >= 0 ? queue.slice(idx + 1, idx + 11) : queue.slice(0, 10)

  return (
    <Sheet title="Up next" onClose={onClose}>
      {upcoming.length === 0 && (
        <div style={{ padding: 24, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
          Nothing queued after this song.
        </div>
      )}
      {upcoming.map((t) => (
        <button key={t.id} onClick={() => onPlay && onPlay(t)} style={rowStyle(false)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {t.artwork
                ? <img src={t.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${artZoom(t.artwork)})` }} />
                : <IconMusic size={18} />}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanTitle(t.title)}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanArtist(t.artist)}</span>
            </span>
          </span>
        </button>
      ))}
      <button onClick={onOpenQueue} style={{ ...rowStyle(false), justifyContent: 'center', marginTop: 6, color: '#fff', fontWeight: 700 }}>
        Open full queue
      </button>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/* main component                                                      */
/* ------------------------------------------------------------------ */

export default function FullPlayer({ onClose, conversations = [], onShareTrack }) {
  const player = useMusicPlayer()
  const {
    currentTrack, isPlaying, isLoading, error, currentTime, duration, volume,
    togglePlayPause, seekTo, setVolume, playNext, playPrevious,
    shuffle, toggleShuffle, repeatMode, cycleRepeat,
    isLiked, toggleLike, isQueueVisible, setIsQueueVisible, queue,
  } = player

  // optional capabilities — only shown if your context provides them
  const setPlaybackRate = player.setPlaybackRate
  const playbackRate = player.playbackRate || 1
  const playTrack = player.playTrack

  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubValue, setScrubValue] = useState(0)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [sheet, setSheet] = useState(null) // 'lyrics' | 'upnext' | 'sleep' | 'speed' | null
  const [sleep, setSleep] = useState({ mode: 0, endsAt: 0, trackId: null })
  const [, forceTick] = useState(0)
  const barRef = useRef(null)
  const dragControls = useDragControls()

  const dominant = useDominantColor(currentTrack?.artwork)

  // latest-value refs so the sleep timer never uses a stale closure
  const isPlayingRef = useRef(isPlaying)
  const toggleRef = useRef(togglePlayPause)
  useEffect(() => { isPlayingRef.current = isPlaying; toggleRef.current = togglePlayPause })

  const pauseIfPlaying = useCallback(() => {
    if (isPlayingRef.current) toggleRef.current()
  }, [])

  // timed sleep
  useEffect(() => {
    if (sleep.mode <= 0 || !sleep.endsAt) return undefined
    const ms = Math.max(0, sleep.endsAt - Date.now())
    const t = setTimeout(() => { pauseIfPlaying(); setSleep({ mode: 0, endsAt: 0, trackId: null }) }, ms)
    const tick = setInterval(() => forceTick((n) => n + 1), 30000)
    return () => { clearTimeout(t); clearInterval(tick) }
  }, [sleep.mode, sleep.endsAt, pauseIfPlaying])

  // "end of this song" sleep
  useEffect(() => {
    if (sleep.mode !== -1 || !sleep.trackId) return
    if (currentTrack?.id !== sleep.trackId) {
      pauseIfPlaying()
      setSleep({ mode: 0, endsAt: 0, trackId: null })
    }
  }, [sleep.mode, sleep.trackId, currentTrack?.id, pauseIfPlaying])

  const chooseSleep = (opt) => {
    if (opt.minutes === 0) setSleep({ mode: 0, endsAt: 0, trackId: null })
    else if (opt.minutes === -1) setSleep({ mode: -1, endsAt: 0, trackId: currentTrack.id })
    else setSleep({ mode: opt.minutes, endsAt: Date.now() + opt.minutes * 60000, trackId: null })
    setSheet(null)
  }

  if (!currentTrack) return null

  const title = cleanTitle(currentTrack.title)
  const artist = cleanArtist(currentTrack.artist)
  const zoom = artZoom(currentTrack.artwork)

  const shownTime = isScrubbing ? scrubValue : currentTime
  const progress = duration > 0 ? (shownTime / duration) * 100 : 0
  const liked = isLiked(currentTrack.id)

  const sleepActive = sleep.mode !== 0
  const sleepLabel = sleep.mode === -1
    ? 'End of song'
    : sleepActive
      ? `${Math.max(1, Math.ceil((sleep.endsAt - Date.now()) / 60000))} min`
      : 'Sleep'

  /* scrubbing */
  const updateScrub = (e) => {
    if (!barRef.current || !duration) return
    const rect = barRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    setScrubValue(ratio * duration)
  }
  const handleScrubStart = (e) => { setIsScrubbing(true); updateScrub(e) }
  const handleScrubMove = (e) => { if (isScrubbing) updateScrub(e) }
  const handleScrubEnd = () => { if (isScrubbing) seekTo(scrubValue); setIsScrubbing(false) }
  const handleSeekKey = (e) => {
    if (e.key === 'ArrowRight') seekTo(Math.min(duration, currentTime + 5))
    if (e.key === 'ArrowLeft') seekTo(Math.max(0, currentTime - 5))
  }

  const chip = (active) => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 18,
    border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
    background: active ? '#fff' : 'rgba(255,255,255,0.1)',
    color: active ? '#0f0f1a' : 'rgba(255,255,255,0.85)',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60 }}
      transition={{ duration: 0.25 }}
      // swipe down from the header to minimize (Spotify behaviour)
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }}
      onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) onClose() }}
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
      {/* colour wash from artwork */}
      <AnimatePresence mode="sync">
        <motion.div
          key={currentTrack.id}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0, zIndex: 0,
            background: `linear-gradient(180deg, ${rgba(dominant, 0.85)} 0%, ${rgba(dominant, 0.35)} 32%, #0b0b13 68%)`,
          }}
        />
      </AnimatePresence>
      {currentTrack.artwork && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${currentTrack.artwork})`, backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'blur(60px) saturate(1.4)', opacity: 0.35, transform: 'scale(1.2)',
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* header — also the drag handle for swipe-down */}
        <div
          onPointerDown={(e) => { if (e.target === e.currentTarget || e.target.dataset.grip) dragControls.start(e) }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', touchAction: 'none' }}
        >
          <button onClick={onClose} aria-label="Minimize player"
            style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IconChevronDown size={18} />
          </button>
          <div data-grip="1" style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: 1, textTransform: 'uppercase', flex: 1, textAlign: 'center', padding: '8px 0' }}>
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

        {/* artwork — swipe left/right to change track */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', minHeight: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTrack.id}
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: isPlaying ? 1 : 0.9, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              drag="x"
              dragSnapToOrigin
              dragElastic={0.35}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80 || info.velocity.x < -500) playNext()
                else if (info.offset.x > 80 || info.velocity.x > 500) playPrevious()
              }}
              style={{
                width: '100%', maxWidth: 320, aspectRatio: '1 / 1', borderRadius: 20, overflow: 'hidden',
                background: 'var(--bg-surface-2)', boxShadow: `0 24px 60px ${rgba(dominant, 0.5)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 1,
                touchAction: 'pan-y', cursor: 'grab',
              }}
            >
              {currentTrack.artwork ? (
                <img src={currentTrack.artwork} alt="" draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`, pointerEvents: 'none' }} />
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
              initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.25 }}
              style={{ minWidth: 0 }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: -0.3 }}>
                {title}
              </div>
              <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {artist}
              </div>
            </motion.div>
          </AnimatePresence>
          <motion.button
            onClick={() => toggleLike(currentTrack)}
            whileTap={{ scale: 1.35 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            aria-label={liked ? 'Remove from liked songs' : 'Add to liked songs'}
            aria-pressed={liked}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: liked ? '#f87171' : 'rgba(255,255,255,0.7)', flexShrink: 0, padding: 6 }}
          >
            <IconHeart size={24} filled={liked} />
          </motion.button>
        </div>

        {/* progress */}
        <div style={{ padding: '18px 24px 4px' }}>
          <div
            ref={barRef}
            role="slider" tabIndex={0}
            aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(duration || 0)} aria-valuenow={Math.round(shownTime || 0)}
            onKeyDown={handleSeekKey}
            onMouseDown={handleScrubStart} onTouchStart={handleScrubStart}
            style={{ height: 24, display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative', touchAction: 'none' }}
          >
            <div style={{ position: 'relative', width: '100%', height: isScrubbing ? 6 : 4, borderRadius: 3, background: 'rgba(255,255,255,0.15)', transition: 'height 0.12s' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress}%`, borderRadius: 3, background: '#fff', boxShadow: `0 0 12px ${rgba(dominant, 0.7)}` }} />
              <div style={{ position: 'absolute', top: '50%', left: `${progress}%`, transform: `translate(-50%,-50%) scale(${isScrubbing ? 1.35 : 1})`, transition: 'transform 0.12s', width: 13, height: 13, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }} />
              {isScrubbing && (
                <div style={{ position: 'absolute', bottom: 18, left: `${progress}%`, transform: 'translateX(-50%)', padding: '3px 8px', borderRadius: 8, background: '#fff', color: '#0f0f1a', fontSize: 11.5, fontWeight: 800, pointerEvents: 'none' }}>
                  {formatTime(scrubValue)}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
            <span>{formatTime(shownTime)}</span>
            <span>{error ? <span style={{ color: '#f87171' }}>{error}</span> : formatTime(duration)}</span>
          </div>
        </div>

        {/* transport */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '10px 24px 6px' }}>
          <button onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffle}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: shuffle ? '#fff' : 'rgba(255,255,255,0.5)', padding: 8, position: 'relative' }}>
            <IconShuffle size={18} />
            {shuffle && <span style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />}
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
            {isLoading
              ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
                  style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(15,15,26,0.2)', borderTopColor: '#0f0f1a', display: 'block' }} />
              : isPlaying ? <IconPause size={26} /> : <IconPlay size={26} />}
          </motion.button>
          <button onClick={playNext} aria-label="Next" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', padding: 8 }}>
            <IconSkipForward size={26} />
          </button>
          <button onClick={cycleRepeat} aria-label="Repeat" aria-pressed={repeatMode !== 'off'}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: repeatMode !== 'off' ? '#fff' : 'rgba(255,255,255,0.5)', padding: 8, position: 'relative' }}>
            <IconRepeat size={18} />
            {repeatMode === 'one' && <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: 8, fontWeight: 800 }}>1</span>}
            {repeatMode !== 'off' && <span style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />}
          </button>
        </div>

        {/* Boomplay-style action chips */}
        <div style={{ display: 'flex', gap: 8, padding: '8px 20px 4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <button onClick={() => setSheet('lyrics')} style={chip(false)}>
            <IconLyrics size={15} /> Lyrics
          </button>
          <button onClick={() => setSheet('upnext')} style={chip(false)}>
            <IconListMusic size={15} /> Up next
          </button>
          <button onClick={() => setSheet('sleep')} style={chip(sleepActive)}>
            <IconMoon size={15} /> {sleepLabel}
          </button>
          {setPlaybackRate && (
            <button onClick={() => setSheet('speed')} style={chip(playbackRate !== 1)}>
              <IconGauge size={15} /> {playbackRate}x
            </button>
          )}
        </div>

        {/* volume + share + download */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 28px 22px' }}>
          <IconVolume2 size={16} style={{ color: 'rgba(255,255,255,0.55)', flexShrink: 0 }} />
          <input type="range" min={0} max={1} step={0.01} value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))} aria-label="Volume"
            style={{ flex: 1, accentColor: '#fff' }} />
          <button onClick={() => setShareSheetOpen(true)} aria-label="Share"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: 6, flexShrink: 0 }}>
            <IconShare2 size={17} />
          </button>
          <TrackDownloadAction track={currentTrack} size={17} />
        </div>
      </div>

      {/* sheets */}
      <AnimatePresence>
        {sheet === 'lyrics' && <LyricsSheet key="lyrics" track={currentTrack} onClose={() => setSheet(null)} />}
        {sheet === 'upnext' && (
          <UpNextSheet
            key="upnext" queue={queue} currentTrack={currentTrack}
            onPlay={playTrack ? (t) => { playTrack(t, queue); setSheet(null) } : undefined}
            onOpenQueue={() => { setSheet(null); setIsQueueVisible(true) }}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet === 'sleep' && (
          <Sheet key="sleep" title="Sleep timer" onClose={() => setSheet(null)}>
            {SLEEP_OPTIONS.map((o) => {
              const active = (o.minutes === 0 && !sleepActive) || (o.minutes !== 0 && o.minutes === sleep.mode)
              return (
                <button key={o.label} onClick={() => chooseSleep(o)} style={rowStyle(active)}>
                  {o.label}{active && <span>✓</span>}
                </button>
              )
            })}
          </Sheet>
        )}
        {sheet === 'speed' && setPlaybackRate && (
          <Sheet key="speed" title="Playback speed" onClose={() => setSheet(null)}>
            {SPEEDS.map((s) => (
              <button key={s} onClick={() => { setPlaybackRate(s); setSheet(null) }} style={rowStyle(s === playbackRate)}>
                {s === 1 ? 'Normal' : `${s}x`}{s === playbackRate && <span>✓</span>}
              </button>
            ))}
          </Sheet>
        )}
      </AnimatePresence>

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
