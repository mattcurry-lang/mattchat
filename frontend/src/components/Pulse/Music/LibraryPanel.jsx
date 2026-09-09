import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { IconX, IconMusic, IconHeart, IconListMusic } from '../../Icons'

/**
 * components/Pulse/Music/LibraryPanel.jsx
 *
 * Spotify's left sidebar, adapted as a slide-in panel since our Music
 * screen is an overlay, not a permanent app shell column. Opens over
 * the home content from the right (mirrors how QueueDrawer/ShareTrackSheet
 * already behave), listing playlists + Liked Songs + recently played
 * artists in one scrollable rail.
 */
export default function LibraryPanel({ playlists, onOpenPlaylist, onClose }) {
  const { likedTracks, recentlyPlayed, playTrack } = useMusicPlayer()

  // dedupe recently played down to distinct artists, Spotify-sidebar style
  const recentArtists = []
  const seen = new Set()
  for (const t of recentlyPlayed) {
    if (seen.has(t.artist)) continue
    seen.add(t.artist)
    recentArtists.push(t)
    if (recentArtists.length >= 6) break
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{ position: 'fixed', inset: 0, zIndex: 850, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
        style={{
          width: 'min(360px, 88vw)', height: '100%', overflowY: 'auto',
          background: 'var(--bg-surface-1)', borderLeft: '1px solid var(--border)',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.4)',
          padding: '18px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Your Library</h3>
          <button onClick={onClose} aria-label="Close library"
            style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconX size={15} />
          </button>
        </div>

        {/* Liked Songs — pinned at the top, same treatment Spotify gives it */}
        <button
          onClick={() => likedTracks.length && playTrack(likedTracks[0], likedTracks)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginBottom: 8,
            background: 'linear-gradient(135deg, rgba(167,139,250,0.22), rgba(108,99,255,0.14))',
            border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '10px 12px',
            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 8, background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconHeart size={18} filled style={{ color: '#fff' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)' }}>Liked Songs</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{likedTracks.length} songs</div>
          </div>
        </button>

        {/* Playlists */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '18px 0 8px' }}>
          Playlists
        </div>
        {playlists.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 2px 12px' }}>No playlists yet.</div>
        ) : (
          playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => { onOpenPlaylist(p.id); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '8px 4px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.artwork_url ? <img src={p.artwork_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconListMusic size={17} style={{ color: 'var(--text-muted)' }} />}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
            </button>
          ))
        )}

        {/* Recently played artists */}
        {recentArtists.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '18px 0 8px' }}>
              Recently Played
            </div>
            {recentArtists.map((t) => (
              <button
                key={t.id}
                onClick={() => playTrack(t)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '8px 4px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t.artwork ? <img src={t.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={16} style={{ color: 'var(--text-muted)' }} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Artist</div>
                </div>
              </button>
            ))}
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
