import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { renderStroke, renderShape, renderText, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT } from './drawingEngine'

const SHAPE_TOOLS = new Set(['rect', 'circle', 'line', 'arrow', 'triangle'])
const SPEEDS = [0.5, 1, 2, 4]

// Assigns each stroke a slot on a shared timeline. Freehand strokes get
// a duration proportional to their point count (so a long scribble
// takes visibly longer than a dot); shapes and text get a fixed short
// slot since there's no natural "in progress" state to animate through.
function buildTimeline(strokes) {
  let t = 0
  const items = []
  for (const s of strokes) {
    if (s.deleted) continue
    let duration
    if (s.tool === 'text') duration = 350
    else if (SHAPE_TOOLS.has(s.tool)) duration = 400
    else duration = Math.max(200, Math.min(1400, 220 + (s.points?.length || 1) * 18))
    items.push({ stroke: s, start: t, duration })
    t += duration + 60 // small gap so consecutive strokes don't blur together
  }
  return { items, totalDuration: Math.max(t, 1) }
}

function drawAtElapsed(ctx, canvas, items, elapsed) {
  if (!ctx || !canvas) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore() // back to the fit transform set once at resize time

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT)

  for (const { stroke, start, duration } of items) {
    if (elapsed < start) break // items are start-ordered, so nothing after this matters yet
    const f = duration <= 0 ? 1 : Math.min(1, (elapsed - start) / duration)
    if (stroke.tool === 'text') {
      if (f <= 0) continue
      ctx.save()
      ctx.globalAlpha = Math.min(1, f / 0.5)
      renderText(ctx, stroke)
      ctx.restore()
    } else if (SHAPE_TOOLS.has(stroke.tool)) {
      if (f > 0) renderShape(ctx, stroke)
    } else {
      const pts = stroke.points || []
      const count = Math.max(1, Math.round(pts.length * f))
      renderStroke(ctx, { ...stroke, points: pts.slice(0, count) })
    }
  }
}

export default function ReplayModal({ strokes, participants, onClose }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const ctxRef = useRef(null)
  const timelineRef = useRef(buildTimeline(strokes))

  const elapsedMsRef = useRef(0)
  const lastTickRef = useRef(null)
  const speedRef = useRef(1)

  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [progress, setProgress] = useState(0)
  const [drawerId, setDrawerId] = useState(null)

  const resize = useCallback(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const { width, height } = container.getBoundingClientRect()
    if (!width || !height) return
    const scale = Math.min(width / CANVAS_LOGICAL_WIDTH, height / CANVAS_LOGICAL_HEIGHT)
    const offsetX = (width - CANVAS_LOGICAL_WIDTH * scale) / 2
    const offsetY = (height - CANVAS_LOGICAL_HEIGHT * scale) / 2
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY)
    ctxRef.current = ctx
    drawAtElapsed(ctx, canvas, timelineRef.current.items, elapsedMsRef.current)
  }, [])

  useEffect(() => {
    resize()
    const ro = new ResizeObserver(resize)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [resize])

  // Playback loop — delta-based so changing speed mid-play never causes
  // a jump; pausing resets lastTickRef so resuming doesn't add a huge
  // "time spent paused" delta on the next frame.
  useEffect(() => {
    if (!playing) return
    let raf
    const loop = (now) => {
      if (lastTickRef.current != null) {
        const delta = now - lastTickRef.current
        elapsedMsRef.current += delta * speedRef.current
      }
      lastTickRef.current = now
      const { items, totalDuration } = timelineRef.current
      const elapsed = Math.min(elapsedMsRef.current, totalDuration)
      drawAtElapsed(ctxRef.current, canvasRef.current, items, elapsed)
      setProgress(elapsed / totalDuration)
      const active = [...items].reverse().find(it => elapsed >= it.start)
      if (active) setDrawerId(active.stroke.userId)
      if (elapsed >= totalDuration) { setPlaying(false); return }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const play = () => { lastTickRef.current = null; setPlaying(true) }
  const pause = () => { lastTickRef.current = null; setPlaying(false) }
  const restart = () => {
    elapsedMsRef.current = 0
    lastTickRef.current = null
    drawAtElapsed(ctxRef.current, canvasRef.current, timelineRef.current.items, 0)
    setProgress(0)
    setDrawerId(null)
    setPlaying(true)
  }
  const changeSpeed = (v) => { speedRef.current = v; setSpeed(v) }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const drawerName = drawerId ? (participants.find(p => p.userId === drawerId)?.username || 'Someone') : null

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(10,10,16,0.94)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>▶️ Replay</span>
        {drawerName && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 20, padding: '3px 10px' }}>
            Drawn by {drawerName}
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        style={{
          width: 'min(90vw, 900px)', height: 'min(64vh, 560px)', borderRadius: 16,
          overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', position: 'relative',
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: '#a78bfa', transition: 'width 0.05s linear' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
        <button onClick={restart} title="Restart"
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 15, cursor: 'pointer' }}>
          ⏮
        </button>
        <button onClick={playing ? pause : play} title={playing ? 'Pause' : 'Play'}
          style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>
          {playing ? '⏸' : '▶'}
        </button>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {SPEEDS.map(s => (
            <button key={s} onClick={() => changeSpeed(s)}
              style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                background: speed === s ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${speed === s ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: speed === s ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
              }}>
              {s}×
            </button>
          ))}
        </div>
      </div>

      <button onClick={onClose} title="Close"
        style={{
          position: 'absolute', top: 20, right: 20, width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>,
    document.body
  )
}
