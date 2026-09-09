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
import { IconMusic, IconX, IconPlay, IconMic, IconSearch, IconListMusic } from '../../Icons'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function PulseMusicEntryCard({ onOpen }) {
  return (
    <button
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(108,99,255,0.10)), var(--bg-surface-2)',
        border: '1px solid rgba(167,139,250,0.3)', borderRadius: 16, padding: '14px 16px',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
      }}
    >
      <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(108,99,255,0.4)' }}>
        <IconMusic size={19} style={{ color: '#fff' }} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Music</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Discover, search, and play — keeps going while you chat</div>
      </div>
    </button>
  )
}

function QuickPickTile({ track, onPress, index }) {
  return (
    <motion.button
      onClick={onPress}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.25 }}
      whileHover={{ background: 'var(--bg-surface-2)' }} whileTap={{ scale: 0.97 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.045)',
        border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
        padding: 0, textAlign: 'left', height: 56,
      }}
    >
      <div style={{ width: 56, height: 56, flexShrink: 0, background: 'var(--bg-surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {track.artwork ? <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={16} style={{ color: 'var(--text-muted)' }} />}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 10 }}>
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
      style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--bg-surface-1)', display: 'flex', flexDirection: 'column' }}
    >
      {/* ── sticky top bar: search + library + close, Spotify's header row ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', background: 'var(--bg-surface-1)', borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={() => setShowSearch((s) => !s)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-surface-2)',
            border: '1px solid var(--border)', borderRadius: 999, padding: '10px 16px',
            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'var(--text-muted)', fontSize: 13.5,
          }}
        >
          <IconSearch size={16} />
          What do you want to play?
        </button>
        <button
          onClick={() => setShowLibrary(true)}
          aria-label="Your Library"
          style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <IconListMusic size={16} />
        </button>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <IconX size={16} />
        </button>
      </div>

      {/* expandable search — Spotify pops a results overlay when you click the bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface-1)' }}
          >
            <div style={{ padding: '14px 16px', maxWidth: 640, margin: '0 auto', width: '100%' }}>
              <MusicSearch autoFocus />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* hero */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
          style={{
            position: 'relative', padding: '20px 16px 26px',
            background: `linear-gradient(180deg, ${rgba(dominant, 0.5)} 0%, ${rgba(dominant, 0.15)} 55%, var(--bg-surface-1) 100%)`,
            transition: 'background 0.6s ease',
          }}
        >
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: -0.4, textShadow: '0 2px 12px rgba(0,0,0,0.35)' }}>
                {greeting()}
              </h2>
              <button
                onClick={openArtistStudio}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 11.5, fontWeight: 700 }}
              >
                <IconMic size={13} /> {artistProfile ? 'Your Studio' : 'Become an Artist'}
              </button>
            </div>

            {/* tabs — filters the home feed sections below */}
            <div style={{ display: 'flex', gap: 8, marginBottom: heroTrack ? 16 : 0 }}>
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                    border: 'none', color: activeTab === tab ? '#0f0f1a' : '#fff',
                    background: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.14)',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {heroTrack && (
              <motion.div key={heroTrack.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 88, height: 88, borderRadius: 14, overflow: 'hidden', flexShrink: 0, boxShadow: '0 16px 40px rgba(0,0,0,0.4)', background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {heroTrack.artwork ? <img src={heroTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={28} style={{ color: 'var(--text-muted)' }} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, textShadow: '0 1px 6px rgba(0,0,0,0.3)' }}>
                    Pick up where you left off
                  </div>
                  <div style={{ fontSize: 16.5, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}>
                    {heroTrack.title}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 10, textShadow: '0 1px 6px rgba(0,0,0,0.3)' }}>{heroTrack.artist}</div>
                  <button
                    onClick={() => playTrack(heroTrack)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: '#0f0f1a', background: '#fff', border: 'none', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}
                  >
                    <IconPlay size={13} /> Play
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px', paddingBottom: 140 }}>
          {artistChecked && !artistProfile && (
            <Section>
              <button
                onClick={() => setShowBecomeArtist(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginBottom: 24,
                  background: 'linear-gradient(135deg, rgba(167,139,250,0.14), rgba(108,99,255,0.08))',
                  border: '1px solid rgba(167,139,250,0.28)', borderRadius: 14, padding: '12px 14px',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconMic size={16} style={{ color: '#fff' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Make music? Publish it here.</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Upload tracks, get real plays and likes from Mattchat listeners</div>
                </div>
              </button>
            </Section>
          )}

          {(activeTab === 'All' || activeTab === 'Songs') && quickPicks.length > 0 && (
            <Section delay={0.03} style={{ marginBottom: 26 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: -0.2 }}>Jump back in</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {quickPicks.map((t, i) => <QuickPickTile key={t.id} track={t} index={i} onPress={() => playTrack(t, quickPicks)} />)}
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
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Trending is temporarily unavailable.</div>
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

      <AnimatePresence>
        {showLibrary && (
          <LibraryPanel
            playlists={playlists}
            onOpenPlaylist={() => { /* PlaylistsSection already owns the open-detail flow — this closes the drawer and lets the user tap the tile themselves for now */ }}
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
<button onClick={() => playTrack({
  id: 'youtube:jNQXAC9IVRw',
  provider: 'youtube',
  providerTrackId: 'jNQXAC9IVRw', // "Me at the zoo" - always embeddable, YouTube's own reference video
  title: 'Test Video',
  artist: 'Test',
  artwork: null,
  duration: 19,
})}>
  Test YouTube Playback
</button>

export default function PulseMusicCard() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <PulseMusicEntryCard onOpen={() => setOpen(true)} />
      <AnimatePresence>{open && <PulseMusicOverlay onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  )
}
