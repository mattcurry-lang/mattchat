import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { useDominantColor, rgba } from '../../../lib/music/extractColor'
import { useIsDesktop } from '../../../hooks/useIsDesktop'
import {
  IconPlay, IconPause, IconSkipBack, IconSkipForward, IconChevronDown,
  IconShuffle, IconRepeat, IconHeart, IconShare2, IconVolume2, IconLoader2,IconX, IconPlus,
} from '../../Icons'
import { IconDisc, IconSquareArt, IconMoon, IconVolumeX, IconPanelRight } from './PlayerIcons'
import TrackArt from './TrackArt'
import LyricsPanel from './LyricsPanel'
import UpNextPanel from './UpNextPanel'
import { SleepSheet, SpeedSheet, PlaylistSheet } from './PlayerSheets'
import ShareTrackSheet from './ShareTrackSheet'
import TrackDownloadAction from './TrackDownloadAction'

const ART_MODE_KEY = 'mattchat:music:artMode'
const PANEL_KEY = 'mattchat:music:fullPanelOpen'
const BG = '#0b0b13'

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const iconBtn = (active) => ({
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: active ? '#fff' : 'rgba(255,255,255,0.6)', position: 'relative',
})

function SeekBar({ current, duration, onSeek, glow }) {
  const barRef = useRef(null)
  const [scrub, setScrub] = useState(null)
  const [hot, setHot] = useState(false)
  const ratio = (e) => {
    const r = barRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
  }
  const shown = scrub ?? current
  const pct = duration > 0 ? Math.min(100, (shown / duration) * 100) : 0
  const big = hot || scrub !== null
  return (
    <div style={{ padding: '14px 0 2px' }}>
      <div
        ref={barRef} role="slider" tabIndex={0} aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(duration || 0)} aria-valuenow={Math.round(shown || 0)}
        onPointerDown={(e) => { if (!duration) return; e.currentTarget.setPointerCapture(e.pointerId); setScrub(ratio(e) * duration) }}
        onPointerMove={(e) => { if (scrub !== null) setScrub(ratio(e) * duration) }}
        onPointerUp={(e) => { if (scrub !== null) { onSeek(ratio(e) * duration); setScrub(null) } }}
        onPointerCancel={() => setScrub(null)}
        onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(Math.min(duration, current + 5)) }
          if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(Math.max(0, current - 5)) }
        }}
        style={{ height: 24, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none', outline: 'none' }}
      >
        <div style={{ position: 'relative', width: '100%', height: big ? 6 : 4, borderRadius: 3, background: 'rgba(255,255,255,0.18)', transition: 'height .12s' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 3, background: '#fff', boxShadow: `0 0 12px ${glow}` }} />
          <div style={{ position: 'absolute', top: '50%', left: `${pct}%`, width: 14, height: 14, borderRadius: '50%', background: '#fff', transform: `translate(-50%,-50%) scale(${big ? 1 : 0.0})`, transition: 'transform .12s', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums' }}>
        <span>{formatTime(shown)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}

function Disc({ track, playing, size, glow }) {
  return (
    <div style={{ width: size, height: size, position: 'relative', filter: `drop-shadow(0 22px 40px ${glow})` }}>
      <style>{`@keyframes mc-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%', position: 'relative', overflow: 'hidden',
        background: 'repeating-radial-gradient(circle at center, #0d0d12 0 2px, #17171f 2px 3px)',
        animation: 'mc-spin 14s linear infinite', animationPlayState: playing ? 'running' : 'paused',
        border: '2px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'conic-gradient(from 20deg, transparent 0 20%, rgba(255,255,255,0.10) 28%, transparent 36% 70%, rgba(255,255,255,0.08) 78%, transparent 86%)' }} />
        <TrackArt src={track.artwork} size="62%" radius="50%" iconSize={40}
          style={{ position: 'absolute', top: '19%', left: '19%', boxShadow: '0 0 0 3px rgba(0,0,0,0.55)' }} />
        <div style={{ position: 'absolute', top: '47%', left: '47%', width: '6%', height: '6%', borderRadius: '50%', background: BG, boxShadow: '0 0 0 2px rgba(255,255,255,0.25)' }} />
      </div>
    </div>
  )
}

export default function FullPlayer({ onClose, conversations = [], onShareTrack }) {
  const {
    currentTrack, isPlaying, isLoading, error, currentTime, duration, volume,
    togglePlayPause, seekTo, setVolume, playNext, playPrevious,
    shuffle, toggleShuffle, repeatMode, cycleRepeat,
    isLiked, toggleLike, queue, playbackRate, setPlaybackRate, sleepTimer, setSleepTimer,
  } = useMusicPlayer()

  const isDesktop = useIsDesktop()
  const dominant = useDominantColor(currentTrack?.artwork)
  const dragControls = useDragControls()
  const [tab, setTab] = useState('now') // now | lyrics | queue
  const [artMode, setArtMode] = useState(() => { try { return localStorage.getItem(ART_MODE_KEY) || 'cover' } catch { return 'cover' } })
  const [sheet, setSheet] = useState(null) // sleep | speed | playlist | share
    const [panelOpen, setPanelOpen] = useState(() => { try { return localStorage.getItem(PANEL_KEY) !== '0' } catch { return true } })
  useEffect(() => { try { localStorage.setItem(PANEL_KEY, panelOpen ? '1' : '0') } catch { /* ignore */ } }, [panelOpen])
  const [now, setNow] = useState(Date.now())
  const prevVolume = useRef(0.85)

  useEffect(() => { try { localStorage.setItem(ART_MODE_KEY, artMode) } catch { /* ignore */ } }, [artMode])

  // sleep countdown label
  useEffect(() => {
    if (sleepTimer?.mode !== 'time') return undefined
    const id = setInterval(() => setNow(Date.now()), 15000)
    setNow(Date.now())
    return () => clearInterval(id)
  }, [sleepTimer])
  const sleepLabel = sleepTimer?.mode === 'time'
    ? `${Math.max(1, Math.ceil((sleepTimer.endsAt - now) / 60000))}m`
    : sleepTimer?.mode === 'track' ? 'End' : null

  // keyboard shortcuts (desktop)
  const kb = useRef({})
  kb.current = { currentTrack, currentTime, duration, volume, sheet, onClose }
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (t && (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName) || t.isContentEditable || t.getAttribute?.('role') === 'slider')) return
      const k = kb.current
      if (!k.currentTrack) return
      if (e.key === 'Escape') { if (k.sheet) setSheet(null); else k.onClose(); return }
      if (e.key === ' ') { e.preventDefault(); togglePlayPause() }
      else if (e.key === 'ArrowRight') seekTo(Math.min(k.duration, k.currentTime + 5))
      else if (e.key === 'ArrowLeft') seekTo(Math.max(0, k.currentTime - 5))
      else if (e.key === 'ArrowUp') { e.preventDefault(); setVolume(k.volume + 0.05) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setVolume(k.volume - 0.05) }
      else if (e.key === 'n') playNext()
      else if (e.key === 'p') playPrevious()
      else if (e.key === 'l') toggleLike(k.currentTrack)
      else if (e.key === 'h') setPanelOpen((o) => !o)
      else if (e.key === 'm') { if (k.volume > 0) { prevVolume.current = k.volume; setVolume(0) } else setVolume(prevVolume.current || 0.85) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlayPause, seekTo, setVolume, playNext, playPrevious, toggleLike])

  if (!currentTrack) return null

  const liked = isLiked(currentTrack.id)
  const glow = rgba(dominant, 0.6)
  const activeTab = isDesktop && tab === 'now' ? 'lyrics' : tab
  const muted = volume === 0
   const showPanel = isDesktop && panelOpen
  const artSize = isDesktop ? (panelOpen ? 'min(46vh, 420px)' : 'min(54vh, 500px)') : 'min(80vw, 40vh, 340px)'
  const tabs = isDesktop
    ? [['lyrics', 'Lyrics'], ['queue', 'Up Next']]
    : [['now', 'Player'], ['lyrics', 'Lyrics'], ['queue', 'Up Next']]

  const toggleMute = () => {
    if (volume > 0) { prevVolume.current = volume; setVolume(0) } else setVolume(prevVolume.current || 0.85)
  }

  const art = (
    <div style={{ flex: isDesktop ? 1 : '1 1 auto', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isDesktop ? 0 : '0 24px' }}>
      <AnimatePresence mode="wait">
        {artMode === 'disc' ? (
          <motion.div key={`d-${currentTrack.id}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }}>
            <Disc track={currentTrack} playing={isPlaying} size={artSize} glow={rgba(dominant, 0.45)} />
          </motion.div>
        ) : (
          <motion.div
            key={`c-${currentTrack.id}`}
            drag="x" dragSnapToOrigin dragElastic={0.45} dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => { if (info.offset.x < -80) playNext(); else if (info.offset.x > 80) playPrevious() }}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: isPlaying ? 1 : 0.9 }} exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            style={{ width: artSize, height: artSize, borderRadius: 18, overflow: 'hidden', boxShadow: `0 28px 60px ${rgba(dominant, 0.5)}`, touchAction: 'pan-y' }}
          >
            <TrackArt src={currentTrack.artwork} size="100%" radius={0} iconSize={64} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  const info = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 8 }}>
      <AnimatePresence mode="wait">
        <motion.div key={currentTrack.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.22 }} style={{ minWidth: 0 }}>
          <div style={{ fontSize: isDesktop ? 26 : 21, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: -0.4 }}>{currentTrack.title}</div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.68)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.artist}</div>
        </motion.div>
      </AnimatePresence>
      <motion.button
        onClick={() => toggleLike(currentTrack)} whileTap={{ scale: 1.35 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        aria-label={liked ? 'Unlike' : 'Like'} aria-pressed={liked}
        style={{ ...iconBtn(true), color: liked ? '#f87171' : 'rgba(255,255,255,0.75)', flexShrink: 0 }}
      >
        <IconHeart size={25} filled={liked} />
      </motion.button>
    </div>
  )

  const controls = (
    <div style={{ width: '100%', maxWidth: isDesktop ? 520 : 460, margin: '0 auto', padding: isDesktop ? 0 : '0 24px' }}>
      {info}
      {error && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12.5, color: '#fca5a5', background: 'rgba(248,113,113,0.12)', borderRadius: 10, padding: '8px 12px' }}>
          <span>{error}</span>
          <button onClick={playNext} style={{ background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, borderRadius: 999, padding: '5px 12px', cursor: 'pointer' }}>Skip</button>
        </div>
      )}
      <SeekBar current={currentTime} duration={duration} onSeek={seekTo} glow={glow} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
        <button onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffle} style={iconBtn(shuffle)}>
          <IconShuffle size={21} />{shuffle && <span style={{ position: 'absolute', bottom: 0, width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />}
        </button>
        <button onClick={playPrevious} aria-label="Previous" style={{ ...iconBtn(true), color: '#fff' }}><IconSkipBack size={30} /></button>
        <motion.button
          onClick={togglePlayPause} whileTap={{ scale: 0.92 }} aria-label={isPlaying ? 'Pause' : 'Play'}
          style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#fff', color: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 12px 30px ${glow}` }}
        >
          {isLoading ? (
            <><style>{`@keyframes mc-spin{to{transform:rotate(360deg)}}`}</style><IconLoader2 size={28} style={{ animation: 'mc-spin .8s linear infinite' }} /></>
          ) : isPlaying ? <IconPause size={30} /> : <IconPlay size={30} />}
        </motion.button>
        <button onClick={playNext} aria-label="Next" style={{ ...iconBtn(true), color: '#fff' }}><IconSkipForward size={30} /></button>
        <button onClick={cycleRepeat} aria-label={`Repeat ${repeatMode}`} aria-pressed={repeatMode !== 'off'} style={iconBtn(repeatMode !== 'off')}>
          <IconRepeat size={21} />
          {repeatMode === 'one' && <span style={{ position: 'absolute', top: 6, right: 4, fontSize: 9, fontWeight: 900 }}>1</span>}
          {repeatMode !== 'off' && <span style={{ position: 'absolute', bottom: 0, width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />}
        </button>
      </div>

      {/* Boomplay-style action strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', display: 'flex' }}><TrackDownloadAction track={currentTrack} size={20} /></span>
        <button onClick={() => setSheet('playlist')} aria-label="Add to playlist" style={iconBtn(false)}><IconPlus size={21} /></button>
        <button onClick={() => setSheet('sleep')} aria-label="Sleep timer" style={{ ...iconBtn(!!sleepTimer), gap: 4, color: sleepTimer ? '#a78bfa' : 'rgba(255,255,255,0.6)' }}>
          <IconMoon size={20} />{sleepLabel && <span style={{ fontSize: 11, fontWeight: 800 }}>{sleepLabel}</span>}
        </button>
        <button onClick={() => setSheet('speed')} aria-label="Playback speed" style={{ ...iconBtn(playbackRate !== 1), fontSize: 13, fontWeight: 800, minWidth: 40, color: playbackRate !== 1 ? '#a78bfa' : 'rgba(255,255,255,0.6)' }}>
          {playbackRate}x
        </button>
        <button onClick={() => setSheet('share')} aria-label="Share" style={iconBtn(false)}><IconShare2 size={20} /></button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px 16px' }}>
        <button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} style={{ ...iconBtn(false), padding: 4 }}>
          {muted ? <IconVolumeX size={17} /> : <IconVolume2 size={17} />}
        </button>
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} aria-label="Volume" style={{ flex: 1, accentColor: '#fff' }} />
      </div>
    </div>
  )

  const panel = activeTab === 'lyrics'
    ? <LyricsPanel track={currentTrack} currentTime={currentTime} seekTo={seekTo} large={isDesktop} />
    : activeTab === 'queue' ? <UpNextPanel /> : null

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      drag="y" dragControls={dragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }}
      onDragEnd={(_, info) => { if (info.offset.y > 140 || info.velocity.y > 700) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 700, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BG,
        paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* colour wash from artwork + blurred art texture */}
      <AnimatePresence mode="sync">
        <motion.div key={currentTrack.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }}
          style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${rgba(dominant, 0.85)} 0%, ${rgba(dominant, 0.35)} 38%, ${BG} 78%)` }} />
      </AnimatePresence>
      {currentTrack.artwork && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${currentTrack.artwork})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(70px) saturate(1.5)', opacity: 0.28, transform: 'scale(1.3)' }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* header — also the swipe-down handle */}
        <div onPointerDown={(e) => dragControls.start(e)} style={{ touchAction: 'none', cursor: 'grab' }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)', margin: '8px auto 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px 10px' }}>
            <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="Minimize player"
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <IconChevronDown size={19} />
            </button>
            <div onPointerDown={(e) => e.stopPropagation()} role="tablist" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(10px)' }}>
              {tabs.map(([id, text]) => {
                             const on = activeTab === id && (!isDesktop || panelOpen)
                return (
                  <button key={id} role="tab" aria-selected={on}
                    onClick={() => {
                      if (isDesktop) {
                        if (panelOpen && activeTab === id) setPanelOpen(false)
                        else { setTab(id); setPanelOpen(true) }
                      } else setTab(id)
                    }}
                    style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, padding: '7px 14px', borderRadius: 999, background: on ? '#fff' : 'transparent', color: on ? '#0f0f1a' : 'rgba(255,255,255,0.75)', transition: 'all .2s' }}>
                    {text}{id === 'queue' && queue.length > 1 ? ` · ${queue.length}` : ''}
                  </button>
                )
              })}
            </div>
                      <div style={{ display: 'flex', gap: 8 }} onPointerDown={(e) => e.stopPropagation()}>
              {isDesktop && (
                <button onClick={() => setPanelOpen((o) => !o)} aria-label={panelOpen ? 'Hide lyrics and queue panel' : 'Show lyrics and queue panel'} title={panelOpen ? 'Hide panel (H)' : 'Show panel (H)'} aria-pressed={panelOpen}
                  style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: panelOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <IconPanelRight size={18} />
                </button>
              )}
              <button onClick={() => setArtMode((m) => (m === 'cover' ? 'disc' : 'cover'))}
                aria-label={artMode === 'cover' ? 'Switch to vinyl view' : 'Switch to cover view'}
                style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                {artMode === 'cover' ? <IconDisc size={18} /> : <IconSquareArt size={18} />}
              </button>
            </div>
          </div>
        </div>

        {isDesktop ? (
                 <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 56, padding: '8px 56px 12px', width: '100%', maxWidth: showPanel ? 1280 : 720, margin: '0 auto', transition: 'max-width .35s ease' }}>
            <div style={{ flex: showPanel ? '0 0 46%' : '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>{art}{controls}</div>
            {showPanel && (
              <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}
                style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRadius: 20, background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(14px)', overflow: 'hidden', position: 'relative' }}>
                <button onClick={() => setPanelOpen(false)} aria-label="Hide panel" title="Hide panel (H)"
                  style={{ position: 'absolute', top: 10, right: 10, zIndex: 3, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <IconX size={14} />
                </button>
                {panel}
              </motion.div>
            )}
          </div>
        ) : (
          <>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{activeTab === 'now' ? art : panel}</div>
            {controls}
          </>
        )}
      </div>

      <AnimatePresence>
        {sheet === 'sleep' && <SleepSheet key="sleep" sleepTimer={sleepTimer} remainingLabel={sleepLabel} onPick={setSleepTimer} onClose={() => setSheet(null)} />}
        {sheet === 'speed' && <SpeedSheet key="speed" rate={playbackRate} onPick={setPlaybackRate} onClose={() => setSheet(null)} />}
        {sheet === 'playlist' && <PlaylistSheet key="pl" track={currentTrack} onClose={() => setSheet(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {sheet === 'share' && (
          <ShareTrackSheet
            track={currentTrack} conversations={conversations}
           onShare={(conversationId, track, note) => onShareTrack && onShareTrack(conversationId, track, note)}
            onClose={() => setSheet(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
