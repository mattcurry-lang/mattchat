import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { useTheme } from '../../../hooks/useTheme'
import {
  IconPlay, IconPause, IconSkipBack, IconSkipForward,  IconX,
} from '../../Icons'
import TrackArt from './TrackArt'

const TOP_OFFSET = 'calc(env(safe-area-inset-top, 0px) + 72px)'
const POS_KEY = 'mattchat:music:miniPlayerPos'
const MARGIN = 8          // closest the player can get to a screen edge
const SNAP = 24           // let go this close to an edge and it hugs it
const STEP = 16           // arrow-key nudge
const DRAG_START = 6      // px of movement before a press becomes a drag (so taps still tap)

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// @pure-start
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// The saved spot is a fraction of the free space, so it lands in the same place (and stays on screen)
// whatever size the window is later resized to.
function toPixels(pos, vw, vh, w, h) {
  const freeX = Math.max(0, vw - w - MARGIN * 2)
  const freeY = Math.max(0, vh - h - MARGIN * 2)
  return { left: MARGIN + clamp(pos.rx, 0, 1) * freeX, top: MARGIN + clamp(pos.ry, 0, 1) * freeY }
}

function toRatios(left, top, vw, vh, w, h) {
  const freeX = Math.max(1, vw - w - MARGIN * 2)
  const freeY = Math.max(1, vh - h - MARGIN * 2)
  return { rx: clamp((left - MARGIN) / freeX, 0, 1), ry: clamp((top - MARGIN) / freeY, 0, 1) }
}

function keepOnScreen(left, top, vw, vh, w, h) {
  return {
    left: clamp(left, MARGIN, Math.max(MARGIN, vw - w - MARGIN)),
    top: clamp(top, MARGIN, Math.max(MARGIN, vh - h - MARGIN)),
  }
}

// Near an edge when released? Hug it.
function snapToEdges(left, top, vw, vh, w, h) {
  const p = keepOnScreen(left, top, vw, vh, w, h)
  const maxL = Math.max(MARGIN, vw - w - MARGIN)
  const maxT = Math.max(MARGIN, vh - h - MARGIN)
  if (p.left - MARGIN < SNAP) p.left = MARGIN
  else if (maxL - p.left < SNAP) p.left = maxL
  if (p.top - MARGIN < SNAP) p.top = MARGIN
  else if (maxT - p.top < SNAP) p.top = maxT
  return p
}

function readPos(raw) {
  try {
    const p = JSON.parse(raw)
    return Number.isFinite(p?.rx) && Number.isFinite(p?.ry) ? { rx: clamp(p.rx, 0, 1), ry: clamp(p.ry, 0, 1) } : null
  } catch { return null }
}
// @pure-end

function loadPos() {
  try { return readPos(localStorage.getItem(POS_KEY)) } catch { return null }
}
function savePos(pos) {
  try {
    if (pos) localStorage.setItem(POS_KEY, JSON.stringify(pos))
    else localStorage.removeItem(POS_KEY)
  } catch { /* private mode */ }
}

export default function MiniPlayer() {
  const {
    currentTrack, isPlaying, isLoading, error, currentTime, duration,
    isMiniPlayerVisible, togglePlayPause, closeMiniPlayer, setIsFullPlayerVisible,
    playNext,isFullPlayerVisible, isMusicHubOpen,playPrevious,
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

  // ── where the player sits ──
  const cardRef = useRef(null)
  const [pos, setPos] = useState(loadPos)            // saved spot, as fractions; null = the default top-right
  const [px, setPx] = useState(null)                 // that spot in pixels for the current window size
  const [dragPx, setDragPx] = useState(null)         // live position while the finger/mouse is down
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const visible = !!(isMiniPlayerVisible && currentTrack && !isFullPlayerVisible && !isMusicHubOpen)

  useLayoutEffect(() => {
    const el = cardRef.current
    if (!pos || !el) { setPx(null); return }
    setPx(toPixels(pos, vp.w, vp.h, el.offsetWidth, el.offsetHeight))
  }, [pos, vp, visible, currentTrack?.id])

  const commit = useCallback((left, top, w, h) => {
    const next = toRatios(left, top, window.innerWidth, window.innerHeight, w, h)
    savePos(next)
    setPos(next)
  }, [])

  const reset = useCallback(() => { savePos(null); setPos(null); setPx(null) }, [])

  // The drag is tracked on the whole window, so a fast flick that leaves the card still carries it along.
  const detachRef = useRef(null)
  useEffect(() => () => { if (detachRef.current) detachRef.current() }, [])

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    const el = cardRef.current
    if (!el) return
    if (detachRef.current) detachRef.current()
    const r = el.getBoundingClientRect()
    const d = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, w: el.offsetWidth, h: el.offsetHeight, moved: false, last: null }

    const move = (ev) => {
      if (ev.pointerId !== d.id) return
      const dx = ev.clientX - d.sx
      const dy = ev.clientY - d.sy
      if (!d.moved) {
        if (Math.hypot(dx, dy) < DRAG_START) return
        d.moved = true
      }
      d.last = keepOnScreen(d.ox + dx, d.oy + dy, window.innerWidth, window.innerHeight, d.w, d.h)
      setDragPx(d.last)
    }

    const detach = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      detachRef.current = null
    }

    const up = (ev) => {
      if (ev.pointerId !== d.id) return
      detach()
      if (!d.moved || !d.last) return
      // letting go over a button must not press it
      const stop = (cev) => { cev.stopPropagation(); cev.preventDefault() }
      window.addEventListener('click', stop, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0)
      const snapped = snapToEdges(d.last.left, d.last.top, window.innerWidth, window.innerHeight, d.w, d.h)
      commit(snapped.left, snapped.top, d.w, d.h)
      setDragPx(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    detachRef.current = detach
  }

  // keyboard: arrows nudge, Home puts it back
  const onGripKey = (e) => {
    if (e.key === 'Home') { e.preventDefault(); reset(); return }
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!delta) return
    e.preventDefault()
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const step = e.shiftKey ? STEP * 3 : STEP
    const p = keepOnScreen(r.left + delta[0] * step, r.top + delta[1] * step, window.innerWidth, window.innerHeight, el.offsetWidth, el.offsetHeight)
    commit(p.left, p.top, el.offsetWidth, el.offsetHeight)
  }

  const where = dragPx || px
  const positionStyle = where
    ? { left: where.left, top: where.top, right: 'auto' }
    : { top: TOP_OFFSET, right: 12, left: 'auto' }
  const dragging = !!dragPx

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
  const liftedShadow = isDark ? '0 18px 40px rgba(0,0,0,0.55), 0 0 0 2px rgba(167,139,250,0.45)' : '0 18px 40px rgba(60,50,100,0.35), 0 0 0 2px rgba(108,99,255,0.4)'

  // Skip buttons (prev / next)
  const ctl = {
    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
    background: 'transparent', border: 'none', color: titleColor,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, opacity: isLoading ? 0.5 : 1,
  }

  return (
    <AnimatePresence>
    {visible && (
        <motion.div
          key={currentTrack.id}
          ref={cardRef}
          data-mini-player
          data-dragging={dragging ? 'true' : 'false'}
          initial={{ y: -28, opacity: 0, scale: 0.94 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          onPointerDown={onPointerDown}
          style={{
            position: 'fixed', zIndex: 900, ...positionStyle,
            width: 'min(320px, calc(100vw - 24px))', maxWidth: 320,
            touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
            cursor: dragging ? 'grabbing' : 'grab',
          }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: 8, paddingLeft: 4,
              borderRadius: 18, overflow: 'hidden', position: 'relative',
              background: pillBg,
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              border: `1px solid ${pillBorder}`,
              boxShadow: dragging
                ? liftedShadow
                : pulse
                  ? '0 10px 30px rgba(108,99,255,0.4), 0 0 0 2px rgba(167,139,250,0.3)'
                  : shadow,
              transform: dragging ? 'scale(1.02)' : 'none',
              transition: 'box-shadow 0.25s ease, background 0.2s ease, transform 0.15s ease',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#a78bfa,#6c63ff)', transition: 'width 0.2s linear' }} />
            </div>

            {/* grip: drag from anywhere on the card, or focus this and use the arrow keys */}
            <button
              type="button"
              data-grip
              onKeyDown={onGripKey}
              onDoubleClick={reset}
              aria-label="Move player. Drag it, or use the arrow keys. Press Home or double-click to put it back."
              title="Drag to move. Double-click to reset."
              style={{ width: 16, height: 36, flexShrink: 0, border: 'none', background: 'transparent', cursor: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', color: titleColor, opacity: dragging ? 0.9 : 0.4, padding: 0 }}
            >
              <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">
                {[2, 7, 12].map((y) => (<g key={y}><circle cx="1.5" cy={y} r="1.2" /><circle cx="6.5" cy={y} r="1.2" /></g>))}
              </svg>
            </button>

            <button
              onClick={expand}
              style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'inherit', padding: '2px 0', textAlign: 'left' }}
            >
            <TrackArt src={currentTrack.artwork} size={36} radius={10} iconSize={15} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: titleColor, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentTrack.title}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 500, marginTop: 1, color: error ? '#f87171' : subColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {error || `${currentTrack.artist} · ${formatTime(currentTime)}`}
                </div>
              </div>
            </button>

            <button onClick={playPrevious} aria-label="Previous" disabled={isLoading} style={ctl}>
              <IconSkipBack size={16} />
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

            <button onClick={playNext} aria-label="Next" disabled={isLoading} style={ctl}>
              <IconSkipForward size={16} />
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
