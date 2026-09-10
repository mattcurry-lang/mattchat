import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { useTheme } from '../../../hooks/useTheme'
import { IconPlay, IconPause, IconMusic, IconX } from '../../Icons'

const TOP_OFFSET = 'calc(env(safe-area-inset-top, 0px) + 72px)' 

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
  const { theme } = useTheme()
  const isDark = theme !== 'light'

  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    if (!currentTrack) return
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 700)
    return () => clearTimeout(t)
  }, [currentTrack?.id])

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const expand = () => setIsFullPlayerVisible(true)

  // Floating chip needs its own contrast-safe surface — it sits over
  // arbitrary chat content, not a page background, so it can't just
  // reuse var(--bg-surface-*) and hope for contrast. Still flips by
  // theme so it doesn't look bolted-on in light mode.
  const pillBg = isDark ? 'rgba(24,20,36,0.85)' : 'rgba(255,255,255,0.92)'
  const pillBorder = isDark ? 'rgba(167,139,250,0.3)' : 'rgba(108,99,255,0.25)'
  const titleColor = isDark ? '#f5f5f7' : '#18142a'
  const subColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(24,20,42,0.6)'
  const closeBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const closeColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(24,20,42,0.5)'
  const shadow = isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(60,50,100,0.22)'

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
            position: 'fixed', top: TOP_OFFSET, right: 12, left: 'auto', zIndex: 900,
            width: 'min(320px, calc(100vw - 24px))', maxWidth: 320,
          }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: 8,
              borderRadius: 18, overflow: 'hidden', position: 'relative',
              background: pillBg,
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              border: `1px solid ${pillBorder}`,
              boxShadow: pulse
                ? '0 10px 30px rgba(108,99,255,0.4), 0 0 0 2px rgba(167,139,250,0.3)'
                : shadow,
              transition: 'box-shadow 0.5s ease, background 0.2s ease',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#a78bfa,#6c63ff)', transition: 'width 0.2s linear' }} />
            </div>

            <button
              onClick={expand}
              style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0', textAlign: 'left' }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}>
                {currentTrack.artwork ? (
                  <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <IconMusic size={15} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: titleColor, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentTrack.title}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 500, marginTop: 1, color: error ? '#f87171' : subColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
              style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer', background: closeBg, color: closeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <IconX size={11} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
