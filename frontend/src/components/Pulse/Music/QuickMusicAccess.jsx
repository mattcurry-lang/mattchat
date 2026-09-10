import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { MusicService } from '../../../lib/music/MusicService'
import { IconMusic, IconSearch, IconPlay, IconPause, IconX } from '../../Icons'
import { useMusicColors } from '../../../hooks/useMusicColors'

const DEBOUNCE_MS = 320
const MOBILE_BREAKPOINT = 520
const PANEL_WIDTH = 340
const MARGIN = 10

export default function QuickMusicAccess() {
  const { currentTrack, isPlaying, playTrack, togglePlayPause, recentlyPlayed, likedTracks } = useMusicPlayer()
  const colors = useMusicColors()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [trending, setTrending] = useState([])
  const [pos, setPos] = useState(null) // null until measured — prevents a flash in the wrong spot
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT)

  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Measures the button AFTER the panel has a real width, and clamps
  // the result so it can never sit partially off-screen — this is the
  // actual bug fix. A single up-front formula (window.innerWidth minus
  // button position) breaks the moment the app isn't full-bleed, which
  // is exactly what was happening here.
  useLayoutEffect(() => {
    if (!open || isMobile) return
    const measure = () => {
      const btnRect = btnRef.current?.getBoundingClientRect()
      if (!btnRect) return
      const panelWidth = panelRef.current?.offsetWidth || PANEL_WIDTH
      let left = btnRect.right - panelWidth // default: right-align panel under the button
      left = Math.min(left, window.innerWidth - panelWidth - MARGIN) // don't overflow right
      left = Math.max(left, MARGIN) // don't overflow left
      const top = Math.min(btnRect.bottom + 8, window.innerHeight - 200) // keep it from opening below the fold
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
  const listLabel = query.trim() ? 'Results' : (recentlyPlayed.length ? 'Recently Played' : 'Trending')
  // A one-tap thumbnail strip up top — likeds + recent, whichever exists —
  // so people can start music before even touching the search box.
  const quickPlayStrip = [...likedTracks.slice(0, 3), ...recentlyPlayed.slice(0, 3)].slice(0, 6)

  const panelContent = (
    <>
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

      {/* one-tap quick play strip — the "upgrade" ask: start music
          without typing anything, similar to Spotify's quick-access grid */}
      {!query.trim() && quickPlayStrip.length > 0 && (
        <div style={{ padding: '0 12px 10px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {quickPlayStrip.map((t) => (
            <button
              key={t.id}
              onClick={() => playTrack(t, quickPlayStrip)}
              title={t.title}
              style={{
                width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
                border: currentTrack?.id === t.id ? '2px solid #a78bfa' : `1px solid ${colors.border}`,
                background: colors.surface2, padding: 0,
              }}
            >
              {t.artwork ? <img src={t.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={14} style={{ color: colors.textMuted }} />}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: '0 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '7px 10px' }}>
          <IconSearch size={14} style={{ color: colors.textMuted, flexShrink: 0 }} />
          <input
            autoFocus={!isMobile}
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
    </>
  )

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
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
          <span style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: '#a78bfa', border: `2px solid ${colors.surface1}` }} />
        )}
      </button>

      {open && createPortal(
        <AnimatePresence>
          {isMobile ? (
            // Narrow screens: a bottom sheet instead of a floating box —
            // avoids the whole class of off-screen-anchoring bugs entirely.
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'fixed', inset: 0, zIndex: 1999, background: 'rgba(0,0,0,0.5)' }}
                onClick={() => setOpen(false)}
              />
              <motion.div
                key="sheet"
                ref={panelRef}
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                style={{
                  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2000,
                  maxHeight: '75vh', display: 'flex', flexDirection: 'column',
                  background: colors.surface1, borderTopLeftRadius: 18, borderTopRightRadius: 18,
                  boxShadow: '0 -16px 40px rgba(0,0,0,0.35)', overflow: 'hidden',
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
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                style={{
                  position: 'fixed', top: pos.top, left: pos.left, zIndex: 2000,
                  width: PANEL_WIDTH, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
                  background: colors.surface1, border: `1px solid ${colors.border}`, borderRadius: 16,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.35)', overflow: 'hidden',
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
