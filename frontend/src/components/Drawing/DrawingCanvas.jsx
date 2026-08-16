import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { simplifyPoints, renderStroke, renderShape, renderText, replayStrokes, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT } from './drawingEngine'

const SHAPE_TOOLS = new Set(['rect', 'circle', 'line', 'arrow', 'triangle'])
const STROKE_UPDATE_THROTTLE_MS = 40

// Two stacked canvases (base = committed strokes, live = in-progress
// local + remote strokes), BOTH mapped onto a fixed logical coordinate
// space (see CANVAS_LOGICAL_WIDTH/HEIGHT in drawingEngine.js) the same
// way an SVG viewBox works — every device computes its own scale/offset
// to fit that same logical space into whatever screen it has, so a
// desktop and a phone are always looking at the exact same canvas,
// just zoomed differently. Nothing drawn is ever off-screen for anyone.
const DrawingCanvas = forwardRef(function DrawingCanvas(
  {
    tool, color, size, opacity, userId, participantUserIds,
    onLocalStrokeStart, onLocalStrokeUpdate, onLocalStrokeEnd,
    onLocalUndo, onLocalRedo, onLocalClear, onLocalCursorMove,
    onCanUndoChange, onCanRedoChange,
    backgroundColor = '#ffffff',
  },
  ref
) {
  const baseCanvasRef = useRef(null)
  const liveCanvasRef = useRef(null)
  const containerRef = useRef(null)
  const baseCtxRef = useRef(null)
  const liveCtxRef = useRef(null)
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  const scaleRef = useRef(1)
  const offsetXRef = useRef(0)
  const offsetYRef = useRef(0)

  const [strokes, setStrokes] = useState([])
  const [remoteCursors, setRemoteCursors] = useState({})
  const redoStackRef = useRef([])
  const drawingRef = useRef(false)
  const currentPointsRef = useRef([])
  const currentStrokeMetaRef = useRef(null)
  const lastUpdateSentRef = useRef(0)
  const remoteLiveStrokesRef = useRef(new Map())
  const textInputRef = useRef(null)
  const [textEditor, setTextEditor] = useState(null)

  const applyTransform = (ctx, scale, offsetX, offsetY) => {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY)
  }

  const clearDevicePixels = (ctx, canvas) => {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }

  const resizeCanvases = useCallback(() => {
    const container = containerRef.current
    const base = baseCanvasRef.current
    const live = liveCanvasRef.current
    if (!container || !base || !live) return
    const { width, height } = container.getBoundingClientRect()
    if (width === 0 || height === 0) return

    // "meet"-style fit, same concept as SVG's preserveAspectRatio: the
    // whole logical canvas is always fully visible, letterboxed if the
    // device's aspect ratio doesn't match — never cropped.
    const scale = Math.min(width / CANVAS_LOGICAL_WIDTH, height / CANVAS_LOGICAL_HEIGHT)
    const offsetX = (width - CANVAS_LOGICAL_WIDTH * scale) / 2
    const offsetY = (height - CANVAS_LOGICAL_HEIGHT * scale) / 2
    scaleRef.current = scale
    offsetXRef.current = offsetX
    offsetYRef.current = offsetY

    for (const canvas of [base, live]) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      applyTransform(canvas.getContext('2d'), scale, offsetX, offsetY)
    }
    baseCtxRef.current = base.getContext('2d')
    liveCtxRef.current = live.getContext('2d')
    replayStrokes(baseCtxRef.current, base, strokes)
    
  }, [dpr])

  useEffect(() => {
    resizeCanvases()
    const ro = new ResizeObserver(resizeCanvases)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
     
  }, [])

  useEffect(() => {
    const ctx = baseCtxRef.current
    const canvas = baseCanvasRef.current
    if (!ctx || !canvas) return
    replayStrokes(ctx, canvas, strokes)
  }, [strokes])

  useEffect(() => { onCanUndoChange?.(strokes.some(s => s.userId === userId && !s.deleted)) }, [strokes, onCanUndoChange, userId])
  useEffect(() => { onCanRedoChange?.(redoStackRef.current.length > 0) }, [strokes, onCanRedoChange])

  useEffect(() => {
    if (!participantUserIds) return
    setRemoteCursors(prev => {
      const ids = new Set(participantUserIds)
      const next = {}
      for (const [uid, c] of Object.entries(prev)) if (ids.has(uid)) next[uid] = c
      return next
    })
  }, [participantUserIds])

  // Converts a raw screen event into LOGICAL canvas coordinates —
  // everything from this point on (strokes, broadcasts, persistence)
  // is in logical units, identical across every device.
  const getPoint = (e) => {
    const rect = liveCanvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const screenX = clientX - rect.left
    const screenY = clientY - rect.top
    const scale = scaleRef.current || 1
    const x = (screenX - offsetXRef.current) / scale
    const y = (screenY - offsetYRef.current) / scale
    return {
      x: Math.max(0, Math.min(CANVAS_LOGICAL_WIDTH, x)),
      y: Math.max(0, Math.min(CANVAS_LOGICAL_HEIGHT, y)),
    }
  }

  const newStrokeId = () => `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const redrawLiveLayer = useCallback(() => {
    const ctx = liveCtxRef.current
    const canvas = liveCanvasRef.current
    if (!ctx || !canvas) return
    clearDevicePixels(ctx, canvas)

    const meta = currentStrokeMetaRef.current
    if (meta && currentPointsRef.current.length) {
      if (SHAPE_TOOLS.has(meta.tool)) renderShape(ctx, { ...meta, points: currentPointsRef.current })
      else renderStroke(ctx, { ...meta, points: currentPointsRef.current })
    }

    remoteLiveStrokesRef.current.forEach((s) => {
      if (SHAPE_TOOLS.has(s.tool)) renderShape(ctx, s)
      else renderStroke(ctx, s)
    })
  }, [])

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
    const id = newStrokeId()
    currentStrokeMetaRef.current = { id, tool, color, size, opacity, userId }
    redrawLiveLayer()
    onLocalStrokeStart?.({ id, tool, color, size, opacity, points: [p] })
  }

  const handlePointerMove = (e) => {
    const p = getPoint(e)
    onLocalCursorMove?.(p.x, p.y)

    if (!drawingRef.current) return
    e.preventDefault()
    if (SHAPE_TOOLS.has(tool)) {
      currentPointsRef.current = [currentPointsRef.current[0], p]
    } else {
      currentPointsRef.current.push(p)
    }
    redrawLiveLayer()

    const now = Date.now()
    if (now - lastUpdateSentRef.current > STROKE_UPDATE_THROTTLE_MS) {
      lastUpdateSentRef.current = now
      onLocalStrokeUpdate?.(currentStrokeMetaRef.current.id, currentPointsRef.current)
    }
  }

  const commitCurrentStroke = () => {
    const meta = currentStrokeMetaRef.current
    let points = currentPointsRef.current
    if (!meta || points.length === 0) return
    if (!SHAPE_TOOLS.has(meta.tool)) points = simplifyPoints(points)
    const stroke = { ...meta, points, deleted: false }
    setStrokes(prev => [...prev, stroke])
    redoStackRef.current = []
    onLocalStrokeEnd?.(stroke)
    currentPointsRef.current = []
    currentStrokeMetaRef.current = null
    const ctx = liveCtxRef.current
    const canvas = liveCanvasRef.current
    if (ctx && canvas) clearDevicePixels(ctx, canvas)
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
        id: newStrokeId(), tool: 'text', color, size, opacity, userId,
        points: [{ x: textEditor.x, y: textEditor.y }],
        textContent: value, deleted: false,
      }
      setStrokes(prev => [...prev, stroke])
      redoStackRef.current = []
      onLocalStrokeEnd?.(stroke)
    }
    setTextEditor(null)
  }

  useImperativeHandle(ref, () => ({
    undo: () => {
      setStrokes(prev => {
        const idx = [...prev].reverse().findIndex(s => s.userId === userId && !s.deleted)
        if (idx === -1) return prev
        const realIdx = prev.length - 1 - idx
        const target = prev[realIdx]
        redoStackRef.current = [...redoStackRef.current, target]
        onLocalUndo?.(target.id)
        const next = [...prev]
        next[realIdx] = { ...target, deleted: true }
        return next
      })
    },
    redo: () => {
      const target = redoStackRef.current.pop()
      if (!target) return
      onLocalRedo?.(target.id)
      setStrokes(prev => prev.map(s => (s.id === target.id ? { ...s, deleted: false } : s)))
    },
    clear: () => {
      setStrokes([])
      redoStackRef.current = []
      onLocalClear?.()
    },
    exportPng: () => {
      // Export at a fixed, generous logical resolution — identical
      // quality regardless of which device (phone or desktop) triggers
      // the export, since it replays from strokes rather than copying
      // whatever the live on-screen backing store happens to be.
      const EXPORT_SCALE = 2
      const out = document.createElement('canvas')
      out.width = CANVAS_LOGICAL_WIDTH * EXPORT_SCALE
      out.height = CANVAS_LOGICAL_HEIGHT * EXPORT_SCALE
      const octx = out.getContext('2d')
      octx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0)
      octx.fillStyle = backgroundColor
      octx.fillRect(0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT)
      replayStrokes(octx, out, strokes)
      return out.toDataURL('image/png')
    },
    getStrokes: () => strokes,

    applyInitialStrokes: (loaded) => setStrokes(loaded || []),
    applyRemoteStrokeStart: (payload) => {
      remoteLiveStrokesRef.current.set(payload.id, { ...payload })
      redrawLiveLayer()
    },
    applyRemoteStrokeUpdate: ({ strokeId, newPoints }) => {
      const existing = remoteLiveStrokesRef.current.get(strokeId)
      if (!existing) return
      remoteLiveStrokesRef.current.set(strokeId, { ...existing, points: newPoints })
      redrawLiveLayer()
    },
    applyRemoteStrokeEnd: (payload) => {
      remoteLiveStrokesRef.current.delete(payload.id)
      redrawLiveLayer()
      setStrokes(prev => (prev.some(s => s.id === payload.id) ? prev : [...prev, { ...payload, deleted: false }]))
    },
    applyRemoteUndo: ({ strokeId }) => {
      setStrokes(prev => prev.map(s => (s.id === strokeId ? { ...s, deleted: true } : s)))
    },
    applyRemoteRedo: ({ strokeId }) => {
      setStrokes(prev => prev.map(s => (s.id === strokeId ? { ...s, deleted: false } : s)))
    },
    applyRemoteClear: () => {
      setStrokes([])
      remoteLiveStrokesRef.current.clear()
      redrawLiveLayer()
    },
    applyRemoteCursor: ({ userId: uid, x, y, color: c, username }) => {
      setRemoteCursors(prev => ({ ...prev, [uid]: { x, y, color: c, username } }))
    },
  }), [strokes, userId, onLocalUndo, onLocalRedo, onLocalClear, redrawLiveLayer, backgroundColor])

  // Remote cursors are stored in logical coords too — convert back to
  // screen px here for the overlay divs.
  const cursorScreenPos = (c) => ({
    left: c.x * scaleRef.current + offsetXRef.current,
    top: c.y * scaleRef.current + offsetYRef.current,
  })

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', width: '100%', height: '100%',
        background: backgroundColor, borderRadius: 16, overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      <canvas
        ref={baseCanvasRef}
        style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      <canvas
        ref={liveCanvasRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerLeave}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        style={{
          position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%',
          cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair',
        }}
      />

      {Object.entries(remoteCursors).map(([uid, c]) => {
        const pos = cursorScreenPos(c)
        return (
          <div key={uid} style={{ position: 'absolute', left: pos.left, top: pos.top, pointerEvents: 'none', transform: 'translate(-2px,-2px)', zIndex: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
            {c.username && (
              <div style={{ marginTop: 2, fontSize: 10, fontWeight: 700, color: '#fff', background: c.color, borderRadius: 6, padding: '1px 6px', whiteSpace: 'nowrap' }}>
                {c.username}
              </div>
            )}
          </div>
        )
      })}

      {textEditor && (() => {
        const pos = { left: textEditor.x * scaleRef.current + offsetXRef.current, top: textEditor.y * scaleRef.current + offsetYRef.current }
        return (
          <input
            ref={textInputRef}
            autoFocus
            onBlur={(e) => submitText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur()
              if (e.key === 'Escape') setTextEditor(null)
            }}
            style={{
              position: 'absolute', left: pos.left, top: pos.top,
              font: `${Math.max(14, size * 4) * scaleRef.current}px system-ui, -apple-system, sans-serif`,
              color, background: 'rgba(255,255,255,0.9)', border: `1px dashed ${color}`,
              borderRadius: 4, padding: '2px 6px', outline: 'none', minWidth: 60, zIndex: 11,
            }}
          />
        )
      })()}
    </div>
  )
})

export default DrawingCanvas
