import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { IconPlay, IconPause, IconMusic, IconX } from '../../Icons'

/**
 * components/Pulse/Music/MiniPlayer.jsx
 *
 * Mount this ONCE at the app shell level, same as before — it reads
 * the global MusicPlayerContext so it doesn't matter which screen
 * started playback.
 *
 * REDESIGN: no longer a full-width bar pinned to the bottom (that was
 * eating the bottom of the app over the nav). It's now a small
 * floating "now playing" pill anchored near the top-right, under the
 * header — roughly where the theme toggle lives. Tap it to expand
 * into FullPlayer. `bottomOffset` is kept as a prop for backwards
 * compatibility with existing call sites but is no longer used.
 *
 * If your header height differs from the default, tweak TOP_OFFSET
 * below (or expose it as a prop) so the pill sits just under it.
 */

const TOP_OFFSET = 'calc(env(safe-area-inset-top, 0px) + 64px)'

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MiniPlayer() {
  const {
    currentTrack, isPlaying, isLoading, error, currentTime, duration,
    isMiniPlayerVisible, togglePlayPause, closeMiniPlayer, setIsFullPlayerVisible,
  } = useMusicPlayer()

  const [pulse, setPulse] = useState(false)

  // brief pulse on track change so a new song landing here doesn't
  // feel silent/invisible
  useEffect(() => {
    if (!currentTrack) return
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 700)
    return () => clearTimeout(t)
  }, [currentTrack?.id])

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const expand = () => setIsFullPlayerVisible(true)

  return (
    <AnimatePresence>
      {isMiniPlayerVisible && currentTrack && (
        <motion.div
          key={currentTrack.id}
          initial={{ y: -28, opacity: 0, scale: 0.94 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          style={{
            position: 'fixed',
            top: TOP_OFFSET,
            right: 12,
            left: 'auto',
            zIndex: 900,
            width: 'min(320px, calc(100vw - 24px))',
            maxWidth: 320,
          }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 8px',
              borderRadius: 18, overflow: 'hidden', position: 'relative',
              background: 'rgba(20,18,32,0.78)',
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(167,139,250,0.28)',
              boxShadow: pulse
                ? '0 10px 30px rgba(108,99,255,0.45), 0 0 0 2px rgba(167,139,250,0.35)'
                : '0 8px 24px rgba(0,0,0,0.35)',
              transition: 'box-shadow 0.5s ease',
            }}
          >
            {/* thin progress bar along the very top edge */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: 'rgba(255,255,255,0.08)' }}>
              <div style={{
                height: '100%', width: `${progress}%`,
                background: 'linear-gradient(90deg,#a78bfa,#6c63ff)',
                transition: 'width 0.2s linear',
              }} />
            </div>

            <button
              onClick={expand}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
                background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0', textAlign: 'left',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}>
                {currentTrack.artwork ? (
                  <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <IconMusic size={15} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 700, color: '#f5f5f7', lineHeight: 1.25,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {currentTrack.title}
                </div>
                <div style={{
                  fontSize: 10.5, fontWeight: 500, marginTop: 1,
                  color: error ? '#f87171' : 'rgba(255,255,255,0.55)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {error || `${currentTrack.artist} · ${formatTime(currentTime)}`}
                </div>
              </div>
            </button>

            <button
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={isLoading}
              style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isLoading ? 0.6 : 1,
                boxShadow: '0 3px 10px rgba(108,99,255,0.4)',
              }}
            >
              {isPlaying ? <IconPause size={13} /> : <IconPlay size={13} />}
            </button>

            <button
              onClick={closeMiniPlayer}
              aria-label="Close player"
              style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <IconX size={11} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
