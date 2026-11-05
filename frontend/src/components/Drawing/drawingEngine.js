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

// ───────────────────────────────── BLOCK 1: shapes ─────────────────────────────────
// ── Shapes ────────────────────────────────────────────────────
// A shape is a tool id like 'star' (outline only), 'star:soft' (tinted fill + outline) or 'star:solid'.
// The fill style rides INSIDE the tool string for the same reason the pencil type does: every existing
// broadcast / save / replay path only ever looks at `stroke.tool`, so no schema or session-hook changes.
export const SHAPE_KINDS = [
  'line', 'arrow', 'doublearrow', 'rect', 'rounded', 'circle', 'triangle',
  'diamond', 'pentagon', 'hexagon', 'star', 'heart', 'cross', 'bubble',
]
export function parseShapeTool(tool) {
  if (typeof tool !== 'string') return null
  const [kind, fill] = tool.split(':')
  if (!SHAPE_KINDS.includes(kind)) return null
  return { kind, fill: fill === 'soft' || fill === 'solid' ? fill : 'outline' }
}
export const isShapeTool = (tool) => parseShapeTool(tool) !== null
export const shapeToolId = (kind, fill = 'outline') => (fill === 'outline' ? kind : `${kind}:${fill}`)
 
function tracePoly(ctx, pts) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
}
function regularPoly(n, cx, cy, rx, ry, rotation) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = rotation + (i * 2 * Math.PI) / n
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)])
  }
  return pts
}
function traceRounded(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function traceHeart(ctx, x, y, w, h) {
  const cx = x + w / 2
  const tch = h * 0.3
  ctx.beginPath()
  ctx.moveTo(cx, y + tch)
  ctx.bezierCurveTo(cx, y, x, y, x, y + tch)
  ctx.bezierCurveTo(x, y + (h + tch) / 2, cx, y + (h + tch) / 2, cx, y + h)
  ctx.bezierCurveTo(cx, y + (h + tch) / 2, x + w, y + (h + tch) / 2, x + w, y + tch)
  ctx.bezierCurveTo(x + w, y, cx, y, cx, y + tch)
  ctx.closePath()
}
function traceBubble(ctx, x, y, w, h) {
  const bh = h * 0.8
  const r = Math.min(w, bh) * 0.2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + bh - r)
  ctx.arcTo(x + w, y + bh, x + w - r, y + bh, r)
  ctx.lineTo(x + w * 0.5, y + bh)
  ctx.lineTo(x + w * 0.2, y + h)
  ctx.lineTo(x + w * 0.28, y + bh)
  ctx.lineTo(x + r, y + bh)
  ctx.arcTo(x, y + bh, x, y + bh - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}
function arrowHead(ctx, from, to, size) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6))
  ctx.stroke()
}
 
export function renderShape(ctx, stroke) {
  const { tool, points, size, color, opacity } = stroke
  const parsed = parseShapeTool(tool)
  if (!parsed || !points || points.length < 2) return
  const { kind, fill } = parsed
  const [a, b] = points
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
  const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y)
  const cx = x + w / 2, cy = y + h / 2
 
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.lineWidth = size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
 
  // fill (if the tool asks for it) and then outline the path that was just traced
  const paint = () => {
    if (fill !== 'outline') {
      ctx.save()
      ctx.globalAlpha = opacity * (fill === 'soft' ? 0.22 : 1)
      ctx.fillStyle = color
      ctx.fill()
      ctx.restore()
    }
    ctx.stroke()
  }
 
  switch (kind) {
    case 'rect': ctx.beginPath(); ctx.rect(x, y, w, h); paint(); break
    case 'rounded': traceRounded(ctx, x, y, w, h, Math.min(w, h) * 0.22); paint(); break
    case 'circle': ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); paint(); break
    case 'line': ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); break
    case 'arrow':
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      arrowHead(ctx, a, b, Math.max(10, size * 3))
      break
    case 'doublearrow':
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      arrowHead(ctx, a, b, Math.max(10, size * 3))
      arrowHead(ctx, b, a, Math.max(10, size * 3))
      break
    case 'triangle': // unchanged from before so older drawings replay identically
      tracePoly(ctx, [[(a.x + b.x) / 2, a.y], [a.x, b.y], [b.x, b.y]]); paint(); break
    case 'diamond': tracePoly(ctx, [[cx, y], [x + w, cy], [cx, y + h], [x, cy]]); paint(); break
    case 'pentagon': tracePoly(ctx, regularPoly(5, cx, cy, w / 2, h / 2, -Math.PI / 2)); paint(); break
    case 'hexagon': tracePoly(ctx, regularPoly(6, cx, cy, w / 2, h / 2, 0)); paint(); break
    case 'star': {
      const pts = []
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5
        const k = i % 2 === 0 ? 1 : 0.42
        pts.push([cx + (w / 2) * k * Math.cos(ang), cy + (h / 2) * k * Math.sin(ang)])
      }
      tracePoly(ctx, pts); paint(); break
    }
    case 'heart': traceHeart(ctx, x, y, w, h); paint(); break
    case 'bubble': traceBubble(ctx, x, y, w, h); paint(); break
    case 'cross': {
      const tx = w * 0.17, ty = h * 0.17
      tracePoly(ctx, [
        [cx - tx, y], [cx + tx, y], [cx + tx, cy - ty], [x + w, cy - ty], [x + w, cy + ty], [cx + tx, cy + ty],
        [cx + tx, y + h], [cx - tx, y + h], [cx - tx, cy + ty], [x, cy + ty], [x, cy - ty], [cx - tx, cy - ty],
      ])
      paint(); break
    }
    default: break
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
 
// ───────────────────────────────── BLOCK 2: brushes ────────────────────────────────
// ── Brushes ───────────────────────────────────────────────────
// Like the pencils, the brush type rides inside the tool string ('brush-ink', 'brush-neon', ...), so it is
// broadcast, saved and replayed with zero schema or hook changes. Every brush is deterministic (seeded from
// the stroke id, never Math.random), so it looks identical on both screens and in Replay.
export const BRUSH_PREFIX = 'brush-'
export const BRUSH_PRESETS = {
  ink: { label: 'Ink' },
  calligraphy: { label: 'Calligraphy' },
  watercolor: { label: 'Watercolor' },
  spray: { label: 'Airbrush' },
  neon: { label: 'Neon' },
  crayon: { label: 'Crayon' },
  rainbow: { label: 'Rainbow' },
}
export const isBrushTool = (tool) =>
  typeof tool === 'string' && tool.startsWith(BRUSH_PREFIX) && BRUSH_PRESETS[tool.slice(BRUSH_PREFIX.length)] !== undefined
export const brushKindFromTool = (tool) => tool.slice(BRUSH_PREFIX.length)
// pencils and brushes both read per-point pressure (real stylus pressure, or simulated from speed)
export const usesPressure = (tool) => isGraphiteTool(tool) || isBrushTool(tool)
 
function smoothPath(ctx, points) {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2
    const my = (points[i].y + points[i + 1].y) / 2
    ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my)
  }
  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
}
 
export function renderBrushStroke(ctx, stroke) {
  const { points, size, color, opacity, tool, id } = stroke
  if (!points || points.length === 0) return
  const kind = brushKindFromTool(tool)
  const seed = hashSeedFromId(id)
  const alpha = opacity ?? 1
  const pr = (p) => p.pressure ?? 0.6
 
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.fillStyle = color
 
  // a single tap leaves a dot
  if (points.length === 1) {
    const p = points[0]
    ctx.globalAlpha = alpha * (kind === 'watercolor' ? 0.35 : 1)
    ctx.beginPath()
    ctx.arc(p.x, p.y, (kind === 'watercolor' ? size * 1.2 : size / 2) * (0.6 + 0.6 * pr(p)), 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }
 
  switch (kind) {
    case 'ink': { // smooth, swells with pressure, thins when you flick
      ctx.globalAlpha = alpha
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i]
        ctx.lineWidth = Math.max(0.8, size * (0.3 + 1.0 * (pr(a) + pr(b)) / 2))
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
      break
    }
    case 'calligraphy': { // a flat nib held at 45 degrees: thick across the nib, hairline along it
      ctx.globalAlpha = alpha
      const nx = Math.cos(-Math.PI / 4), ny = Math.sin(-Math.PI / 4)
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i]
        const half = size * (0.7 + 0.5 * (pr(a) + pr(b)) / 2)
        const ox = nx * half, oy = ny * half
        ctx.beginPath()
        ctx.moveTo(a.x - ox, a.y - oy); ctx.lineTo(a.x + ox, a.y + oy)
        ctx.lineTo(b.x + ox, b.y + oy); ctx.lineTo(b.x - ox, b.y - oy)
        ctx.closePath(); ctx.fill()
        ctx.lineWidth = 0.8; ctx.stroke() // hairline seals the seams between segments
      }
      break
    }
    case 'watercolor': { // three soft, translucent washes of decreasing width
      const base = size * 2.4
      ;[1, 0.72, 0.45].forEach((m) => {
        ctx.globalAlpha = alpha * 0.14
        ctx.lineWidth = base * m
        smoothPath(ctx, points)
        ctx.stroke()
      })
      break
    }
    case 'spray': { // airbrush: a cloud of tiny dots around the path
      const R = size * 2.2
      const gap = Math.max(2, R * 0.35)
      const dots = Math.round(Math.min(60, 4 + R * 0.6))
      ctx.globalAlpha = alpha * 0.55
      let carry = 0
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i]
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        let d = carry
        while (d <= len) {
          const t = len ? d / len : 0
          const cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t
          for (let k = 0; k < dots; k++) {
            const u = hashNoise(cx, cy, seed + k * 1.7)
            const v = hashNoise(cx + 5.3, cy + 9.1, seed + k * 2.3)
            const r = R * Math.sqrt(u), th = v * Math.PI * 2
            ctx.beginPath()
            ctx.arc(cx + r * Math.cos(th), cy + r * Math.sin(th), 0.5 + u * 0.7, 0, Math.PI * 2)
            ctx.fill()
          }
          d += gap
        }
        carry = d - len
      }
      break
    }
    case 'neon': { // soft glow around a bright core
      ctx.globalAlpha = alpha * 0.1; ctx.lineWidth = size * 3.6; smoothPath(ctx, points); ctx.stroke()
      ctx.globalAlpha = alpha * 0.22; ctx.lineWidth = size * 2.2; smoothPath(ctx, points); ctx.stroke()
      ctx.globalAlpha = alpha; ctx.lineWidth = size * 0.9; smoothPath(ctx, points); ctx.stroke()
      ctx.globalAlpha = alpha * 0.85; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, size * 0.3)
      smoothPath(ctx, points); ctx.stroke()
      break
    }
    case 'crayon': { // waxy stroke with grainy specks inside and along the edges
      ctx.globalAlpha = alpha * 0.62
      ctx.lineWidth = size
      smoothPath(ctx, points)
      ctx.stroke()
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i]
        for (let d = 0; d < 4; d++) {
          const t = (d + 0.5) / 4
          const nx = a.x + (b.x - a.x) * t, ny = a.y + (b.y - a.y) * t
          const spread = d % 2 ? 1.5 : 0.9
          const ox = (hashNoise(nx, ny, seed + d) - 0.5) * size * spread
          const oy = (hashNoise(nx + 2.9, ny + 6.1, seed + d) - 0.5) * size * spread
          ctx.globalAlpha = alpha * (d % 2 ? 0.3 : 0.45)
          ctx.beginPath()
          ctx.arc(nx + ox, ny + oy, 0.5 + hashNoise(nx + 1.1, ny + 4.3, seed) * 1.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    }
    case 'rainbow': { // hue shifts along the stroke, so the colour picker is ignored on purpose
      ctx.globalAlpha = alpha
      const hue0 = (seed * 53) % 360
      let dist = 0
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i]
        dist += Math.hypot(b.x - a.x, b.y - a.y)
        ctx.strokeStyle = `hsl(${(hue0 + dist * 0.55) % 360}, 90%, 55%)`
        ctx.lineWidth = Math.max(0.8, size * (0.6 + 0.8 * (pr(a) + pr(b)) / 2))
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
      break
    }
    default: break
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
    else if (isShapeTool(s.tool)) renderShape(ctx, effective)
    else if (isGraphiteTool(s.tool)) renderGraphiteStroke(ctx, effective)
    else if (isBrushTool(s.tool)) renderBrushStroke(ctx, effective)
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
