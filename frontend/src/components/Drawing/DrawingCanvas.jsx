import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { simplifyPoints, renderStroke, renderShape, renderText, replayStrokes, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT } from './drawingEngine'

const SHAPE_TOOLS = new Set(['rect', 'circle', 'line', 'arrow', 'triangle'])
const STROKE_UPDATE_THROTTLE_MS = 40
const MIN_ZOOM = 0.4
const MAX_ZOOM = 6
const PAN_MARGIN_PX = 80 // min px of canvas that must always stay visible

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const touchDist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
const touchMid = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 })

// Two stacked canvases (base = committed strokes, live = in-progress
// local + remote strokes), BOTH mapped onto a fixed logical coordinate
// space (see CANVAS_LOGICAL_WIDTH/HEIGHT in drawingEngine.js) the same
// way an SVG viewBox works — every device computes its own scale/offset
// to fit that same logical space into whatever screen it has, so a
// desktop and a phone are always looking at the exact same canvas,
// just zoomed differently. Nothing drawn is ever off-screen for anyone.
//
// On top of that base "fit" transform, the user can now additionally
// zoom/pan (mouse wheel, trackpad pinch, middle-drag, Space+drag,
// two-finger touch). scaleRef/offsetXRef/offsetYRef below always hold
// the COMBINED (fit × zoom × pan) transform — everything downstream
// (getPoint, remote cursor placement, the text-tool input) reads those
// the same way it always did and needs no changes.
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

  // Combined (fit × zoom × pan) transform — read by getPoint, cursor
  // placement, text input positioning. Unchanged shape from before.
  const scaleRef = useRef(1)
  const offsetXRef = useRef(0)
  const offsetYRef = useRef(0)

  // Base "fit" transform, recomputed on resize only.
  const fitScaleRef = useRef(1)
  const fitOffsetXRef = useRef(0)
  const fitOffsetYRef = useRef(0)

  // User-controlled view state layered on top of fit.
  const zoomRef = useRef(1)
  const panXRef = useRef(0)
  const panYRef = useRef(0)

  const isPanningRef = useRef(false)
  const spacePressedRef = useRef(false)
  const lastPanPointerRef = useRef({ x: 0, y: 0 })
  const isPinchingRef = useRef(false)
  const lastPinchDistRef = useRef(null)
  const lastPinchMidRef = useRef(null)
  const rafPendingRef = useRef(false)
  const zoomLabelRef = useRef(null)
  const wheelHandlerRef = useRef(null)

  const [strokes, setStrokes] = useState([])
  const strokesRef = useRef([])
  strokesRef.current = strokes

  const [remoteCursors, setRemoteCursors] = useState({})
  const [panCursor, setPanCursor] = useState(null) // null | 'grab' | 'grabbing'
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

  // Recomputes the combined transform from fit × zoom × pan, applies it
  // to both canvases, and redraws. This is the single place that turns
  // a zoom/pan ref change into pixels on screen.
  const recomputeTransform = useCallback(() => {
    const scale = fitScaleRef.current * zoomRef.current
    const offsetX = fitOffsetXRef.current + panXRef.current
    const offsetY = fitOffsetYRef.current + panYRef.current
    scaleRef.current = scale
    offsetXRef.current = offsetX
    offsetYRef.current = offsetY

    const base = baseCanvasRef.current
    const live = liveCanvasRef.current
    if (base && baseCtxRef.current) applyTransform(baseCtxRef.current, scale, offsetX, offsetY)
    if (live && liveCtxRef.current) applyTransform(liveCtxRef.current, scale, offsetX, offsetY)
    if (base && baseCtxRef.current) replayStrokes(baseCtxRef.current, base, strokesRef.current)
    redrawLiveLayer()

    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(zoomRef.current * 100)}%`
  }, [redrawLiveLayer, dpr])

  // Keeps the canvas from being panned entirely off-screen.
  const clampPan = () => {
    const container = containerRef.current
    if (!container) return
    const { width, height } = container.getBoundingClientRect()
    const scale = fitScaleRef.current * zoomRef.current
    const canvasW = CANVAS_LOGICAL_WIDTH * scale
    const canvasH = CANVAS_LOGICAL_HEIGHT * scale

    const minPanX = PAN_MARGIN_PX - canvasW - fitOffsetXRef.current
    const maxPanX = width - PAN_MARGIN_PX - fitOffsetXRef.current
    panXRef.current = minPanX > maxPanX ? 0 : clamp(panXRef.current, minPanX, maxPanX)

    const minPanY = PAN_MARGIN_PX - canvasH - fitOffsetYRef.current
    const maxPanY = height - PAN_MARGIN_PX - fitOffsetYRef.current
    panYRef.current = minPanY > maxPanY ? 0 : clamp(panYRef.current, minPanY, maxPanY)
  }

  // Coalesce rapid wheel/pinch updates into one transform recompute
  // per animation frame instead of one per event.
  const scheduleTransformUpdate = () => {
    if (rafPendingRef.current) return
    rafPendingRef.current = true
    requestAnimationFrame(() => {
      rafPendingRef.current = false
      recomputeTransform()
    })
  }

  // Zooms so the logical point currently under screen point (px,py)
  // stays under that same screen point after the zoom.
  const zoomAt = (px, py, nextZoomRaw) => {
    const nextZoom = clamp(nextZoomRaw, MIN_ZOOM, MAX_ZOOM)
    const s0 = zoomRef.current
    if (nextZoom === s0) return
    const tx0 = panXRef.current
    const ty0 = panYRef.current
    const ratio = nextZoom / s0
    panXRef.current = px - fitOffsetXRef.current - ratio * (px - fitOffsetXRef.current - tx0)
    panYRef.current = py - fitOffsetYRef.current - ratio * (py - fitOffsetYRef.current - ty0)
    zoomRef.current = nextZoom
    clampPan()
    scheduleTransformUpdate()
  }

  const panBy = (dx, dy) => {
    panXRef.current += dx
    panYRef.current += dy
    clampPan()
    scheduleTransformUpdate()
  }

  const resetView = () => {
    zoomRef.current = 1
    panXRef.current = 0
    panYRef.current = 0
    recomputeTransform()
  }

  const resizeCanvases = useCallback(() => {
    const container = containerRef.current
    const base = baseCanvasRef.current
    const live = liveCanvasRef.current
    if (!container || !base || !live) return
    const { width, height } = container.getBoundingClientRect()
    if (width === 0 || height === 0) return

    // "meet"-style fit, same concept as SVG's preserveAspectRatio: the
    // whole logical canvas is always fully visible at zoom=1, letterboxed
    // if the device's aspect ratio doesn't match — never cropped.
    const scale = Math.min(width / CANVAS_LOGICAL_WIDTH, height / CANVAS_LOGICAL_HEIGHT)
    const offsetX = (width - CANVAS_LOGICAL_WIDTH * scale) / 2
    const offsetY = (height - CANVAS_LOGICAL_HEIGHT * scale) / 2
    fitScaleRef.current = scale
    fitOffsetXRef.current = offsetX
    fitOffsetYRef.current = offsetY

    for (const canvas of [base, live]) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    baseCtxRef.current = base.getContext('2d')
    liveCtxRef.current = live.getContext('2d')
    clampPan()
    recomputeTransform()
  }, [dpr, recomputeTransform])

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

  // Cancels an in-progress stroke WITHOUT committing it — used when a
  // second finger lands mid-draw and we're handing off to pinch/pan.
  const cancelCurrentStroke = () => {
    drawingRef.current = false
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

  // ── Mouse dispatch: middle-drag or Space+left-drag pans; everything
  // else falls through to the normal drawing handlers unchanged. ──
  const startMousePan = (e) => {
    isPanningRef.current = true
    lastPanPointerRef.current = { x: e.clientX, y: e.clientY }
    setPanCursor('grabbing')
  }
  const endMousePan = () => {
    if (!isPanningRef.current) return false
    isPanningRef.current = false
    setPanCursor(spacePressedRef.current ? 'grab' : null)
    return true
  }

  const handleMouseDown = (e) => {
    if (e.button === 1 || (spacePressedRef.current && e.button === 0)) {
      e.preventDefault()
      startMousePan(e)
      return
    }
    handlePointerDown(e)
  }
  const handleMouseMove = (e) => {
    if (isPanningRef.current) {
      e.preventDefault()
      const last = lastPanPointerRef.current
      panBy(e.clientX - last.x, e.clientY - last.y)
      lastPanPointerRef.current = { x: e.clientX, y: e.clientY }
      return
    }
    handlePointerMove(e)
  }
  const handleMouseUp = (e) => { if (!endMousePan()) handlePointerUp(e) }
  const handleMouseLeaveCanvas = (e) => { if (!endMousePan()) handlePointerLeave(e) }

  // ── Touch dispatch: 1 finger draws exactly as before; 2 fingers
  // pinch-zoom/pan and cancel any in-progress single-finger stroke. ──
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      if (drawingRef.current) cancelCurrentStroke()
      isPinchingRef.current = true
      lastPinchDistRef.current = touchDist(e.touches[0], e.touches[1])
      lastPinchMidRef.current = touchMid(e.touches[0], e.touches[1])
      return
    }
    handlePointerDown(e)
  }
  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && isPinchingRef.current) {
      e.preventDefault()
      const dist = touchDist(e.touches[0], e.touches[1])
      const mid = touchMid(e.touches[0], e.touches[1])
      const rect = liveCanvasRef.current.getBoundingClientRect()
      if (lastPinchDistRef.current) {
        zoomAt(mid.x - rect.left, mid.y - rect.top, zoomRef.current * (dist / lastPinchDistRef.current))
      }
      if (lastPinchMidRef.current) {
        panBy(mid.x - lastPinchMidRef.current.x, mid.y - lastPinchMidRef.current.y)
      }
      lastPinchDistRef.current = dist
      lastPinchMidRef.current = mid
      return
    }
    handlePointerMove(e)
  }
  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      isPinchingRef.current = false
      lastPinchDistRef.current = null
      lastPinchMidRef.current = null
    }
    if (e.touches.length === 0) handlePointerUp(e)
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

  // Non-passive native wheel listener — needed so preventDefault()
  // reliably stops page scroll/zoom while still letting us drive our
  // own zoom/pan. Indirected through a ref so the effect only runs
  // once but always calls the latest zoomAt/panBy closures.
  wheelHandlerRef.current = (e) => {
    e.preventDefault()
    const rect = liveCanvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.012)
      zoomAt(px, py, zoomRef.current * factor)
    } else {
      panBy(-e.deltaX, -e.deltaY)
    }
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const listener = (e) => wheelHandlerRef.current?.(e)
    el.addEventListener('wheel', listener, { passive: false })
    return () => el.removeEventListener('wheel', listener)
  }, [])

  // Space = temporary pan mode, same convention as most design tools.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        spacePressedRef.current = true
        if (!isPanningRef.current) setPanCursor('grab')
      }
    }
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        spacePressedRef.current = false
        if (!isPanningRef.current) setPanCursor(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

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
      // whatever the live on-screen backing store happens to be. Note:
      // deliberately exports the full logical canvas, not just whatever
      // is currently panned/zoomed into view.
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
    resetView: () => resetView(),

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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeaveCanvas}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%',
          cursor: panCursor || (tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair'),
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

      {/* Zoom indicator + reset — self-contained, no toolbar changes needed */}
      <div
        style={{
          position: 'absolute', left: 12, bottom: 12, zIndex: 15,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(15,15,26,0.85)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 20, padding: '4px 10px',
        }}
      >
        <span ref={zoomLabelRef} style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)', minWidth: 32, textAlign: 'center' }}>
          100%
        </span>
        <button
          onClick={resetView}
          title="Reset zoom & pan"
          style={{
            background: 'none', border: 'none', color: '#c4b5fd', fontSize: 10.5, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', padding: 0,
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
})

export default DrawingCanvas
