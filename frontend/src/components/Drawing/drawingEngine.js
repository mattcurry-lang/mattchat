 
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

export function replayStrokes(ctx, canvas, strokes) {
  // Clear the FULL backing store (not just the logical area) — the ctx
  // transform is already applied, but clearRect needs device pixels.
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
  for (const s of strokes) {
    if (s.deleted) continue
    if (s.tool === 'text') renderText(ctx, s)
    else if (['rect', 'circle', 'line', 'arrow', 'triangle'].includes(s.tool)) renderShape(ctx, s)
    else renderStroke(ctx, s)
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
