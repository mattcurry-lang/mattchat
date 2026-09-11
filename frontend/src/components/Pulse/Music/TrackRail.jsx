import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { useMusicColors } from '../../../hooks/useMusicColors'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { IconMusic, IconHeart, IconMoreHorizontal, IconPlus, IconPlay, IconListMusic } from '../../Icons'
import AddToPlaylistPicker from './AddToPlaylistPicker'

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TrackRail({ title, tracks, emptyMessage }) {
  const { playTrack, currentTrack, isPlaying } = useMusicPlayer()
  const colors = useMusicColors()
  const isMobile = useIsMobile()

  if (!tracks || tracks.length === 0) {
    if (!emptyMessage) return null
    return (
      <div style={{ marginBottom: 26 }}>
        <RailHeader title={title} colors={colors} />
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #c9c4dd)', padding: '4px 2px' }}>{emptyMessage}</div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 26 }}>
      <RailHeader title={title} colors={colors} />
      <div
        style={{
           display: 'flex', gap: isMobile ? 10 : 14, overflowX: 'auto', overflowY: 'visible', paddingBottom: 6, paddingTop: 2,
          WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
          overscrollBehaviorX: 'contain', touchAction: 'pan-x',
        }}
      >
        {tracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            colors={colors}
             isMobile={isMobile}
            isActive={currentTrack?.id === track.id}
            isPlaying={isPlaying && currentTrack?.id === track.id}
            onPress={() => playTrack(track, tracks)}
          />
        ))}
      </div>
    </div>
  )
}

function RailHeader({ title, colors }) {
  return (
    <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary, #f2f0f8)', marginBottom: 10, letterSpacing: -0.2 }}>
      {title}
    </div>
  )
}

function TrackCard({ track, isActive, isPlaying, onPress, colors, isMobile }) {
  const { isLiked, toggleLike, addToQueue } = useMusicPlayer()
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [addingToPlaylist, setAddingToPlaylist] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuBtnRef = useRef(null)
  const menuRef = useRef(null)
  const liked = isLiked(track.id)
  const durationLabel = formatDuration(track.duration)

  const openMenu = useCallback(() => {
    const rect = menuBtnRef.current?.getBoundingClientRect()
    if (rect) {
      const MENU_WIDTH = 200
      const left = Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)
      setMenuPos({ top: rect.bottom + 6, left: Math.max(8, left) })
    }
    setMenuOpen((o) => !o)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e) => {
      if (menuRef.current?.contains(e.target)) return
      if (menuBtnRef.current?.contains(e.target)) return
      setMenuOpen(false)
    }
    const onResize = () => setMenuOpen(false)
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('resize', onResize)
    }
  }, [menuOpen])

  useEffect(() => { if (!menuOpen) setAddingToPlaylist(false) }, [menuOpen])

  return (
    <div style={{ width: isMobile ? 118 : 148, flexShrink: 0, position: 'relative' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <motion.button
        onClick={onPress}
        whileTap={{ scale: 0.96 }}
        animate={{ scale: hovered ? 1.035 : 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        style={{
          width: isMobile ? 118 : 148, height: isMobile ? 118 : 148, borderRadius: 16, overflow: 'hidden', border: 'none', padding: 0,
          cursor: 'pointer', position: 'relative', background: colors.surface2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          outline: isActive ? '2px solid #a78bfa' : 'none', outlineOffset: -2,
          boxShadow: hovered ? '0 14px 30px rgba(0,0,0,0.35)' : '0 4px 14px rgba(0,0,0,0.18)',
        }}
        aria-label={`Play ${track.title}`}
      >
        {track.artwork ? (
          <img src={track.artwork} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <IconMusic size={30} style={{ color: colors.textMuted }} />
        )}

        <div style={{ position: 'absolute', inset: 0, background: hovered || isActive ? 'rgba(10,10,16,0.35)' : 'transparent', transition: 'background 0.2s ease' }} />

        <AnimatePresence>
          {isActive ? (
            <motion.div key="active" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isPlaying ? <EqualizerBars /> : <PlayGlyph />}
            </motion.div>
          ) : hovered ? (
            <motion.div key="hover" initial={{ opacity: 0, y: 8, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.85 }} transition={{ duration: 0.15 }} style={{ position: 'absolute', bottom: 8, right: 8 }}>
              <PlayGlyph />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <button
          onClick={(e) => { e.stopPropagation(); toggleLike(track) }}
          aria-label={liked ? 'Unlike' : 'Like'}
          style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(15,15,26,0.55)', color: liked ? '#f87171' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IconHeart size={13} filled={liked} />
        </button>
        {durationLabel && (
          <div style={{ position: 'absolute', bottom: 6, left: 6, fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(15,15,26,0.55)', borderRadius: 5, padding: '1px 5px' }}>
            {durationLabel}
          </div>
        )}
      </motion.button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: isActive ? '#a78bfa' : 'var(--text-primary, #f2f0f8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {track.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #c9c4dd)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {track.artist}
          </div>
        </div>

        <button ref={menuBtnRef} onClick={openMenu} aria-label="More options" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, padding: 2, flexShrink: 0 }}>
          <IconMoreHorizontal size={15} />
        </button>
      </div>

      {menuOpen && createPortal(
        <AnimatePresence>
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -6 }}
            transition={{ duration: 0.14 }}
            style={{
              position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 3000,
              minWidth: addingToPlaylist ? 200 : 140,
              background: colors.surface1, border: `1px solid ${colors.border}`, borderRadius: 12,
              boxShadow: '0 12px 30px rgba(0,0,0,0.28)', overflow: 'hidden',
            }}
          >
            {addingToPlaylist ? (
              <AddToPlaylistPicker track={track} onDone={() => setMenuOpen(false)} />
            ) : (
              <>
                <MenuItem icon={<IconPlus size={14} />} label="Add to queue" onClick={() => { addToQueue(track); setMenuOpen(false) }} colors={colors} />
                <MenuItem icon={<IconListMusic size={14} />} label="Add to playlist" onClick={() => setAddingToPlaylist(true)} colors={colors} />
                <MenuItem icon={<IconHeart size={14} filled={liked} />} label={liked ? 'Unlike' : 'Like'} onClick={() => { toggleLike(track); setMenuOpen(false) }} colors={colors} />
              </>
            )}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

function PlayGlyph() {
  return (
    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(108,99,255,0.5)' }}>
      <IconPlay size={17} style={{ color: '#fff', marginLeft: 2 }} />
    </div>
  )
}

function MenuItem({ icon, label, onClick, colors }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary, #f2f0f8)' }}
      <span style={{ color: 'var(--text-secondary, #c9c4dd)', display: 'flex' }}>{icon}</span>
      {label}
    </button>
  )
}

function EqualizerBars() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 18 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 3.5, background: '#fff', borderRadius: 2, animation: `mattchatEq 0.9s ease-in-out ${i * 0.15}s infinite` }} />
      ))}
      <style>{`@keyframes mattchatEq { 0%, 100% { height: 6px; } 50% { height: 18px; } }`}</style>
    </div>
  )
}
