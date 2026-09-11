import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import MusicSearch from './MusicSearch'
import TrackRail from './TrackRail'
import PlaylistsSection from './PlaylistsSection'
import BecomeArtistModal from './BecomeArtistModal'
import ArtistDashboard from './ArtistDashboard'
import LibraryPanel from './LibraryPanel'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { MusicService } from '../../../lib/music/MusicService'
import { YouTubeMusicProvider } from '../../../lib/music/providers/YouTubeMusicProvider'
import { ArtistService } from '../../../lib/music/ArtistService'
import { PlaylistService } from '../../../lib/music/PlaylistService'
import { useDominantColor, rgba } from '../../../lib/music/extractColor'
import { useMusicColors } from '../../../hooks/useMusicColors'
import {
  IconMusic, IconX, IconPlay, IconPause, IconMic, IconSearch, IconListMusic,
  IconSkipBack, IconSkipForward, IconShuffle, IconRepeat, IconHeart, IconVolume2, IconPlus,
} from '../../Icons'
import { useIsMobile } from '../../../hooks/useIsMobile'

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
      <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(108,99,255,0.4)' }}>
        <IconMusic size={19} style={{ color: '#fff' }} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: colors.textPrimary }}>Music</div>
        <div style={{ fontSize: 11.5, color: colors.textMuted }}>Discover, search, and play — keeps going while you chat</div>
      </div>
    </button>
  )
}

// ── Left icon rail — Spotify's collapsed sidebar: pinned Liked Songs
// + a scrollable strip of playlist/mix thumbnails, no text labels ──
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

      <button
        onClick={() => likedTracks.length && playTrack(likedTracks[0], likedTracks)}
        title="Liked Songs"
        style={{
          width: 44, height: 44, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <IconHeart size={18} filled style={{ color: '#fff' }} />
      </button>

      {playlists.map((p) => (
        <button
          key={p.id}
          onClick={onOpenLibrary}
          title={p.name}
          style={{
            width: 44, height: 44, borderRadius: 10, overflow: 'hidden', border: 'none', cursor: 'pointer', padding: 0,
            background: p.artwork_url ? colors.surface2 : 'linear-gradient(135deg, rgba(167,139,250,0.35), rgba(108,99,255,0.2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {p.artwork_url ? <img src={p.artwork_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconListMusic size={16} style={{ color: 'rgba(255,255,255,0.85)' }} />}
        </button>
      ))}
    </div>
  )
}

// ── Right "Now Playing" panel — mirrors Spotify's context panel ──
function NowPlayingPanel({ colors }) {
  const { currentTrack, isLiked, toggleLike } = useMusicPlayer()
  const dominant = useDominantColor(currentTrack?.artwork)

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

  return (
    <div style={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${colors.border}`, background: colors.surface1, overflowY: 'auto', padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: colors.textPrimary, marginBottom: 14 }}>
        {currentTrack.title}
      </div>
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {currentTrack.title}
        </div>
        <button onClick={() => toggleLike(currentTrack)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: liked ? '#f87171' : colors.textMuted, flexShrink: 0, marginLeft: 8 }}>
          <IconHeart size={17} filled={liked} />
        </button>
      </div>
      <div style={{ fontSize: 13, color: colors.textMuted }}>{currentTrack.artist}</div>
    </div>
  )
}

// ── Bottom playback bar — full Spotify-style transport, replaces the
// floating pill for this screen since it's a persistent desktop layout ──
function PlaybackBar({ colors, isMobile }) {
  const {
    currentTrack, isPlaying, currentTime, duration, volume,
    togglePlayPause, seekTo, setVolume, playNext, playPrevious,
    shuffle, toggleShuffle, repeatMode, cycleRepeat, isLiked, toggleLike,
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

  
  // Spotify-mobile-style compact strip: artwork, title/artist, a thin
  // progress sliver on the top edge, like/play only. Shuffle, repeat,
  // scrubber and volume move to a full-screen "Now Playing" view on
  // real Spotify — not built yet, so they're just dropped here rather
  // than crammed into 56px.
  if (isMobile) {
    return (
      <div style={{ position: 'relative', height: 56, borderTop: `1px solid ${colors.border}`, background: colors.surface2, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 10 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, height: 2, width: `${progress}%`, background: '#a78bfa' }} />
        <div style={{ width: 38, height: 38, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: colors.surface1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {currentTrack.artwork ? <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={14} style={{ color: colors.textMuted }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</div>
          <div style={{ fontSize: 10.5, color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.artist}</div>
        </div>
        <button onClick={() => toggleLike(currentTrack)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: liked ? '#f87171' : colors.textMuted, flexShrink: 0 }}>
          <IconHeart size={16} filled={liked} />
        </button>
        <button
          onClick={togglePlayPause}
          style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#fff', color: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          {isPlaying ? <IconPause size={13} /> : <IconPlay size={13} />}
        </button>
      </div>
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
          <button
            onClick={togglePlayPause}
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#fff', color: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isPlaying ? <IconPause size={14} /> : <IconPlay size={14} />}
          </button>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 140, justifyContent: 'flex-end' }}>
        <IconVolume2 size={15} style={{ color: colors.textMuted }} />
        <input
          type="range" min={0} max={1} step={0.01} value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          style={{ width: 90, accentColor: '#a78bfa' }}
        />
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

const TABS = ['All', 'Songs', 'Playlists']

export function PulseMusicOverlay({ onClose }) {
  const { userId, recentlyPlayed, likedTracks, playTrack } = useMusicPlayer()
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
  const openArtistStudio = () => (artistProfile ? setShowDashboard(true) : setShowBecomeArtist(true))

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{ position: 'fixed', inset: 0, zIndex: 600, background: colors.surface1, display: 'flex', flexDirection: 'column' }}
    >
      {/* ── top bar: search pill (Spotify-sized) + close ── */}
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

      {/* ── main 3-column desktop layout ── */}
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
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                    border: 'none', color: activeTab === tab ? '#0f0f1a' : '#fff',
                    background: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.14)',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: '0 0 14px', letterSpacing: -0.4, textShadow: '0 2px 12px rgba(0,0,0,0.35)' }}>
              {greeting()}
            </h2>
          </motion.div>

          <div style={{ padding: isMobile ? '0 14px 100px' : '0 24px 40px' }}>
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

// onFullscreenChange: reuses the same mechanism PulsePage already
// uses for its DEKUT feature (see ChatPage.jsx's onFullscreenChange={setDekutFullscreen})
// to hide BottomNav, FloatingCurryOrb, and AIInsightsPanel while this
// screen is open — no new wiring needed in ChatPage.jsx.
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
