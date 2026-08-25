export const CANVAS_LOGICAL_WIDTH = 1600
export const CANVAS_LOGICAL_HEIGHT = 1000

// ── Point simplification ──────────────────────────────────────
export function simplifyPoints(points, tolerance = 1.2) {
  if (points.length <= 2) return points
  const sqTolerance = tolerance * tolerance

  function sqDist(p, a, b) {
    let x = a.x, y = a.y, dx = b.x - x, dy = b.y - y
    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy)
      if (t > 1) { x = b.x; y = b.y }
      else if (t > 0) { x += dx * t; y += dy * t }
    }
    dx = p.x - x; dy = p.y - y
    return dx * dx + dy * dy
  }

  function simplifyRec(pts, first, last, out) {
    let maxDist = sqTolerance, index = -1
    for (let i = first + 1; i < last; i++) {
      const d = sqDist(pts[i], pts[first], pts[last])
      if (d > maxDist) { index = i; maxDist = d }
    }
    if (index > -1) {
      if (index - first > 1) simplifyRec(pts, first, index, out)
      out.push(pts[index])
      if (last - index > 1) simplifyRec(pts, index, last, out)
    }
  }

  const out = [points[0]]
  simplifyRec(points, 0, points.length - 1, out)
  out.push(points[points.length - 1])
  return out
}

function strokeStyleFor(tool, color, opacity) {
  if (tool === 'highlighter') {
    return { color, opacity: Math.min(opacity, 0.35), composite: 'multiply', cap: 'square' }
  }
  if (tool === 'eraser') {
    return { color: '#000', opacity: 1, composite: 'destination-out', cap: 'round' }
  }
  return { color, opacity, composite: 'source-over', cap: 'round' }
}

export function renderStroke(ctx, stroke) {
  const { points, size, tool, color, opacity } = stroke
  if (!points || points.length === 0) return

  const style = strokeStyleFor(tool, color, opacity)
  ctx.save()
  ctx.globalCompositeOperation = style.composite
  ctx.globalAlpha = style.opacity
  ctx.strokeStyle = style.color
  ctx.lineWidth = size
  ctx.lineCap = style.cap
  ctx.lineJoin = 'round'

  if (points.length === 1) {
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2)
    ctx.fillStyle = style.color
    ctx.fill()
    ctx.restore()
    return
  }

  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2
    const midY = (points[i].y + points[i + 1].y) / 2
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY)
  }
  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
  ctx.restore()
}

export function renderShape(ctx, stroke) {
  const { tool, points, size, color, opacity } = stroke
  if (!points || points.length < 2) return
  const [a, b] = points
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.lineWidth = size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (tool === 'rect') {
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  } else if (tool === 'circle') {
    const rx = Math.abs(b.x - a.x) / 2
    const ry = Math.abs(b.y - a.y) / 2
    const cx = (a.x + b.x) / 2
    const cy = (a.y + b.y) / 2
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (tool === 'line') {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  } else if (tool === 'arrow') {
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    const headLen = Math.max(10, size * 3)
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(b.x - headLen * Math.cos(angle - Math.PI / 6), b.y - headLen * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(b.x - headLen * Math.cos(angle + Math.PI / 6), b.y - headLen * Math.sin(angle + Math.PI / 6))
    ctx.stroke()
  } else if (tool === 'triangle') {
    const topX = (a.x + b.x) / 2
    ctx.beginPath()
    ctx.moveTo(topX, a.y)
    ctx.lineTo(a.x, b.y)
    ctx.lineTo(b.x, b.y)
    ctx.closePath()
    ctx.stroke()
  }
  ctx.restore()
}

export function renderText(ctx, stroke) {
  const { points, textContent, size, color, opacity } = stroke
  if (!points || !points.length || !textContent) return
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = color
  ctx.font = `${Math.max(14, size * 4)}px system-ui, -apple-system, sans-serif`
  ctx.textBaseline = 'top'
  ctx.fillText(textContent, points[0].x, points[0].y)
  ctx.restore()
}

// ── Graphite pencil engine (Phase 5a) ──────────────────────────
// Pencil type rides INSIDE the tool string ('pencil-hb', 'pencil-2b',
// 'pencil-4b', 'pencil-6b', 'pencil-mechanical') rather than as a
// separate field — this is deliberate: it means every existing
// broadcast/persist/replay code path (which only ever looks at
// `stroke.tool`) already carries pencil type for free, with zero
// schema changes and zero changes to useDrawingSession.js.
export const PENCIL_PRESETS = {
  hb: { label: 'HB', darkness: 0.55, grain: 0.35, minWidthFactor: 0.35, maxWidthFactor: 1.0, jitter: 0.06 },
  '2b': { label: '2B', darkness: 0.68, grain: 0.45, minWidthFactor: 0.4, maxWidthFactor: 1.15, jitter: 0.08 },
  '4b': { label: '4B', darkness: 0.82, grain: 0.55, minWidthFactor: 0.45, maxWidthFactor: 1.3, jitter: 0.1 },
  '6b': { label: '6B', darkness: 0.95, grain: 0.65, minWidthFactor: 0.5, maxWidthFactor: 1.5, jitter: 0.13 },
  mechanical: { label: 'Mechanical', darkness: 0.75, grain: 0.12, minWidthFactor: 0.9, maxWidthFactor: 1.0, jitter: 0.015 },
}
export const DEFAULT_PENCIL_TYPE = 'hb'
export const PENCIL_TOOL_PREFIX = 'pencil-'
export const isGraphiteTool = (tool) => typeof tool === 'string' && tool.startsWith(PENCIL_TOOL_PREFIX)
export const pencilTypeFromTool = (tool) => (isGraphiteTool(tool) ? tool.slice(PENCIL_TOOL_PREFIX.length) : DEFAULT_PENCIL_TYPE)

// Deterministic hash-based "noise" — NOT Math.random(). Grain must
// look identical every time the SAME stroke is rendered, whether
// that's on your screen, Alex's screen, or during ▶️ Replay — using
// real randomness would make grain re-roll on every render and break
// that. Seeded purely from data already in the stroke.
function hashNoise(x, y, seed) {
  const h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return h - Math.floor(h)
}
function hashSeedFromId(id) {
  if (!id) return 1
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 1000) / 137.0
}

// Real hardware pressure is only trustworthy from an actual stylus —
// mouse and plain touch report a constant 0.5 (or 0 when not
// pressed), which would otherwise make every mouse stroke identically
// "medium pressure". SPEED_NORMALIZER: a logical px/ms above which
// pressure bottoms out — tuned for the 1600×1000 logical canvas.
const SPEED_NORMALIZER = 3.2
function clampPressure(p) { return Math.max(0.12, Math.min(1, p)) }
export function simulatePressureFromSpeed(distPx, dtMs) {
  if (dtMs <= 0) return 0.75
  return clampPressure(1 - (distPx / dtMs) / SPEED_NORMALIZER)
}
export function resolvePointPressure(rawPressure, pointerType, distPx, dtMs) {
  const hasRealPressure = pointerType === 'pen' && rawPressure > 0 && rawPressure !== 0.5
  if (hasRealPressure) return clampPressure(rawPressure)
  return simulatePressureFromSpeed(distPx, dtMs)
}

// Canvas can't natively vary lineWidth mid-path, so a graphite stroke
// is drawn as many short segments, each with its own width/alpha
// derived from that segment's pressure — plus a light pass of tiny
// deterministic grain dabs. Falls back to pressure 0.6 for any point
// missing it (e.g. an old plain stroke reused as a pencil stroke).
export function renderGraphiteStroke(ctx, stroke) {
  const { points, size, color, opacity, tool, id } = stroke
  if (!points || points.length === 0) return
  const preset = PENCIL_PRESETS[pencilTypeFromTool(tool)] || PENCIL_PRESETS[DEFAULT_PENCIL_TYPE]
  const seed = hashSeedFromId(id)
  const strokeColor = color || '#2b2b2e'

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = strokeColor
  ctx.fillStyle = strokeColor

  if (points.length === 1) {
    const p = points[0]
    const pr = p.pressure ?? 0.6
    const w = size * (preset.minWidthFactor + (preset.maxWidthFactor - preset.minWidthFactor) * pr)
    ctx.globalAlpha = (opacity ?? 1) * preset.darkness * (0.5 + 0.5 * pr)
    ctx.beginPath()
    ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const pr = ((a.pressure ?? 0.6) + (b.pressure ?? 0.6)) / 2
    const jitter = 1 + (hashNoise(a.x, a.y, seed) - 0.5) * preset.jitter
    const w = Math.max(0.6, size * (preset.minWidthFactor + (preset.maxWidthFactor - preset.minWidthFactor) * pr) * jitter)

    ctx.globalAlpha = (opacity ?? 1) * preset.darkness * (0.45 + 0.55 * pr)
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()

    // Grain: a couple of tiny stamped dabs per segment, positions and
    // alpha derived from hashNoise — deliberately subtle (spec section
    // 5: "do not make textures overpowering"), and cheap: a handful of
    // small arcs, not a texture image or per-pixel operation.
    if (preset.grain > 0.15) {
      const dabCount = Math.max(1, Math.round(preset.grain * 3))
      for (let d = 0; d < dabCount; d++) {
        const t = (d + 0.5) / dabCount
        const nx = a.x + (b.x - a.x) * t
        const ny = a.y + (b.y - a.y) * t
        const n1 = hashNoise(nx, ny, seed + d)
        const n2 = hashNoise(nx + 1.7, ny + 3.1, seed + d)
        const dx = (n1 - 0.5) * w * 0.8
        const dy = (n2 - 0.5) * w * 0.8
        ctx.globalAlpha = (opacity ?? 1) * preset.darkness * preset.grain * n1 * 0.5
        ctx.beginPath()
        ctx.arc(nx + dx, ny + dy, Math.max(0.4, w * 0.18), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.restore()
}

export function replayStrokes(ctx, canvas, strokes, layersById) {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
  for (const s of strokes) {
    if (s.deleted) continue
    // Strokes with no layerId (drawn before layers existed, or on a
    // since-deleted layer) always render — see the schema note on why
    // layer_id is nullable rather than backfilled.
    const layer = layersById && s.layerId ? layersById.get(s.layerId) : null
    if (layer && layer.visible === false) continue
    const layerOpacity = layer ? (layer.opacity ?? 1) : 1
    const effective = layerOpacity === 1 ? s : { ...s, opacity: (s.opacity ?? 1) * layerOpacity }
    if (s.tool === 'text') renderText(ctx, effective)
    else if (['rect', 'circle', 'line', 'arrow', 'triangle'].includes(s.tool)) renderShape(ctx, effective)
    else if (isGraphiteTool(s.tool)) renderGraphiteStroke(ctx, effective)
    else renderStroke(ctx, effective)
  }
}

// ── Shape recognition ──────────────────────────────────────────
// Pure geometry, no ML — classifies a completed freehand stroke as
// line/circle/rectangle/triangle if it clearly resembles one, else
// returns null and the original stroke is left untouched.
export function recognizeShape(points) {
  if (!points || points.length < 4) return null

  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const w = maxX - minX, h = maxY - minY
  const diag = Math.hypot(w, h)
  if (diag < 20) return null // too small to confidently classify

  const start = points[0], end = points[points.length - 1]
  const closeGap = Math.hypot(end.x - start.x, end.y - start.y)
  const isClosed = closeGap < diag * 0.22

  // ── Line: bbox is very "thin" relative to its length, and points
  // stay close to the straight segment between start and end. ──
  const lineLen = Math.hypot(end.x - start.x, end.y - start.y)
  if (lineLen > 20) {
    const dx = end.x - start.x, dy = end.y - start.y
    const lenSq = dx * dx + dy * dy
    let maxDevSq = 0
    for (const p of points) {
      const t = Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / lenSq))
      const projX = start.x + t * dx, projY = start.y + t * dy
      const devSq = (p.x - projX) ** 2 + (p.y - projY) ** 2
      if (devSq > maxDevSq) maxDevSq = devSq
    }
    if (Math.sqrt(maxDevSq) < Math.max(10, lineLen * 0.08) && !isClosed) {
      return { type: 'line', points: [start, end] }
    }
  }

  if (!isClosed) return null // circle/rect/triangle all require a roughly-closed loop

  // ── Centroid + radius stats, used by both circle and corner checks ──
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length
  const cy = ys.reduce((a, b) => a + b, 0) / ys.length
  const radii = points.map(p => Math.hypot(p.x - cx, p.y - cy))
  const meanR = radii.reduce((a, b) => a + b, 0) / radii.length
  const varR = radii.reduce((a, b) => a + (b - meanR) ** 2, 0) / radii.length
  const stdR = Math.sqrt(varR)
  const roundness = meanR > 0 ? stdR / meanR : 1

  if (roundness < 0.22) {
    return { type: 'circle', points: [{ x: minX, y: minY }, { x: maxX, y: maxY }] }
  }

  // ── Corner detection for rect vs triangle: walk the stroke, find
  // points where direction changes sharply (local angle minima). ──
  const corners = detectCorners(points)
  if (corners.length === 4 || corners.length === 5) {
    return { type: 'rect', points: [{ x: minX, y: minY }, { x: maxX, y: maxY }] }
  }
  if (corners.length === 3) {
    return { type: 'triangle', points: [{ x: minX, y: minY }, { x: maxX, y: maxY }] }
  }

  return null // ambiguous — leave the original freehand stroke alone
}

function detectCorners(points) {
  // Resample to a coarser, evenly-ish spaced subset first — raw stroke
  // points are density-biased toward slow mouse movement, which throws
  // off angle-based corner detection if used directly.
  const step = Math.max(1, Math.floor(points.length / 40))
  const sampled = points.filter((_, i) => i % step === 0)
  if (sampled.length < 6) return []

  const corners = []
  const windowSize = 3
  for (let i = windowSize; i < sampled.length - windowSize; i++) {
    const a = sampled[i - windowSize], b = sampled[i], c = sampled[i + windowSize]
    const v1 = { x: b.x - a.x, y: b.y - a.y }
    const v2 = { x: c.x - b.x, y: c.y - b.y }
    const len1 = Math.hypot(v1.x, v1.y), len2 = Math.hypot(v2.x, v2.y)
    if (len1 < 4 || len2 < 4) continue
    const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2)
    const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI)
    if (angle > 45) corners.push(b) // sharp direction change = a corner
  }

  // Merge corners that landed close together (same real corner, detected twice)
  const merged = []
  for (const c of corners) {
    if (!merged.some(m => Math.hypot(m.x - c.x, m.y - c.y) < 25)) merged.push(c)
  }
  return merged
}

const CURSOR_COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#f472b6', '#22d3ee', '#fb923c']
export function colorForUser(userId) {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  return CURSOR_COLORS[hash % CURSOR_COLORS.length]
}
