// Pure drawing logic — no React, no DOM beyond a CanvasRenderingContext2D.
// Kept separate so DrawingCanvas.jsx stays focused on event wiring/state,
// and so this is trivially reusable for both local rendering and replaying
// remote/persisted strokes with identical visual output.

// Fixed logical canvas size, same idea as an SVG viewBox — every device
// (phone or desktop) maps its actual pixel area onto this SAME logical
// space, scaled to fit. This is what guarantees a desktop user and a
// mobile user are always looking at the exact same drawing, just at
// different zoom levels — nothing drawn is ever off-screen for anyone.
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

const CURSOR_COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#f472b6', '#22d3ee', '#fb923c']
export function colorForUser(userId) {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  return CURSOR_COLORS[hash % CURSOR_COLORS.length]
}
