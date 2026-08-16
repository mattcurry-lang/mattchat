import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { simplifyPoints, renderStroke, renderShape, renderText, replayStrokes } from './drawingEngine'

const SHAPE_TOOLS = new Set(['rect', 'circle', 'line', 'arrow', 'triangle'])

// Exposes imperative controls (undo/redo/clear/exportPng) to the parent
// toolbar via a ref, while keeping the actual stroke array as this
// component's own local state — Phase 2 will lift stroke mutations out
// through onLocalStroke so they can also be broadcast, without changing
// this component's rendering logic at all.
const DrawingCanvas = forwardRef(function DrawingCanvas(
  { tool, color, size, opacity, onLocalStrokeEnd, onCanUndoChange, onCanRedoChange, remoteStrokes, backgroundColor = '#ffffff' },
  ref
) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const ctxRef = useRef(null)
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  const [strokes, setStrokes] = useState([])       // committed strokes (local + remote merged)
  const redoStackRef = useRef([])                  // this user's own undone strokes, for redo
  const drawingRef = useRef(false)
  const currentPointsRef = useRef([])
  const currentStrokeMetaRef = useRef(null)
  const textInputRef = useRef(null)
  const [textEditor, setTextEditor] = useState(null) // { x, y } | null while placing text

  // ── Sizing: match canvas backing store to CSS size * devicePixelRatio
  // so strokes stay crisp on high-DPI screens instead of blurring. ──
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const { width, height } = container.getBoundingClientRect()
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctxRef.current = ctx
    replayStrokes(ctx, canvas, strokes.map(withDeviceCoords => withDeviceCoords)) // strokes are stored in CSS px, ctx transform handles scale
  }, [dpr, strokes])

  useEffect(() => {
    resizeCanvas()
    const ro = new ResizeObserver(resizeCanvas)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render whenever the committed stroke list changes (undo/redo/
  // clear/remote strokes arriving) — this is the only place a FULL
  // replay happens; live dragging draws incrementally instead (below).
  useEffect(() => {
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    replayStrokes(ctx, canvas, strokes)
  }, [strokes])

  // Merge remote strokes in (Phase 2 will feed this prop from realtime).
  useEffect(() => {
    if (!remoteStrokes) return
    setStrokes(remoteStrokes)
  }, [remoteStrokes])

  useEffect(() => { onCanUndoChange?.(strokes.some(s => !s.deleted)) }, [strokes, onCanUndoChange])
  useEffect(() => { onCanRedoChange?.(redoStackRef.current.length > 0) }, [strokes, onCanRedoChange])

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const newStrokeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const drawLivePoint = (points) => {
    // Incremental draw: only redraw the last two committed strokes'
    // worth of canvas would be wasteful to track, so for the ACTIVE
    // stroke we just re-render the whole committed layer once (cheap,
    // since it's cached in `strokes`) plus this in-progress stroke on
    // top — avoids a full replay of everything on every pointer move.
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    replayStrokes(ctx, canvas, strokes)
    const meta = currentStrokeMetaRef.current
    if (!meta) return
    if (SHAPE_TOOLS.has(meta.tool)) {
      renderShape(ctx, { ...meta, points })
    } else {
      renderStroke(ctx, { ...meta, points })
    }
  }

  const handlePointerDown = (e) => {
    if (tool === 'text') {
      const p = getPoint(e)
      setTextEditor({ x: p.x, y: p.y })
      requestAnimationFrame(() => textInputRef.current?.focus())
      return
    }
    e.preventDefault()
    drawingRef.current = true
    const p = getPoint(e)
    currentPointsRef.current = [p]
    currentStrokeMetaRef.current = { id: newStrokeId(), tool, color, size, opacity }
    drawLivePoint([p])
  }

  const handlePointerMove = (e) => {
    if (!drawingRef.current) return
    e.preventDefault()
    const p = getPoint(e)
    if (SHAPE_TOOLS.has(tool)) {
      // Shapes only need start + current point.
      currentPointsRef.current = [currentPointsRef.current[0], p]
    } else {
      currentPointsRef.current.push(p)
    }
    drawLivePoint(currentPointsRef.current)
  }

  const commitCurrentStroke = () => {
    const meta = currentStrokeMetaRef.current
    let points = currentPointsRef.current
    if (!meta || points.length === 0) return
    if (!SHAPE_TOOLS.has(meta.tool)) points = simplifyPoints(points)
    const stroke = { ...meta, points, deleted: false, userId: 'me' }
    setStrokes(prev => [...prev, stroke])
    redoStackRef.current = [] // any new stroke invalidates the redo stack
    onLocalStrokeEnd?.(stroke)
    currentPointsRef.current = []
    currentStrokeMetaRef.current = null
  }

  const handlePointerUp = (e) => {
    if (!drawingRef.current) return
    e.preventDefault()
    drawingRef.current = false
    commitCurrentStroke()
  }

  const handlePointerLeave = () => {
    if (drawingRef.current) {
      drawingRef.current = false
      commitCurrentStroke()
    }
  }

  const submitText = (value) => {
    if (value.trim() && textEditor) {
      const stroke = {
        id: newStrokeId(), tool: 'text', color, size, opacity,
        points: [{ x: textEditor.x, y: textEditor.y }],
        textContent: value, deleted: false, userId: 'me',
      }
      setStrokes(prev => [...prev, stroke])
      redoStackRef.current = []
      onLocalStrokeEnd?.(stroke)
    }
    setTextEditor(null)
  }

  // ── Imperative API for the toolbar ──
  useImperativeHandle(ref, () => ({
    undo: () => {
      setStrokes(prev => {
        const idx = [...prev].reverse().findIndex(s => s.userId === 'me' && !s.deleted)
        if (idx === -1) return prev
        const realIdx = prev.length - 1 - idx
        const target = prev[realIdx]
        redoStackRef.current = [...redoStackRef.current, target]
        const next = [...prev]
        next[realIdx] = { ...target, deleted: true }
        return next
      })
    },
    redo: () => {
      const target = redoStackRef.current.pop()
      if (!target) return
      setStrokes(prev => prev.map(s => (s.id === target.id ? { ...s, deleted: false } : s)))
    },
    clear: () => {
      setStrokes([])
      redoStackRef.current = []
    },
    exportPng: () => canvasRef.current?.toDataURL('image/png'),
    getStrokes: () => strokes,
  }), [strokes])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', width: '100%', height: '100%',
        background: backgroundColor, borderRadius: 16, overflow: 'hidden',
        touchAction: 'none', // prevents the browser from treating drawing gestures as page scroll
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerLeave}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        style={{ display: 'block', width: '100%', height: '100%', cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair' }}
      />
      {textEditor && (
        <input
          ref={textInputRef}
          autoFocus
          onBlur={(e) => submitText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') setTextEditor(null)
          }}
          style={{
            position: 'absolute', left: textEditor.x, top: textEditor.y,
            font: `${Math.max(14, size * 4)}px system-ui, -apple-system, sans-serif`,
            color, background: 'rgba(255,255,255,0.9)', border: `1px dashed ${color}`,
            borderRadius: 4, padding: '2px 6px', outline: 'none', minWidth: 60,
          }}
        />
      )}
    </div>
  )
})

export default DrawingCanvas
