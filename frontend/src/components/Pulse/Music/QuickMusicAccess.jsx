import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { MusicService } from '../../../lib/music/MusicService'
import { IconMusic, IconSearch, IconPlay, IconPause, IconX } from '../../Icons'
import { useMusicColors } from '../../../hooks/useMusicColors'

const DEBOUNCE_MS = 300
const MOBILE_BREAKPOINT = 520
const PANEL_WIDTH = 360
const MARGIN = 12

export default function QuickMusicAccess({ bare = false }) {
  const { currentTrack, isPlaying, playTrack, togglePlayPause, recentlyPlayed, likedTracks } = useMusicPlayer()
  const colors = useMusicColors()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [trending, setTrending] = useState([])
  const [pos, setPos] = useState(null)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT)

  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useLayoutEffect(() => {
    if (!open || isMobile) return
    const measure = () => {
      const btnRect = btnRef.current?.getBoundingClientRect()
      if (!btnRect) return
      const panelWidth = panelRef.current?.offsetWidth || PANEL_WIDTH
      let left = btnRect.right - panelWidth
      left = Math.min(left, window.innerWidth - panelWidth - MARGIN)
      left = Math.max(left, MARGIN)
      const top = Math.min(btnRect.bottom + 8, window.innerHeight - 200)
      setPos({ top, left })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, isMobile])

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
  const listLabel = query.trim() ? 'Search Results' : (recentlyPlayed.length ? 'Recently Played' : 'Trending Now')
  const quickPlayStrip = [...likedTracks.slice(0, 4), ...recentlyPlayed.slice(0, 4)].slice(0, 6)

  const panelContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#fff' }}>
      {/* Custom Scrollbar Styles */}
      <style>{`
        .qma-scroll::-webkit-scrollbar { width: 4px; }
        .qma-scroll::-webkit-scrollbar-track { background: transparent; }
        .qma-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }
        .qma-scroll::-webkit-scrollbar-thumb:hover { background: rgba(167, 139, 250, 0.4); }
      `}</style>

      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #a78bfa, #6c63ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(167,139,250,0.4)' }}>
            <IconMusic size={13} color="#fff" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>Quick Player</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          <IconX size={13} />
        </button>
      </div>

      {/* Now Playing Mini Banner */}
      {currentTrack && (
        <div style={{ padding: '12px 14px 8px' }}>
          <button
            onClick={togglePlayPause}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.18) 0%, rgba(108,99,255,0.1) 100%)',
              border: '1px solid rgba(167,139,250,0.3)', borderRadius: 14,
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
              position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              {currentTrack.artwork ? <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={16} style={{ color: '#a78bfa' }} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{currentTrack.artist}</div>
            </div>
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(108,99,255,0.4)' }}>
              {isPlaying ? <IconPause size={13} /> : <IconPlay size={13} />}
            </div>
          </button>
        </div>
      )}

      {/* Quick Access Thumbnails */}
      {!query.trim() && quickPlayStrip.length > 0 && (
        <div style={{ padding: '4px 14px 10px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Quick Start
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }} className="qma-scroll">
            {quickPlayStrip.map((t) => (
              <motion.button
                key={t.id}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => playTrack(t, quickPlayStrip)}
                title={t.title}
                style={{
                  width: 46, height: 46, borderRadius: 10, overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
                  border: currentTrack?.id === t.id ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)', padding: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                }}
              >
                {t.artwork ? <img src={t.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={16} style={{ color: '#a78bfa' }} />}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div style={{ padding: '0 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '8px 12px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)' }}>
          <IconSearch size={14} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
          <input
            autoFocus={!isMobile}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists, tracks..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }}>
              <IconX size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Track List Container */}
      <div style={{ overflowY: 'auto', padding: '0 10px 12px', flex: 1 }} className="qma-scroll">
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 8px 8px' }}>
          {searching ? 'Searching...' : listLabel}
        </div>

        {!searching && quickList.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', padding: '16px 8px', textAlign: 'center' }}>
            {query.trim() ? 'No matching tracks found.' : 'Your playlist is empty.'}
          </div>
        )}

        {quickList.map((track) => {
          const isThis = currentTrack?.id === track.id
          return (
            <motion.button
              key={track.id}
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)', x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => playTrack(track, quickList)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '8px 10px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 10, fontFamily: 'inherit',
                marginBottom: 2, transition: 'background 0.2s'
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {track.artwork ? <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isThis ? '#a78bfa' : '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{track.artist}</div>
              </div>
              {isThis && isPlaying && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 14, flexShrink: 0, paddingRight: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ width: 2.5, background: '#a78bfa', borderRadius: 2, animation: `qmaEq 0.9s ease-in-out ${i * 0.15}s infinite` }} />
                  ))}
                  <style>{`@keyframes qmaEq { 0%, 100% { height: 4px; } 50% { height: 14px; } }`}</style>
                </div>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Quick music access"
        className={bare ? `mc-act${currentTrack ? ' is-active' : ''}` : undefined}
        style={bare ? { padding: 0 } : {
          width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(167,139,250,0.3)',
          background: currentTrack ? 'linear-gradient(135deg, rgba(167,139,250,0.25), rgba(108,99,255,0.18))' : 'rgba(255,255,255,0.08)',
          color: currentTrack ? '#a78bfa' : 'rgba(255,255,255,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', transition: 'transform 0.2s'
        }}
      >
        <IconMusic size={16} />
        {isPlaying && (
          <span style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: '#a78bfa', border: bare ? '2px solid var(--mc-cluster-bg, #1c1830)' : '2px solid #131022', boxShadow: '0 0 6px #a78bfa' }} />
        )}
      </button>

      {open && createPortal(
        <AnimatePresence>
          {isMobile ? (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'fixed', inset: 0, zIndex: 1999, background: 'rgba(10,10,18,0.7)', backdropFilter: 'blur(8px)' }}
                onClick={() => setOpen(false)}
              />
              <motion.div
                key="sheet"
                ref={panelRef}
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                style={{
                  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2000,
                  maxHeight: '80vh', display: 'flex', flexDirection: 'column',
                  background: 'linear-gradient(160deg, #1e1936 0%, #12101b 100%)', borderTopLeftRadius: 22, borderTopRightRadius: 22,
                  borderTop: '1px solid rgba(167,139,250,0.3)', boxShadow: '0 -16px 40px rgba(0,0,0,0.5)', overflow: 'hidden',
                  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
              >
                {panelContent}
              </motion.div>
            </>
          ) : (
            pos && (
              <motion.div
                key="popover"
                ref={panelRef}
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                style={{
                  position: 'fixed', top: pos.top, left: pos.left, zIndex: 2000,
                  width: PANEL_WIDTH, maxHeight: '72vh', display: 'flex', flexDirection: 'column',
                  background: 'linear-gradient(160deg, rgba(30,25,54,0.95) 0%, rgba(18,16,27,0.98) 100%)',
                  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(167,139,250,0.3)', borderRadius: 20,
                  boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)', overflow: 'hidden',
                }}
              >
                {panelContent}
              </motion.div>
            )
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
