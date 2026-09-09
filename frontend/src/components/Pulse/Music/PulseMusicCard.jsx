import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import MusicSearch from './MusicSearch'
import TrackRail from './TrackRail'
import PlaylistsSection from './PlaylistsSection'
import BecomeArtistModal from './BecomeArtistModal'
import ArtistDashboard from './ArtistDashboard'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { MusicService } from '../../../lib/music/MusicService'
import { ArtistService } from '../../../lib/music/ArtistService'
import { useDominantColor, rgba } from '../../../lib/music/extractColor'
import { IconMusic, IconX, IconPlay, IconMic } from '../../Icons'

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

function QuickPickTile({ track, onPress }) {
  return (
    <button
      onClick={onPress}
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
    </button>
  )
}

export function PulseMusicOverlay({ userId, onClose }) {
  const { recentlyPlayed, likedTracks, playTrack } = useMusicPlayer()
  const [trending, setTrending] = useState([])
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
    return () => { cancelled = true }
  }, [])

  // Powers the "Artist Studio" entry point — whether it opens
  // BecomeArtistModal or straight into ArtistDashboard depends on
  // whether this user already has an artist profile row.
  const refreshArtistProfile = useCallback(async () => {
    if (!userId) { setArtistChecked(true); return }
    try {
      const profile = await ArtistService.getMyArtistProfile(userId)
      setArtistProfile(profile)
    } catch {
      setArtistProfile(null)
    } finally {
      setArtistChecked(true)
    }
  }, [userId])

  useEffect(() => { refreshArtistProfile() }, [refreshArtistProfile])

  const heroTrack = trending[0] || recentlyPlayed[0] || likedTracks[0] || null
  const dominant = useDominantColor(heroTrack?.artwork)
  const quickPicks = [...recentlyPlayed.slice(0, 4), ...likedTracks.slice(0, 4)].slice(0, 6)

  const openArtistStudio = () => {
    if (artistProfile) setShowDashboard(true)
    else setShowBecomeArtist(true)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--bg-surface-1)', overflowY: 'auto' }}>
      {/* hero band — color pulled from whatever's on top of the mix,
          fading down into the app's own surface color rather than a
          hardcoded black, so this still reads correctly in light mode */}
      <div style={{
        position: 'relative', padding: '16px 16px 26px',
        background: `linear-gradient(180deg, ${rgba(dominant, 0.55)} 0%, ${rgba(dominant, 0.18)} 55%, var(--bg-surface-1) 100%)`,
        transition: 'background 0.6s ease',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: -0.4, textShadow: '0 2px 12px rgba(0,0,0,0.35)' }}>Music</h2>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px', paddingBottom: 140 }}>
        {/* Prompt banner for users who haven't set up an artist
            profile yet — the entry point isn't hidden behind an icon
            only, in case people miss the header button. */}
        {artistChecked && !artistProfile && (
          <motion.button
            onClick={() => setShowBecomeArtist(true)}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
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
          </motion.button>
        )}

        {quickPicks.length > 0 && (
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: -0.2 }}>Jump back in</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {quickPicks.map((t) => <QuickPickTile key={t.id} track={t} onPress={() => playTrack(t, quickPicks)} />)}
            </div>
          </div>
        )}

        {trending.length > 0 && <TrackRail title="Trending" tracks={trending} />}
        {trendingError && trending.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Trending is temporarily unavailable.</div>
        )}

        <PlaylistsSection />

        {recentlyPlayed.length > 0 && <TrackRail title="Recently Played" tracks={recentlyPlayed} />}
        {likedTracks.length > 0 && <TrackRail title="Liked Music" tracks={likedTracks} />}

        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: -0.2 }}>Search</div>
          <MusicSearch autoFocus={false} />
        </div>
      </div>

      {showBecomeArtist && (
        <BecomeArtistModal
          userId={userId}
          onClose={() => setShowBecomeArtist(false)}
          onCreated={(artist) => { setArtistProfile(artist); setShowBecomeArtist(false); setShowDashboard(true) }}
        />
      )}
      {showDashboard && (
        <ArtistDashboard userId={userId} onClose={() => setShowDashboard(false)} />
      )}
    </div>
  )
}

export default function PulseMusicCard({ userId }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <PulseMusicEntryCard onOpen={() => setOpen(true)} />
      {open && <PulseMusicOverlay userId={userId} onClose={() => setOpen(false)} />}
    </>
  )
}
