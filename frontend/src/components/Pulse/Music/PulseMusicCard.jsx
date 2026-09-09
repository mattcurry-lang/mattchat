import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import MusicSearch from './MusicSearch'
import TrackRail from './TrackRail'
import PlaylistsSection from './PlaylistsSection'
import BecomeArtistModal from './BecomeArtistModal'
import ArtistDashboard from './ArtistDashboard'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { MusicService } from '../../../lib/music/MusicService'
import { YouTubeMusicProvider } from '../../../lib/music/providers/YouTubeMusicProvider'
import { ArtistService } from '../../../lib/music/ArtistService'
import { useDominantColor, rgba } from '../../../lib/music/extractColor'
import { IconMusic, IconX, IconPlay, IconMic } from '../../Icons'

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-surface-2)',
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

// staggered fade-up wrapper — every section on this screen uses it,
// so the whole home feels like it's assembling itself smoothly
// rather than popping in as one flat block
function Section({ delay = 0, children, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      style={style}
    >
      {children}
    </motion.div>
  )
}

export function PulseMusicOverlay({ onClose }) {
  const { userId, recentlyPlayed, likedTracks, playTrack } = useMusicPlayer()
  const [trending, setTrending] = useState([])
  const [mainstream, setMainstream] = useState([])
  const [trendingError, setTrendingError] = useState(false)
  const [artistProfile, setArtistProfile] = useState(null)
  const [artistChecked, setArtistChecked] = useState(false)
  const [showBecomeArtist, setShowBecomeArtist] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)

  useEffect(() => {
    let cancelled = false
    MusicService.getTrending({ limit: 15 })
      .then((tracks) => { if (!cancelled) setTrending(tracks) })
      .catch(() => { if (!cancelled) setTrendingError(true) })
    YouTubeMusicProvider.getTrending({ limit: 15 })
      .then((tracks) => { if (!cancelled) setMainstream(tracks) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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
      style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--bg-surface-1)', overflowY: 'auto' }}
    >
      {/* hero — color pulled live from whatever's on top of the mix */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
        style={{
          position: 'relative', padding: '16px 16px 26px',
          background: `linear-gradient(180deg, ${rgba(dominant, 0.55)} 0%, ${rgba(dominant, 0.18)} 55%, var(--bg-surface-1) 100%)`,
          transition: 'background 0.6s ease',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: -0.4, textShadow: '0 2px 12px rgba(0,0,0,0.35)' }}>
              {greeting()}
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={openArtistStudio}
                title={artistProfile ? 'Your Artist Studio' : 'Become an artist'}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 11.5, fontWeight: 700 }}
              >
                <IconMic size={13} /> {artistProfile ? 'Your Studio' : 'Become an Artist'}
              </button>
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.16)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconX size={16} />
              </button>
            </div>
          </div>

          {heroTrack && (
            <motion.div
              key={heroTrack.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
              style={{ display: 'flex', alignItems: 'center', gap: 16 }}
            >
              <div style={{ width: 96, height: 96, borderRadius: 14, overflow: 'hidden', flexShrink: 0, boxShadow: '0 16px 40px rgba(0,0,0,0.4)', background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {heroTrack.artwork ? <img src={heroTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={30} style={{ color: 'var(--text-muted)' }} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, textShadow: '0 1px 6px rgba(0,0,0,0.3)' }}>
                  Pick up where you left off
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}>
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

        {quickPicks.length > 0 && (
          <Section delay={0.03} style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: -0.2 }}>Jump back in</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {quickPicks.map((t, i) => <QuickPickTile key={t.id} track={t} index={i} onPress={() => playTrack(t, quickPicks)} />)}
            </div>
          </Section>
        )}

        {mainstream.length > 0 && (
          <Section delay={0.06}>
            <TrackRail title="Mainstream Hits" tracks={mainstream} />
          </Section>
        )}

        {trending.length > 0 && (
          <Section delay={0.09}>
            <TrackRail title="Trending on Mattchat" tracks={trending} />
          </Section>
        )}
        {trendingError && trending.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Trending is temporarily unavailable.</div>
        )}

        <Section delay={0.12}><PlaylistsSection /></Section>

        {recentlyPlayed.length > 0 && <Section delay={0.15}><TrackRail title="Recently Played" tracks={recentlyPlayed} /></Section>}
        {likedTracks.length > 0 && <Section delay={0.18}><TrackRail title="Liked Music" tracks={likedTracks} /></Section>}

        <Section delay={0.21} style={{ marginTop: 6 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: -0.2 }}>Search</div>
          <MusicSearch autoFocus={false} />
        </Section>
      </div>

      <AnimatePresence>
        {showBecomeArtist && (
          <BecomeArtistModal
            userId={userId}
            onClose={() => setShowBecomeArtist(false)}
            onCreated={(artist) => { setArtistProfile(artist); setShowBecomeArtist(false); setShowDashboard(true) }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDashboard && <ArtistDashboard userId={userId} onClose={() => setShowDashboard(false)} />}
      </AnimatePresence>
    </motion.div>
  )
}

// No userId prop needed anymore — it's pulled from MusicPlayerContext,
// so PulseMusicCard can be mounted anywhere with zero wiring.
export default function PulseMusicCard() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <PulseMusicEntryCard onOpen={() => setOpen(true)} />
      <AnimatePresence>{open && <PulseMusicOverlay onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  )
}
