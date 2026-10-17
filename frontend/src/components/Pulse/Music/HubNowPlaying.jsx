import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { useDominantColor, rgba } from '../../../lib/music/extractColor'
import { RecommendationEngine } from '../../../lib/music/RecommendationEngine'
import { IconMusic, IconHeart, IconShare2, IconPlus, IconChevronLeft, IconChevronRight, IconMaximize } from '../../Icons'
import { IconMoon } from './PlayerIcons'
import TrackArt from './TrackArt'
import Equalizer from './Equalizer'
import LyricsPanel from './LyricsPanel'
import UpNextPanel from './UpNextPanel'
import TrackDownloadAction from './TrackDownloadAction'
import DownloadAllButton from './DownloadAllButton'
import { SleepSheet, SpeedSheet, PlaylistSheet } from './PlayerSheets'
import ShareTrackSheet from './ShareTrackSheet'

const COLLAPSE_KEY = 'mattchat:music:hubPanelCollapsed'
const W = 300
const RAIL = 68

/** Long titles slide into view on hover instead of being cut off with "…". */
function Marquee({ text, style }) {
  const outer = useRef(null)
  const inner = useRef(null)
  const [shift, setShift] = useState(0)
  const [hot, setHot] = useState(false)
  useEffect(() => {
    if (outer.current && inner.current) setShift(Math.max(0, inner.current.scrollWidth - outer.current.clientWidth))
  }, [text])
  return (
    <div ref={outer} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} title={text}
      style={{ overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0, flex: 1, ...style }}>
      <span ref={inner} style={{
        display: 'inline-block', transform: hot && shift ? `translateX(-${shift}px)` : 'translateX(0)',
        transition: hot && shift ? `transform ${Math.max(1.2, shift / 40)}s linear` : 'transform .4s ease',
      }}>{text}</span>
    </div>
  )
}

/** Album "sleeve" with the vinyl peeking out; the record slides out and spins while playing. */
function Sleeve({ track, playing, dominant, colors }) {
  const S = 214
  const D = 196
  return (
    <div style={{ position: 'relative', height: S, margin: '4px 0 18px' }}>
      <style>{`@keyframes mc-vinyl{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        position: 'absolute', top: (S - D) / 2, left: playing ? W - 32 - D : 34, width: D, height: D, borderRadius: '50%',
        transition: 'left .7s cubic-bezier(.3,.9,.3,1)', filter: `drop-shadow(0 8px 18px ${rgba(dominant, 0.35)})`,
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%', position: 'relative', overflow: 'hidden',
          background: 'repeating-radial-gradient(circle at center, #0b0b10 0 2px, #181821 2px 3px)',
          animation: 'mc-vinyl 9s linear infinite', animationPlayState: playing ? 'running' : 'paused',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'conic-gradient(from 30deg, transparent 0 22%, rgba(255,255,255,0.12) 30%, transparent 38% 72%, rgba(255,255,255,0.08) 80%, transparent 88%)' }} />
          <TrackArt src={track.artwork} size="36%" radius="50%" iconSize={16} style={{ position: 'absolute', top: '32%', left: '32%' }} />
          <div style={{ position: 'absolute', top: '48%', left: '48%', width: '4%', height: '4%', borderRadius: '50%', background: colors.surface1 }} />
        </div>
      </div>
      <motion.div key={track.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}
        style={{ position: 'absolute', top: 0, left: 0, width: S, height: S, zIndex: 2, boxShadow: `0 18px 42px ${rgba(dominant, 0.45)}`, borderRadius: 14 }}>
        <TrackArt src={track.artwork} size={S} radius={14} iconSize={44} />
      </motion.div>
    </div>
  )
}

export default function HubNowPlaying({ colors, fallbackTrack, conversations = [], onShareTrack }) {
  const {
    currentTrack: playing, isPlaying, currentTime, seekTo, isLiked, toggleLike, recentlyPlayed, playTrack, addToQueue,
    queue, playbackRate, setPlaybackRate, sleepTimer, setSleepTimer, setIsFullPlayerVisible,autoCacheEnabled, setAutoCacheEnabled,
  } = useMusicPlayer()
  const currentTrack = playing || fallbackTrack
  const dominant = useDominantColor(currentTrack?.artwork)
  const [tab, setTab] = useState('now') // now | lyrics | queue
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false } })
  const [sheet, setSheet] = useState(null)
  const [burst, setBurst] = useState(false)
  const [related, setRelated] = useState([])
  const [now, setNow] = useState(Date.now())
  const rgb = colors.isDark ? '255,255,255' : '24,20,42'

  useEffect(() => { try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0') } catch { /* ignore */ } }, [collapsed])

  useEffect(() => {
    if (!currentTrack) return undefined
    let cancelled = false
    const fallback = () => recentlyPlayed.filter((t) => t.id !== currentTrack.id).slice(0, 5)
    RecommendationEngine.getSimilarTracks(currentTrack, new Set([currentTrack.id]), 6)
      .then((r) => { if (!cancelled) setRelated(r && r.length ? r.slice(0, 5) : fallback()) })
      .catch(() => { if (!cancelled) setRelated(fallback()) })
    return () => { cancelled = true }
  }, [currentTrack?.id]) // eslint-disable-line

  useEffect(() => {
    if (sleepTimer?.mode !== 'time') return undefined
    const id = setInterval(() => setNow(Date.now()), 15000)
    setNow(Date.now())
    return () => clearInterval(id)
  }, [sleepTimer])
  const sleepLabel = sleepTimer?.mode === 'time' ? `${Math.max(1, Math.ceil((sleepTimer.endsAt - now) / 60000))}m`
    : sleepTimer?.mode === 'track' ? 'End' : null

  const shell = (children, width) => (
    <motion.div initial={false} animate={{ width }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      style={{ flexShrink: 0, borderLeft: `1px solid ${colors.border}`, background: colors.surface1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {children}
    </motion.div>
  )

  if (!currentTrack) {
    return shell(
      <div style={{ width: W, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center', color: colors.textMuted, fontSize: 12.5 }}>
          <IconMusic size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
          <div>Play something to see it here</div>
        </div>
      </div>, W)
  }

  // ── collapsed rail: a spinning record + vertical title ──
  if (collapsed) {
    return shell(
      <div style={{ width: RAIL, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 14 }}>
        <button onClick={() => setCollapsed(false)} aria-label="Show now playing panel" title="Show now playing"
          style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', background: colors.surface2, color: colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconChevronLeft size={17} />
        </button>
        <div onClick={() => setCollapsed(false)} style={{ cursor: 'pointer', animation: 'mc-vinyl 9s linear infinite', animationPlayState: isPlaying ? 'running' : 'paused', borderRadius: '50%', boxShadow: `0 0 0 3px ${rgba(dominant, 0.5)}` }}>
          <style>{`@keyframes mc-vinyl{to{transform:rotate(360deg)}}`}</style>
          <TrackArt src={currentTrack.artwork} size={44} radius="50%" iconSize={16} />
        </div>
        <div style={{ writingMode: 'vertical-rl', fontSize: 12, fontWeight: 700, color: colors.textSecondary, maxHeight: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentTrack.title}
        </div>
        <div style={{ marginTop: 'auto' }}>{isPlaying && <Equalizer color={`rgb(${rgb})`} size={16} />}</div>
      </div>, RAIL)
  }

  const liked = isLiked(currentTrack.id)
  const handleLike = () => {
    if (!liked) { setBurst(true); setTimeout(() => setBurst(false), 600) }
    toggleLike(currentTrack)
  }
  const share = () => {
    if (conversations.length && onShareTrack) { setSheet('share'); return }
    const text = `${currentTrack.title} — ${currentTrack.artist}`
    if (navigator.share) navigator.share({ title: currentTrack.title, text }).catch(() => {})
    else navigator.clipboard?.writeText(text).catch(() => {})
  }
  const chip = (on) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 999, border: 'none', cursor: 'pointer',
    background: on ? rgba(dominant, 0.28) : colors.surface2, color: on ? colors.textPrimary : colors.textSecondary, fontFamily: 'inherit',
  })
  const tabs = [['now', 'Now'], ['lyrics', 'Lyrics'], ['queue', `Queue${queue.length > 1 ? ` · ${queue.length}` : ''}`]]
  const iconBtn = { background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, display: 'flex', padding: 4 }

  return shell(
    <div style={{ width: W, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* soft wash from the artwork's colour */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `linear-gradient(180deg, ${rgba(dominant, colors.isDark ? 0.28 : 0.18)} 0%, transparent 46%)`, transition: 'background .6s' }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '14px 12px 10px 16px' }}>
        <div role="tablist" style={{ display: 'flex', flex: 1, padding: 3, borderRadius: 999, background: colors.surface2 }}>
          {tabs.map(([id, text]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              style={{ position: 'relative', flex: 1, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800, padding: '6px 0', color: tab === id ? '#fff' : colors.textSecondary, whiteSpace: 'nowrap' }}>
              {tab === id && <motion.span layoutId="hubTabPill" transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'linear-gradient(135deg,#a78bfa,#6c63ff)' }} />}
              <span style={{ position: 'relative' }}>{text}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setIsFullPlayerVisible(true)} aria-label="Open full screen player" title="Full screen" style={iconBtn}><IconMaximize size={16} /></button>
        <button onClick={() => setCollapsed(true)} aria-label="Hide panel" title="Hide panel" style={iconBtn}><IconChevronRight size={18} /></button>
      </div>

      {tab === 'now' ? (
        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 16px 84px' }}>
          <Sleeve track={currentTrack} playing={isPlaying} dominant={dominant} colors={colors} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Marquee text={currentTrack.title} style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.2 }} />
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted, margin: '2px 0 12px' }}>{currentTrack.artist}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            <button onClick={handleLike} aria-label={liked ? 'Unlike' : 'Like'} style={{ ...iconBtn, color: liked ? '#f87171' : colors.textMuted, position: 'relative', padding: 6 }}>
              <IconHeart size={19} filled={liked} />
              <AnimatePresence>
                {burst && [0, 1, 2].map((i) => (
                  <motion.span key={i} initial={{ opacity: 1, scale: 0.4, x: 0, y: 0 }} animate={{ opacity: 0, scale: 1, x: (i - 1) * 14, y: -22 }} transition={{ duration: 0.55, ease: 'easeOut' }}
                    style={{ position: 'absolute', top: 4, left: 8, color: '#f87171', pointerEvents: 'none' }}><IconHeart size={10} filled /></motion.span>
                ))}
              </AnimatePresence>
            </button>
            <span style={{ display: 'flex', color: colors.textMuted, padding: 6 }}><TrackDownloadAction track={currentTrack} size={18} /></span>
            <button onClick={() => setSheet('playlist')} aria-label="Add to playlist" style={{ ...iconBtn, padding: 6 }}><IconPlus size={19} /></button>
            <button onClick={share} aria-label="Share" style={{ ...iconBtn, padding: 6 }}><IconShare2 size={18} /></button>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            <button onClick={() => setSheet('sleep')} style={chip(!!sleepTimer)}><IconMoon size={13} /> {sleepLabel ? `Sleep · ${sleepLabel}` : 'Sleep'}</button>
            <button onClick={() => setSheet('speed')} style={chip(playbackRate !== 1)}>{playbackRate}x speed</button>
            <button onClick={() => setAutoCacheEnabled(!autoCacheEnabled)} style={chip(autoCacheEnabled)} title="Keep songs you listen to available offline (last 10 from Music)">
  {autoCacheEnabled ? '✓ Offline auto-save' : 'Offline auto-save off'}
</button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <DownloadAllButton artistOf={currentTrack} label={`Download more by ${currentTrack.artist}`} />
          </div>

          {related.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>More like this</div>
              {related.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => playTrack(t, related)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, padding: '6px 6px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = colors.surface2 }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    <TrackArt src={t.artwork} size={38} radius={7} iconSize={13} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist}</div>
                    </div>
                  </button>
                  <button onClick={() => addToQueue(t)} aria-label="Add to queue" title="Add to queue" style={{ ...iconBtn, padding: 7 }}><IconPlus size={15} /></button>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 72 }}>
          {tab === 'lyrics'
            ? <LyricsPanel track={currentTrack} currentTime={currentTime} seekTo={seekTo} rgb={rgb} />
            : <UpNextPanel rgb={rgb} />}
        </div>
      )}

      <AnimatePresence>
        {sheet === 'sleep' && <SleepSheet key="sleep" sleepTimer={sleepTimer} remainingLabel={sleepLabel} onPick={setSleepTimer} onClose={() => setSheet(null)} />}
        {sheet === 'speed' && <SpeedSheet key="speed" rate={playbackRate} onPick={setPlaybackRate} onClose={() => setSheet(null)} />}
        {sheet === 'playlist' && <PlaylistSheet key="pl" track={currentTrack} onClose={() => setSheet(null)} />}
      </AnimatePresence>
      <AnimatePresence>
  {sheet === 'share' && (
    <ShareTrackSheet key="share" track={currentTrack} conversations={conversations}
      onShare={(cid, t, note) => onShareTrack(cid, t, note)} onClose={() => setSheet(null)} />
  )}
</AnimatePresence>
    </div>, W)
}
