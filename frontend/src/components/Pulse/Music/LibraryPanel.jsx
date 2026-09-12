import React from 'react'
import { motion } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { IconX, IconMusic, IconHeart, IconListMusic } from '../../Icons'
import { useMusicColors } from '../../../hooks/useMusicColors'
import { useIsMobile } from '../../../hooks/useIsMobile'

export default function LibraryPanel({ playlists, onOpenPlaylist, onClose }) {
  const { likedTracks, recentlyPlayed, playTrack } = useMusicPlayer()
  const colors = useMusicColors()
  const isMobile = useIsMobile()

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
      style={{ position: 'fixed', inset: 0, zIndex: 850, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: isMobile ? 'stretch' : 'flex-end', alignItems: isMobile ? 'flex-end' : 'stretch' }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={isMobile ? { y: '100%' } : { x: '100%' }}
        animate={isMobile ? { y: 0 } : { x: 0 }}
        exit={isMobile ? { y: '100%' } : { x: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
        style={{
          width: isMobile ? '100%' : 'min(360px, 88vw)',
          height: isMobile ? '85vh' : '100%',
          overflowY: 'auto',
          background: colors.surface1,
          borderLeft: isMobile ? 'none' : `1px solid ${colors.border}`,
          borderTop: isMobile ? `1px solid ${colors.border}` : 'none',
          borderTopLeftRadius: isMobile ? 18 : 0,
          borderTopRightRadius: isMobile ? 18 : 0,
          boxShadow: isMobile ? '0 -12px 40px rgba(0,0,0,0.4)' : '-12px 0 40px rgba(0,0,0,0.4)',
          padding: '18px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {isMobile && (
          <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.border, margin: '0 auto 14px' }} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>Your Library</h3>
          <button onClick={onClose} aria-label="Close library"
            style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: colors.surface2, color: colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconX size={15} />
          </button>
        </div>

        <motion.button
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
          whileTap={{ scale: 0.98 }}
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
            <div style={{ fontSize: 13.5, fontWeight: 800, color: colors.textPrimary }}>Liked Songs</div>
            <div style={{ fontSize: 11.5, color: colors.textMuted }}>{likedTracks.length} songs</div>
          </div>
        </motion.button>

        <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, margin: '18px 0 8px' }}>
          Playlists
        </div>
        {playlists.length === 0 ? (
          <div style={{ fontSize: 12, color: colors.textMuted, padding: '4px 2px 12px' }}>No playlists yet.</div>
        ) : (
          playlists.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.2 }}
              onClick={() => { onOpenPlaylist(p.id); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '8px 4px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.artwork_url ? <img src={p.artwork_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconListMusic size={17} style={{ color: colors.textMuted }} />}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
            </motion.button>
          ))
        )}

        {recentArtists.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, margin: '18px 0 8px' }}>
              Recently Played
            </div>
            {recentArtists.map((t, i) => (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.2 }}
                onClick={() => playTrack(t)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '8px 4px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t.artwork ? <img src={t.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={16} style={{ color: colors.textMuted }} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>Artist</div>
                </div>
              </motion.button>
            ))}
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
