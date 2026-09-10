import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { MusicService } from '../../../lib/music/MusicService'
import { IconMusic, IconSearch, IconPlay, IconPause, IconX } from '../../Icons'
import { useMusicColors } from '../../../hooks/useMusicColors'

const DEBOUNCE_MS = 320

export default function QuickMusicAccess() {
  const { currentTrack, isPlaying, playTrack, togglePlayPause, recentlyPlayed, likedTracks } = useMusicPlayer()
  const colors = useMusicColors()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [trending, setTrending] = useState([])
  const [pos, setPos] = useState({ top: 0, right: 0 })

  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const debounceRef = useRef(null)

  const openPanel = () => {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    MusicService.getTrending({ limit: 8 }).then(setTrending).catch(() => setTrending([]))
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (panelRef.current?.contains(e.target)) return
      if (btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onEsc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await MusicService.search(query, { limit: 10 })
        setResults(data.tracks || [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const quickList = query.trim() ? results : (recentlyPlayed.length ? recentlyPlayed.slice(0, 8) : trending)
  const listLabel = query.trim() ? 'Results' : (recentlyPlayed.length ? 'Recently Played' : 'Trending')

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label="Quick music access"
        style={{
          width: 36, height: 36, borderRadius: '50%', border: `1px solid ${colors.border}`,
          background: currentTrack ? 'linear-gradient(135deg, rgba(167,139,250,0.22), rgba(108,99,255,0.14))' : colors.surface2,
          color: currentTrack ? '#a78bfa' : colors.textSecondary,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative',
        }}
      >
        <IconMusic size={16} />
        {isPlaying && (
          <span style={{
            position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%',
            background: '#a78bfa', border: `2px solid ${colors.surface1}`,
          }} />
        )}
      </button>

      {open && createPortal(
        <AnimatePresence>
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            style={{
              position: 'fixed', top: pos.top, right: pos.right, zIndex: 2000,
              width: 'min(340px, calc(100vw - 24px))', maxHeight: '70vh', display: 'flex', flexDirection: 'column',
              background: colors.surface1, border: `1px solid ${colors.border}`, borderRadius: 16,
              boxShadow: '0 16px 40px rgba(0,0,0,0.35)', overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 8px' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: colors.textPrimary }}>Music</div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: colors.surface2, color: colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <IconX size={12} />
              </button>
            </div>

            {currentTrack && (
              <button
                onClick={togglePlayPause}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, margin: '0 12px 10px', padding: '8px 10px',
                  background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.22)', borderRadius: 10,
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {currentTrack.artwork ? <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={13} style={{ color: colors.textMuted }} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</div>
                  <div style={{ fontSize: 10.5, color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.artist}</div>
                </div>
                <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isPlaying ? <IconPause size={11} /> : <IconPlay size={11} />}
                </div>
              </button>
            )}

            <div style={{ padding: '0 12px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '7px 10px' }}>
                <IconSearch size={14} style={{ color: colors.textMuted, flexShrink: 0 }} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search songs…"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: colors.textPrimary, fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>
            </div>

            <div style={{ overflowY: 'auto', padding: '0 8px 10px', flex: 1 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 8px 6px' }}>
                {searching ? 'Searching…' : listLabel}
              </div>

              {!searching && quickList.length === 0 && (
                <div style={{ fontSize: 12, color: colors.textMuted, padding: '10px 8px' }}>
                  {query.trim() ? 'No results.' : 'Nothing here yet — try a search.'}
                </div>
              )}

              {quickList.map((track) => {
                const isThis = currentTrack?.id === track.id
                return (
                  <button
                    key={track.id}
                    onClick={() => playTrack(track, quickList)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 8px',
                      background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 8, fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {track.artwork ? <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={13} style={{ color: colors.textMuted }} />}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isThis ? '#a78bfa' : colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                      <div style={{ fontSize: 10.5, color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
                    </div>
                    {isThis && isPlaying && (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14, flexShrink: 0 }}>
                        {[0, 1, 2].map((i) => (
                          <span key={i} style={{ width: 2.5, background: '#a78bfa', borderRadius: 2, animation: `qmaEq 0.9s ease-in-out ${i * 0.15}s infinite` }} />
                        ))}
                        <style>{`@keyframes qmaEq { 0%, 100% { height: 5px; } 50% { height: 14px; } }`}</style>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
