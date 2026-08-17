import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { simplifyPoints, renderStroke, renderShape, renderText, replayStrokes, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT } from './drawingEngine'

const SHAPE_TOOLS = new Set(['rect', 'circle', 'line', 'arrow', 'triangle'])
const STROKE_UPDATE_THROTTLE_MS = 40
const MIN_ZOOM = 0.4
const MAX_ZOOM = 6
const PAN_MARGIN_PX = 80
const MINDNODE_COLORS = { yellow: '#fde68a', blue: '#bfdbfe', green: '#bbf7d0', purple: '#ddd6fe', pink: '#fbcfe8' }
const MINDNODE_W = 140
const MINDNODE_H = 60
const STICKY_COLORS = { yellow: '#fde68a', blue: '#bfdbfe', green: '#bbf7d0', purple: '#ddd6fe', pink: '#fbcfe8', orange: '#fed7aa' }
const MIN_OBJECT_W = 60
const MIN_OBJECT_H = 50
const DEFAULT_STICKY_W = 180
const DEFAULT_STICKY_H = 140
const MAX_IMAGE_DIM = 420
const REACTION_LIFETIME_MS = 1600

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const touchDist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
const touchMid = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 })

const DrawingCanvas = forwardRef(function DrawingCanvas(
  {
    tool, color, size, opacity, userId, participantUserIds,
    onLocalStrokeStart, onLocalStrokeUpdate, onLocalStrokeEnd,
    onLocalUndo, onLocalRedo, onLocalClear, onLocalCursorMove,
    onLocalObjectCreate, onLocalObjectMoving, onLocalObjectUpdate, onLocalObjectDelete,
    onCanUndoChange, onCanRedoChange,
    // Phase 3
    pointing, onLocalPointerMove, onLocalPointerOff,
    armedReaction, onReactionPlaced, onLocalReaction,
    comments, onAddComment, onResolveComment, onDeleteComment,
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
const connectionsSvgRef = useRef(null)
const lineRefs = useRef(new Map()) // childObjectId -> <line> DOM node
  const scaleRef = useRef(1)
  const offsetXRef = useRef(0)
  const offsetYRef = useRef(0)
  const fitScaleRef = useRef(1)
  const fitOffsetXRef = useRef(0)
  const fitOffsetYRef = useRef(0)
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

  const [objects, setObjects] = useState([])
  const objectsRef = useRef([])
  objectsRef.current = objects
  const objectDomRefs = useRef(new Map())
  const objectRefCallbacks = useRef(new Map())
  const dragStateRef = useRef(null)
  const lastObjectMoveSentRef = useRef(0)
  const dragMoveImplRef = useRef(null)
  const dragEndImplRef = useRef(null)
  const stableDragMove = useRef((e) => dragMoveImplRef.current?.(e)).current
  const stableDragEnd = useRef((e) => dragEndImplRef.current?.(e)).current

  const [remoteCursors, setRemoteCursors] = useState({})
  const [remotePointers, setRemotePointers] = useState({}) // Phase 3
  const [reactions, setReactions] = useState([])            // Phase 3
  const [panCursor, setPanCursor] = useState(null)
  const redoStackRef = useRef([])
  const drawingRef = useRef(false)
  const currentPointsRef = useRef([])
  const currentStrokeMetaRef = useRef(null)
  const lastUpdateSentRef = useRef(0)
  const remoteLiveStrokesRef = useRef(new Map())
  const textInputRef = useRef(null)
  const [textEditor, setTextEditor] = useState(null)
  const pointingRef = useRef(pointing)
  pointingRef.current = pointing

  const applyTransform = (ctx, scale, offsetX, offsetY) => {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY)
  }
  const clearDevicePixels = (ctx, canvas) => {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore()
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

  const positionObjectEl = (id) => {
    const el = objectDomRefs.current.get(id)
    const obj = objectsRef.current.find(o => o.id === id)
    if (!el || !obj) return
    const scale = scaleRef.current || 1
    el.style.left = `${obj.x * scale + offsetXRef.current}px`
    el.style.top = `${obj.y * scale + offsetYRef.current}px`
    el.style.width = `${obj.width * scale}px`
    el.style.height = `${obj.height * scale}px`
    el.style.transform = obj.rotation ? `rotate(${obj.rotation}deg)` : 'none'
  }
  const positionAllObjects = () => { objectDomRefs.current.forEach((_, id) => positionObjectEl(id)) }
  const getObjectRefCallback = (id) => {
    let fn = objectRefCallbacks.current.get(id)
    if (!fn) {
      fn = (el) => { if (el) { objectDomRefs.current.set(id, el); positionObjectEl(id) } else objectDomRefs.current.delete(id) }
      objectRefCallbacks.current.set(id, fn)
    }
    return fn
  }
  const positionConnections = () => {
  const scale = scaleRef.current || 1
  objectsRef.current.forEach(o => {
    if (o.type !== 'mindnode' || !o.data?.parentId || o.deleted) return
    const line = lineRefs.current.get(o.id)
    const parent = objectsRef.current.find(p => p.id === o.data.parentId)
    if (!line || !parent) return
    const cx1 = (parent.x + parent.width / 2) * scale + offsetXRef.current
    const cy1 = (parent.y + parent.height / 2) * scale + offsetYRef.current
    const cx2 = (o.x + o.width / 2) * scale + offsetXRef.current
    const cy2 = (o.y + o.height / 2) * scale + offsetYRef.current
    line.setAttribute('x1', cx1); line.setAttribute('y1', cy1)
    line.setAttribute('x2', cx2); line.setAttribute('y2', cy2)
  })
}

  const recomputeTransform = useCallback(() => {
    const scale = fitScaleRef.current * zoomRef.current
    const offsetX = fitOffsetXRef.current + panXRef.current
    const offsetY = fitOffsetYRef.current + panYRef.current
    scaleRef.current = scale; offsetXRef.current = offsetX; offsetYRef.current = offsetY

    const base = baseCanvasRef.current
    const live = liveCanvasRef.current
    if (base && baseCtxRef.current) applyTransform(baseCtxRef.current, scale, offsetX, offsetY)
    if (live && liveCtxRef.current) applyTransform(liveCtxRef.current, scale, offsetX, offsetY)
    if (base && baseCtxRef.current) replayStrokes(baseCtxRef.current, base, strokesRef.current)
    redrawLiveLayer()
    positionAllObjects()
    positionConnections()
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(zoomRef.current * 100)}%`
  }, [redrawLiveLayer, dpr])

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

  const scheduleTransformUpdate = () => {
    if (rafPendingRef.current) return
    rafPendingRef.current = true
    requestAnimationFrame(() => { rafPendingRef.current = false; recomputeTransform() })
  }

  const zoomAt = (px, py, nextZoomRaw) => {
    const nextZoom = clamp(nextZoomRaw, MIN_ZOOM, MAX_ZOOM)
    const s0 = zoomRef.current
    if (nextZoom === s0) return
    const tx0 = panXRef.current, ty0 = panYRef.current
    const ratio = nextZoom / s0
    panXRef.current = px - fitOffsetXRef.current - ratio * (px - fitOffsetXRef.current - tx0)
    panYRef.current = py - fitOffsetYRef.current - ratio * (py - fitOffsetYRef.current - ty0)
    zoomRef.current = nextZoom
    clampPan(); scheduleTransformUpdate()
  }
  const panBy = (dx, dy) => { panXRef.current += dx; panYRef.current += dy; clampPan(); scheduleTransformUpdate() }
  const resetView = () => { zoomRef.current = 1; panXRef.current = 0; panYRef.current = 0; recomputeTransform() }

  const resizeCanvases = useCallback(() => {
    const container = containerRef.current
    const base = baseCanvasRef.current
    const live = liveCanvasRef.current
    if (!container || !base || !live) return
    const { width, height } = container.getBoundingClientRect()
    if (width === 0 || height === 0) return
    const scale = Math.min(width / CANVAS_LOGICAL_WIDTH, height / CANVAS_LOGICAL_HEIGHT)
    const offsetX = (width - CANVAS_LOGICAL_WIDTH * scale) / 2
    const offsetY = (height - CANVAS_LOGICAL_HEIGHT * scale) / 2
    fitScaleRef.current = scale; fitOffsetXRef.current = offsetX; fitOffsetYRef.current = offsetY
    for (const canvas of [base, live]) {
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`
    }
    baseCtxRef.current = base.getContext('2d')
    liveCtxRef.current = live.getContext('2d')
    clampPan(); recomputeTransform()
  }, [dpr, recomputeTransform])

  useEffect(() => {
    resizeCanvases()
    const ro = new ResizeObserver(resizeCanvases)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const ctx = baseCtxRef.current, canvas = baseCanvasRef.current
    if (!ctx || !canvas) return
    replayStrokes(ctx, canvas, strokes)
  }, [strokes])

  useEffect(() => { positionAllObjects(); positionConnections() }, [objects])
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
    setRemotePointers(prev => {
      const ids = new Set(participantUserIds)
      const next = {}
      for (const [uid, c] of Object.entries(prev)) if (ids.has(uid)) next[uid] = c
      return next
    })
  }, [participantUserIds])

  // Phase 3: leaving Point mode clears our own pointer for everyone else.
  useEffect(() => { if (!pointing) onLocalPointerOff?.() }, [pointing, onLocalPointerOff])

  // Phase 3: each reaction removes itself after its animation window.
  useEffect(() => {
    if (reactions.length === 0) return
    const now = Date.now()
    const timers = reactions.map(r => setTimeout(() => {
      setReactions(prev => prev.filter(x => x.id !== r.id))
    }, Math.max(0, r.expiresAt - now)))
    return () => timers.forEach(clearTimeout)
  }, [reactions])

  const getPoint = (e) => {
    const rect = liveCanvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const screenX = clientX - rect.left, screenY = clientY - rect.top
    const scale = scaleRef.current || 1
    const x = (screenX - offsetXRef.current) / scale
    const y = (screenY - offsetYRef.current) / scale
    return { x: Math.max(0, Math.min(CANVAS_LOGICAL_WIDTH, x)), y: Math.max(0, Math.min(CANVAS_LOGICAL_HEIGHT, y)) }
  }

  const newLocalId = () => `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const handlePointerDown = (e) => {
    // Phase 3: an armed reaction consumes this tap instead of drawing/pointing.
    if (armedReaction) {
      e.preventDefault()
      const p = getPoint(e)
      const id = newLocalId()
      setReactions(prev => [...prev, { id, emoji: armedReaction, x: p.x, y: p.y, userId, expiresAt: Date.now() + REACTION_LIFETIME_MS }])
      onLocalReaction?.(armedReaction, p.x, p.y)
      onReactionPlaced?.()
      return
    }
    if (pointingRef.current) return // Point mode: no drawing, move handled below
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
    const id = newLocalId()
    currentStrokeMetaRef.current = { id, tool, color, size, opacity, userId }
    redrawLiveLayer()
    onLocalStrokeStart?.({ id, tool, color, size, opacity, points: [p] })
  }

  const handlePointerMove = (e) => {
    const p = getPoint(e)
    if (pointingRef.current) {
      e.preventDefault()
      onLocalPointerMove?.(p.x, p.y)
      return
    }
    onLocalCursorMove?.(p.x, p.y)
    if (!drawingRef.current) return
    e.preventDefault()
    if (SHAPE_TOOLS.has(tool)) currentPointsRef.current = [currentPointsRef.current[0], p]
    else currentPointsRef.current.push(p)
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
    const ctx = liveCtxRef.current, canvas = liveCanvasRef.current
    if (ctx && canvas) clearDevicePixels(ctx, canvas)
  }
  const cancelCurrentStroke = () => {
    drawingRef.current = false
    currentPointsRef.current = []
    currentStrokeMetaRef.current = null
    const ctx = liveCtxRef.current, canvas = liveCanvasRef.current
    if (ctx && canvas) clearDevicePixels(ctx, canvas)
  }
  const handlePointerUp = (e) => {
    if (pointingRef.current) return
    if (!drawingRef.current) return
    e.preventDefault(); drawingRef.current = false; commitCurrentStroke()
  }
  const handlePointerLeave = () => {
    if (pointingRef.current) { onLocalPointerOff?.(); return }
    if (drawingRef.current) { drawingRef.current = false; commitCurrentStroke() }
  }

  const startMousePan = (e) => { isPanningRef.current = true; lastPanPointerRef.current = { x: e.clientX, y: e.clientY }; setPanCursor('grabbing') }
  const endMousePan = () => {
    if (!isPanningRef.current) return false
    isPanningRef.current = false
    setPanCursor(spacePressedRef.current ? 'grab' : null)
    return true
  }
  const handleMouseDown = (e) => {
    if (e.button === 1 || (spacePressedRef.current && e.button === 0)) { e.preventDefault(); startMousePan(e); return }
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
      if (lastPinchDistRef.current) zoomAt(mid.x - rect.left, mid.y - rect.top, zoomRef.current * (dist / lastPinchDistRef.current))
      if (lastPinchMidRef.current) panBy(mid.x - lastPinchMidRef.current.x, mid.y - lastPinchMidRef.current.y)
      lastPinchDistRef.current = dist; lastPinchMidRef.current = mid
      return
    }
    handlePointerMove(e)
  }
  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) { isPinchingRef.current = false; lastPinchDistRef.current = null; lastPinchMidRef.current = null }
    if (e.touches.length === 0) handlePointerUp(e)
  }

  const handleObjectDragMoveImpl = (e) => {
    const drag = dragStateRef.current
    if (!drag) return
    e.preventDefault()
    const p = getPoint(e)
    const dx = p.x - drag.startLogical.x, dy = p.y - drag.startLogical.y
    const obj = objectsRef.current.find(o => o.id === drag.id)
    if (!obj) return
    let patch
    if (drag.mode === 'move') {
      patch = { x: clamp(drag.startObj.x + dx, 0, CANVAS_LOGICAL_WIDTH - obj.width), y: clamp(drag.startObj.y + dy, 0, CANVAS_LOGICAL_HEIGHT - obj.height) }
    } else {
      patch = { width: clamp(drag.startObj.width + dx, MIN_OBJECT_W, CANVAS_LOGICAL_WIDTH), height: clamp(drag.startObj.height + dy, MIN_OBJECT_H, CANVAS_LOGICAL_HEIGHT) }
    }
    Object.assign(obj, patch)
    positionObjectEl(drag.id)
    const now = Date.now()
    if (now - lastObjectMoveSentRef.current > STROKE_UPDATE_THROTTLE_MS) {
      lastObjectMoveSentRef.current = now
      onLocalObjectMoving?.(drag.id, patch)
    }
  }
  dragMoveImplRef.current = handleObjectDragMoveImpl

  const handleObjectDragEndImpl = () => {
    const drag = dragStateRef.current
    if (!drag) return
    dragStateRef.current = null
    window.removeEventListener('mousemove', stableDragMove)
    window.removeEventListener('mouseup', stableDragEnd)
    window.removeEventListener('touchmove', stableDragMove)
    window.removeEventListener('touchend', stableDragEnd)
    const obj = objectsRef.current.find(o => o.id === drag.id)
    if (!obj) return
    const patch = drag.mode === 'move' ? { x: obj.x, y: obj.y } : { width: obj.width, height: obj.height }
    setObjects(prev => prev.map(o => (o.id === drag.id ? { ...o, ...patch } : o)))
    onLocalObjectUpdate?.(drag.id, patch)
  }
  dragEndImplRef.current = handleObjectDragEndImpl

  const startObjectDrag = (id, mode) => (e) => {
    e.stopPropagation(); e.preventDefault()
    const obj = objectsRef.current.find(o => o.id === id)
    if (!obj) return
    dragStateRef.current = { id, mode, startLogical: getPoint(e), startObj: { x: obj.x, y: obj.y, width: obj.width, height: obj.height } }
    window.addEventListener('mousemove', stableDragMove)
    window.addEventListener('mouseup', stableDragEnd)
    window.addEventListener('touchmove', stableDragMove, { passive: false })
    window.addEventListener('touchend', stableDragEnd)
  }

  const updateObjectData = (id, data) => { setObjects(prev => prev.map(o => (o.id === id ? { ...o, data } : o))); onLocalObjectUpdate?.(id, { data }) }
  const deleteObject = (id) => { setObjects(prev => prev.map(o => (o.id === id ? { ...o, deleted: true } : o))); onLocalObjectDelete?.(id) }

  const submitText = (value) => {
    if (value.trim() && textEditor) {
      const stroke = { id: newLocalId(), tool: 'text', color, size, opacity, userId, points: [{ x: textEditor.x, y: textEditor.y }], textContent: value, deleted: false }
      setStrokes(prev => [...prev, stroke])
      redoStackRef.current = []
      onLocalStrokeEnd?.(stroke)
    }
    setTextEditor(null)
  }

  wheelHandlerRef.current = (e) => {
    e.preventDefault()
    const rect = liveCanvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = e.clientX - rect.left, py = e.clientY - rect.top
    if (e.ctrlKey || e.metaKey) zoomAt(px, py, zoomRef.current * Math.exp(-e.deltaY * 0.012))
    else panBy(-e.deltaX, -e.deltaY)
  }
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const listener = (e) => wheelHandlerRef.current?.(e)
    el.addEventListener('wheel', listener, { passive: false })
    return () => el.removeEventListener('wheel', listener)
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) { spacePressedRef.current = true; if (!isPanningRef.current) setPanCursor('grab') }
    }
    const onKeyUp = (e) => {
      if (e.code === 'Space') { spacePressedRef.current = false; if (!isPanningRef.current) setPanCursor(null) }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
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
    clear: () => { setStrokes([]); redoStackRef.current = []; onLocalClear?.() },
    exportPng: () => {
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
    applyRemoteStrokeStart: (payload) => { remoteLiveStrokesRef.current.set(payload.id, { ...payload }); redrawLiveLayer() },
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
    applyRemoteUndo: ({ strokeId }) => setStrokes(prev => prev.map(s => (s.id === strokeId ? { ...s, deleted: true } : s))),
    applyRemoteRedo: ({ strokeId }) => setStrokes(prev => prev.map(s => (s.id === strokeId ? { ...s, deleted: false } : s))),
    applyRemoteClear: () => { setStrokes([]); remoteLiveStrokesRef.current.clear(); redrawLiveLayer() },
    applyRemoteCursor: ({ userId: uid, x, y, color: c, username }) => setRemoteCursors(prev => ({ ...prev, [uid]: { x, y, color: c, username } })),

    createStickyNote: () => {
      const container = containerRef.current
      const { width, height } = container ? container.getBoundingClientRect() : { width: 400, height: 300 }
      const scale = scaleRef.current || 1
      const w = DEFAULT_STICKY_W, h = DEFAULT_STICKY_H
      const x = clamp((width / 2 - offsetXRef.current) / scale - w / 2, 0, CANVAS_LOGICAL_WIDTH - w)
      const y = clamp((height / 2 - offsetYRef.current) / scale - h / 2, 0, CANVAS_LOGICAL_HEIGHT - h)
      const obj = { id: newLocalId(), userId, type: 'sticky', data: { text: '', color: 'yellow' }, x, y, width: w, height: h, rotation: 0, zIndex: objectsRef.current.length, deleted: false }
      setObjects(prev => [...prev, obj]); onLocalObjectCreate?.(obj)
    },
    // helper, near createStickyNote/createImageObject inside useImperativeHandle
createMindMapRoot: (text = 'Central Idea') => {
  const container = containerRef.current
  const { width, height } = container ? container.getBoundingClientRect() : { width: 400, height: 300 }
  const scale = scaleRef.current || 1
  const x = clamp((width / 2 - offsetXRef.current) / scale - MINDNODE_W / 2, 0, CANVAS_LOGICAL_WIDTH - MINDNODE_W)
  const y = clamp((height / 2 - offsetYRef.current) / scale - MINDNODE_H / 2, 0, CANVAS_LOGICAL_HEIGHT - MINDNODE_H)
  const obj = { id: newLocalId(), userId, type: 'mindnode', data: { text, color: 'purple', parentId: null }, x, y, width: MINDNODE_W, height: MINDNODE_H, rotation: 0, zIndex: objectsRef.current.length, deleted: false }
  setObjects(prev => [...prev, obj])
  onLocalObjectCreate?.(obj)
  return obj.id
},
addMindMapChild: (parentId) => {
  const parent = objectsRef.current.find(o => o.id === parentId)
  if (!parent) return
  const angle = Math.random() * Math.PI * 2
  const dist = 160
  const x = clamp(parent.x + Math.cos(angle) * dist, 0, CANVAS_LOGICAL_WIDTH - MINDNODE_W)
  const y = clamp(parent.y + Math.sin(angle) * dist, 0, CANVAS_LOGICAL_HEIGHT - MINDNODE_H)
  const colors = Object.keys(MINDNODE_COLORS)
  const obj = { id: newLocalId(), userId, type: 'mindnode', data: { text: '', color: colors[Math.floor(Math.random() * colors.length)], parentId }, x, y, width: MINDNODE_W, height: MINDNODE_H, rotation: 0, zIndex: objectsRef.current.length, deleted: false }
  setObjects(prev => [...prev, obj])
  onLocalObjectCreate?.(obj)
},
    createImageObject: ({ url, naturalWidth, naturalHeight }) => {
      const container = containerRef.current
      const { width, height } = container ? container.getBoundingClientRect() : { width: 400, height: 300 }
      const scale = scaleRef.current || 1
      const ratio = naturalWidth && naturalHeight ? naturalWidth / naturalHeight : 1
      let w = MAX_IMAGE_DIM, h = MAX_IMAGE_DIM / ratio
      if (h > MAX_IMAGE_DIM) { h = MAX_IMAGE_DIM; w = MAX_IMAGE_DIM * ratio }
      const x = clamp((width / 2 - offsetXRef.current) / scale - w / 2, 0, CANVAS_LOGICAL_WIDTH - w)
      const y = clamp((height / 2 - offsetYRef.current) / scale - h / 2, 0, CANVAS_LOGICAL_HEIGHT - h)
      const obj = { id: newLocalId(), userId, type: 'image', data: { url }, x, y, width: w, height: h, rotation: 0, zIndex: objectsRef.current.length, deleted: false }
      setObjects(prev => [...prev, obj]); onLocalObjectCreate?.(obj)
    },
    applyInitialObjects: (loaded) => setObjects(loaded || []),
    applyRemoteObjectCreated: (payload) => setObjects(prev => (prev.some(o => o.id === payload.id) ? prev : [...prev, payload])),
    applyRemoteObjectMoving: ({ objectId, patch }) => {
      const obj = objectsRef.current.find(o => o.id === objectId)
      if (!obj) return
      Object.assign(obj, patch)
      positionObjectEl(objectId)
    },
    applyRemoteObjectUpdated: ({ objectId, patch }) => setObjects(prev => prev.map(o => (o.id === objectId ? { ...o, ...patch } : o))),
    applyRemoteObjectDeleted: ({ objectId }) => setObjects(prev => prev.map(o => (o.id === objectId ? { ...o, deleted: true } : o))),

    // Phase 3
    applyRemoteReaction: (payload) => {
      setReactions(prev => [...prev, { id: `${payload.userId}-${Date.now()}`, emoji: payload.emoji, x: payload.x, y: payload.y, userId: payload.userId, expiresAt: Date.now() + REACTION_LIFETIME_MS }])
    },
    applyRemotePointer: (payload) => {
      setRemotePointers(prev => ({ ...prev, [payload.userId]: { x: payload.x, y: payload.y, color: payload.color, username: payload.username } }))
    },
    applyRemotePointerOff: ({ userId: uid }) => {
      setRemotePointers(prev => { const next = { ...prev }; delete next[uid]; return next })
    },
  }), [strokes, objects, userId, onLocalUndo, onLocalRedo, onLocalClear, onLocalObjectCreate, redrawLiveLayer, backgroundColor])

  const cursorScreenPos = (c) => ({ left: c.x * scaleRef.current + offsetXRef.current, top: c.y * scaleRef.current + offsetYRef.current })

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', background: backgroundColor, borderRadius: 16, overflow: 'hidden', touchAction: 'none' }}
    >
      <canvas ref={baseCanvasRef} style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }} />
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
          cursor: panCursor || (armedReaction ? 'copy' : pointing ? 'crosshair' : tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair'),
        }}
      />
<svg ref={connectionsSvgRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 11 }}>
  {objects.filter(o => o.type === 'mindnode' && o.data?.parentId && !o.deleted).map(o => (
    <line
      key={`conn-${o.id}`}
      ref={(el) => { if (el) lineRefs.current.set(o.id, el); else lineRefs.current.delete(o.id) }}
      stroke="rgba(167,139,250,0.5)"
      strokeWidth="2"
    />
  ))}
</svg>
      {objects.filter(o => !o.deleted).map(o => (
        <div key={o.id} ref={getObjectRefCallback(o.id)} onMouseDown={startObjectDrag(o.id, 'move')} onTouchStart={startObjectDrag(o.id, 'move')} style={{ position: 'absolute', zIndex: 12 + (o.zIndex || 0), cursor: 'grab' }}>
          {o.type === 'sticky' ? (
  <StickyNoteContent obj={o} onTextChange={(text) => updateObjectData(o.id, { ...o.data, text })} onColorChange={(colorKey) => updateObjectData(o.id, { ...o.data, color: colorKey })} onDelete={() => deleteObject(o.id)} />
) : o.type === 'mindnode' ? (
  <MindNodeContent
    obj={o}
    onTextChange={(text) => updateObjectData(o.id, { ...o.data, text })}
    onColorChange={(colorKey) => updateObjectData(o.id, { ...o.data, color: colorKey })}
    onDelete={() => deleteObject(o.id)}
    onAddChild={() => addMindMapChild(o.id)}
  />
) : (
  <ImageObjectContent obj={o} onDelete={() => deleteObject(o.id)} />
)}
          <div onMouseDown={startObjectDrag(o.id, 'resize')} onTouchStart={startObjectDrag(o.id, 'resize')} title="Resize"
            style={{ position: 'absolute', right: -5, bottom: -5, width: 16, height: 16, borderRadius: '50%', background: '#a78bfa', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)', cursor: 'nwse-resize' }} />
          {/* Phase 3: comment badge + popover, tracks the object's own transform for free */}
          <CommentBadge
            objectId={o.id}
            comments={comments?.[o.id] || []}
            onAdd={(text) => onAddComment?.(o.id, text)}
            onResolve={(commentId) => onResolveComment?.(o.id, commentId)}
            onDelete={(commentId) => onDeleteComment?.(o.id, commentId)}
          />
        </div>
      ))}

      {Object.entries(remoteCursors).map(([uid, c]) => {
        const pos = cursorScreenPos(c)
        return (
          <div key={uid} style={{ position: 'absolute', left: pos.left, top: pos.top, pointerEvents: 'none', transform: 'translate(-2px,-2px)', zIndex: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
            {c.username && <div style={{ marginTop: 2, fontSize: 10, fontWeight: 700, color: '#fff', background: c.color, borderRadius: 6, padding: '1px 6px', whiteSpace: 'nowrap' }}>{c.username}</div>}
          </div>
        )
      })}

      {/* Phase 3: live pointers — "Name →" following remote cursor */}
      {Object.entries(remotePointers).map(([uid, p]) => {
        const pos = cursorScreenPos(p)
        return (
          <div key={uid} style={{ position: 'absolute', left: pos.left, top: pos.top, pointerEvents: 'none', zIndex: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 18, color: p.color, transform: 'translateY(-2px)' }}>👉</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: p.color, borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' }}>
              {p.username || 'Someone'} →
            </span>
          </div>
        )
      })}

      {/* Phase 3: floating reactions */}
      {reactions.map(r => {
        const pos = cursorScreenPos(r)
        return (
          <div key={r.id} className="mc-reaction-float" style={{ position: 'absolute', left: pos.left, top: pos.top, fontSize: 28, pointerEvents: 'none', zIndex: 17, transform: 'translate(-50%,-50%)' }}>
            {r.emoji}
          </div>
        )
      })}
      <style>{`
        @keyframes mcReactionFloat { 0% { opacity: 0; transform: translate(-50%,-40%) scale(0.6); } 15% { opacity: 1; transform: translate(-50%,-60%) scale(1); } 100% { opacity: 0; transform: translate(-50%,-140%) scale(1.1); } }
        .mc-reaction-float { animation: mcReactionFloat ${REACTION_LIFETIME_MS}ms ease-out forwards; }
      `}</style>

      {textEditor && (() => {
        const pos = { left: textEditor.x * scaleRef.current + offsetXRef.current, top: textEditor.y * scaleRef.current + offsetYRef.current }
        return (
          <input
            ref={textInputRef}
            autoFocus
            onBlur={(e) => submitText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setTextEditor(null) }}
            style={{
              position: 'absolute', left: pos.left, top: pos.top,
              font: `${Math.max(14, size * 4) * scaleRef.current}px system-ui, -apple-system, sans-serif`,
              color, background: 'rgba(255,255,255,0.9)', border: `1px dashed ${color}`,
              borderRadius: 4, padding: '2px 6px', outline: 'none', minWidth: 60, zIndex: 11,
            }}
          />
        )
      })()}

      <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 15, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(15,15,26,0.85)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '4px 10px' }}>
        <span ref={zoomLabelRef} style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)', minWidth: 32, textAlign: 'center' }}>100%</span>
        <button onClick={resetView} title="Reset zoom & pan" style={{ background: 'none', border: 'none', color: '#c4b5fd', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Reset</button>
      </div>
    </div>
  )
})

function StickyNoteContent({ obj, onTextChange, onColorChange, onDelete }) {
  const bg = STICKY_COLORS[obj.data?.color] || STICKY_COLORS.yellow
  return (
    <div style={{ width: '100%', height: '100%', background: bg, borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', padding: 8, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        {Object.keys(STICKY_COLORS).map(key => (
          <button key={key} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onColorChange(key) }} title={key}
            style={{ width: 12, height: 12, borderRadius: '50%', background: STICKY_COLORS[key], padding: 0, cursor: 'pointer', border: key === obj.data?.color ? '2px solid rgba(0,0,0,0.5)' : '1px solid rgba(0,0,0,0.15)' }} />
        ))}
        <button onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete() }} title="Delete note"
          style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(0,0,0,0.15)', border: 'none', color: 'rgba(0,0,0,0.6)', fontSize: 10, lineHeight: '14px', cursor: 'pointer', padding: 0 }}>×</button>
      </div>
      <textarea defaultValue={obj.data?.text || ''} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onBlur={(e) => onTextChange(e.target.value)} placeholder="Note…"
        style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', font: '600 13px system-ui, -apple-system, sans-serif', color: 'rgba(0,0,0,0.75)' }} />
    </div>
  )
}
function MindNodeContent({ obj, onTextChange, onColorChange, onDelete, onAddChild }) {
  const bg = MINDNODE_COLORS[obj.data?.color] || MINDNODE_COLORS.purple
  return (
    <div style={{ width: '100%', height: '100%', background: bg, borderRadius: 14, boxShadow: '0 4px 14px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', padding: 6, boxSizing: 'border-box', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 3, marginBottom: 2 }}>
        {Object.keys(MINDNODE_COLORS).map(key => (
          <button key={key} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onColorChange(key) }}
            style={{ width: 10, height: 10, borderRadius: '50%', background: MINDNODE_COLORS[key], padding: 0, cursor: 'pointer', border: key === obj.data?.color ? '2px solid rgba(0,0,0,0.5)' : '1px solid rgba(0,0,0,0.15)' }} />
        ))}
        <button onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete() }}
          style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(0,0,0,0.15)', border: 'none', color: 'rgba(0,0,0,0.6)', fontSize: 9, lineHeight: '12px', cursor: 'pointer', padding: 0 }}>×</button>
      </div>
      <textarea
        defaultValue={obj.data?.text || ''}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onBlur={(e) => onTextChange(e.target.value)}
        placeholder="Idea…"
        style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', font: '700 12.5px system-ui, -apple-system, sans-serif', color: 'rgba(0,0,0,0.75)', textAlign: 'center' }}
      />
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onAddChild() }}
        title="Add branch"
        style={{ position: 'absolute', bottom: -10, right: -10, width: 22, height: 22, borderRadius: '50%', background: '#a78bfa', border: '2px solid #fff', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
      >+</button>
    </div>
  )
}
function ImageObjectContent({ obj, onDelete }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', borderRadius: 6, overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)' }}>
      <img src={obj.data?.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
      <button onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete() }} title="Delete image"
        style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', fontSize: 12, lineHeight: '18px', cursor: 'pointer', padding: 0 }}>×</button>
    </div>
  )
}

// Phase 3: comment badge + popover. Rendered as a child of the object's
// wrapper div, which already tracks pan/zoom via positionObjectEl — so
// this needs zero transform math of its own.
function CommentBadge({ comments, onAdd, onResolve, onDelete }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const openCount = comments.filter(c => !c.resolved).length

  return (
    <div style={{ position: 'absolute', bottom: -10, left: -10, zIndex: 14 }}>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        title="Comments"
        style={{
          width: 22, height: 22, borderRadius: '50%', border: '2px solid #fff', cursor: 'pointer',
          background: openCount > 0 ? '#a78bfa' : 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        }}
      >
        {openCount > 0 ? openCount : '💬'}
      </button>
      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{ position: 'absolute', bottom: 26, left: 0, width: 220, maxHeight: 260, background: '#1e1e2e', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <div style={{ maxHeight: 160, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {comments.length === 0 && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>No comments yet.</div>}
            {comments.map(c => (
              <div key={c.id} style={{ background: c.resolved ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 8px', opacity: c.resolved ? 0.5 : 1 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{c.text}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {!c.resolved && <button onClick={() => onResolve(c.id)} style={{ background: 'none', border: 'none', color: '#34d399', fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Resolve</button>}
                  <button onClick={() => onDelete(c.id)} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { onAdd(draft); setDraft('') } }}
              placeholder="Add comment…"
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 11.5, padding: '5px 8px', outline: 'none' }}
            />
            <button
              onClick={() => { if (draft.trim()) { onAdd(draft); setDraft('') } }}
              style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 8, color: '#c4b5fd', fontSize: 11, fontWeight: 700, padding: '0 8px', cursor: 'pointer' }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DrawingCanvas
