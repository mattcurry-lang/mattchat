// BlurRevealMedia.jsx
// Receiving-side reveal UI for a blurred photo/video. Two reveal methods,
// both sender-chosen at send time (see MediaComposer's "Blur photo" toggle):
//
//   'rub'  — scratch-card style: drag a finger/cursor across the blurred
//            surface and it progressively clears, snapping to a full
//            reveal once ~55% has been wiped (a satisfying finish, same
//            trick real scratch-card apps use so people don't have to
//            perfectly cover every pixel). This is the "twist" version of
//            iMessage's Invisible Ink — Apple's only reveals while you're
//            actively touching and re-blurs on release; this one reveals
//            permanently once wiped, closer to a scratch card than a peek.
//   'code' — a 4-digit passcode the SENDER set at send time (never sent
//            to the client in plaintext — see verifyCode prop). Wrong
//            code shakes the pad; right code plays the same reveal
//            transition as a completed scratch.
//
// This component only handles the interaction + reveal animation. It does
// NOT know how the code is verified (that's the verifyCode prop, so the
// actual hash comparison can live wherever the real asset data lives) and
// does NOT persist anything — persistence is a separate, not-yet-wired
// concern (see the note in MediaComposer.jsx).

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const IconSwipe = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M7 12c2-3 8-3 10 0M14 9l3 3-3 3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="12" r="1.6" fill="currentColor" />
  </svg>
)
const IconLock = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth={1.8} />
    <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
  </svg>
)
const IconBackspace = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M9 6h10a2 2 0 012 2v8a2 2 0 01-2 2H9l-6-6 6-6z" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M13 10l4 4m0-4l-4 4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
  </svg>
)

const GRID = 14          // scratch progress tracked on a coarse grid, not per-pixel
const REVEAL_THRESHOLD = 0.55  // fraction of cells that must be touched to auto-complete
const BRUSH_RADIUS = 34        // px, in canvas coordinate space

export default function BlurRevealMedia({
  mediaType = 'image',
  src,                 // the real, sharp media URL — already loaded, just hidden under the canvas
  posterSrc,           // optional: for video, a poster frame to blur (falls back to first frame)
  revealMethod = 'rub', // 'rub' | 'code'
  verifyCode,           // async (code: string) => boolean — required when revealMethod === 'code'
  codeLength = 4,
  onRevealed,
  aspectRatio,
  alt = '',
}) {
  const [revealed, setRevealed] = useState(false)
  const [hintVisible, setHintVisible] = useState(true)
  const [enteredCode, setEnteredCode] = useState('')
  const [shake, setShake] = useState(false)
  const [checking, setChecking] = useState(false)

  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const touchedCellsRef = useRef(new Set())
  const drawingRef = useRef(false)
  const sizeRef = useRef({ w: 0, h: 0 })

  const paintBlurLayer = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    sizeRef.current = { w: rect.width, h: rect.height }
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    // Frosted-glass fill — flat gradient + noise dots rather than trying to
    // redraw the source image blurred inside canvas (simpler, avoids a
    // second decode of the media, and reads as intentionally-obscured
    // rather than "broken image").
    const grad = ctx.createLinearGradient(0, 0, rect.width, rect.height)
    grad.addColorStop(0, 'rgba(40,34,58,0.94)')
    grad.addColorStop(1, 'rgba(20,17,31,0.97)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * rect.width
      const y = Math.random() * rect.height
      const r = Math.random() * 1.6 + 0.4
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
  }, [])

  useEffect(() => {
    if (revealed || revealMethod !== 'rub') return
    paintBlurLayer()
    const ro = new ResizeObserver(paintBlurLayer)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [revealed, revealMethod, paintBlurLayer])

  const completeReveal = useCallback(() => {
    setRevealed(true)
    onRevealed?.()
  }, [onRevealed])

  const cellKey = (cx, cy) => `${cx}_${cy}`

  const erupt = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const ctx = canvas.getContext('2d')
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    const { w, h } = sizeRef.current
    const cx = Math.floor((x / w) * GRID)
    const cy = Math.floor((y / h) * GRID)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const gx = cx + dx, gy = cy + dy
        if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) touchedCellsRef.current.add(cellKey(gx, gy))
      }
    }
    const fraction = touchedCellsRef.current.size / (GRID * GRID)
    if (fraction >= REVEAL_THRESHOLD) completeReveal()
  }, [completeReveal])

  const handlePointerDown = (e) => {
    if (revealMethod !== 'rub' || revealed) return
    setHintVisible(false)
    drawingRef.current = true
    erupt(e.clientX, e.clientY)
  }
  const handlePointerMove = (e) => {
    if (!drawingRef.current) return
    erupt(e.clientX, e.clientY)
  }
  const handlePointerUp = () => { drawingRef.current = false }

  // ---- code pad ----
  const handleDigit = async (d) => {
    if (revealed || checking) return
    const next = (enteredCode + d).slice(0, codeLength)
    setEnteredCode(next)
    if (next.length === codeLength) {
      setChecking(true)
      const ok = await verifyCode?.(next)
      setChecking(false)
      if (ok) {
        completeReveal()
      } else {
        setShake(true)
        setTimeout(() => { setShake(false); setEnteredCode('') }, 420)
      }
    }
  }
  const handleBackspace = () => setEnteredCode((c) => c.slice(0, -1))

  return (
    <div ref={containerRef} style={{ ...wrapStyle, aspectRatio: aspectRatio || '4/3' }}>
      {mediaType === 'video' ? (
        <video src={src} muted={!revealed} controls={revealed} playsInline style={mediaStyle} />
      ) : (
        <img src={src} alt={alt} style={mediaStyle} />
      )}

      <AnimatePresence>
        {!revealed && revealMethod === 'rub' && (
          <motion.canvas
            ref={canvasRef}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={canvasStyle}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!revealed && revealMethod === 'rub' && hintVisible && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={hintStyle}
          >
            <motion.div
              animate={{ x: [0, 14, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <IconSwipe size={26} />
              <span style={hintTextStyle}>Rub to reveal</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!revealed && revealMethod === 'code' && (
          <motion.div
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
            style={codeOverlayStyle}
          >
            <IconLock size={20} style={{ color: '#c9c0ff', marginBottom: 6 }} />
            <span style={codeLabelStyle}>Enter code to reveal</span>
            <motion.div
              animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : {}}
              transition={{ duration: 0.4 }}
              style={dotsRowStyle}
            >
              {Array.from({ length: codeLength }).map((_, i) => (
                <span key={i} style={{ ...dotStyle, background: i < enteredCode.length ? '#c9c0ff' : 'rgba(255,255,255,0.15)' }} />
              ))}
            </motion.div>
            <div style={keypadStyle}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((k, i) =>
                k === '' ? <span key={i} /> : (
                  <button
                    key={i}
                    onClick={() => (k === 'back' ? handleBackspace() : handleDigit(k))}
                    disabled={checking}
                    style={keyStyle}
                  >
                    {k === 'back' ? <IconBackspace size={16} /> : k}
                  </button>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- styles ----
// Always-dark reveal surface regardless of app theme — same reasoning as
// the other media overlays (MediaComposer, MediaStudio): this sits on
// top of media content, not the themed chat chrome.

const wrapStyle = { position: 'relative', width: '100%', borderRadius: 18, overflow: 'hidden', background: '#000' }
const mediaStyle = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
const canvasStyle = { position: 'absolute', inset: 0, touchAction: 'none', cursor: 'pointer' }

const hintStyle = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e4e0f0', pointerEvents: 'none' }
const hintTextStyle = { fontSize: 12.5, fontWeight: 700, letterSpacing: 0.2 }

const codeOverlayStyle = {
  position: 'absolute', inset: 0, background: 'rgba(15,13,22,0.94)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16,
}
const codeLabelStyle = { fontSize: 12, fontWeight: 700, color: '#c9c0ff', marginBottom: 14 }
const dotsRowStyle = { display: 'flex', gap: 10, marginBottom: 16 }
const dotStyle = { width: 11, height: 11, borderRadius: '50%', transition: 'background 0.15s' }
const keypadStyle = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: 168 }
const keyStyle = {
  width: 48, height: 48, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 16, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}
