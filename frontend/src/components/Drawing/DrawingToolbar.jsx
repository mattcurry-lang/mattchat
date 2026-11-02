import React, { useState, useRef, useEffect, useLayoutEffect, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import {
  IconPencil, IconMarker, IconHighlighter, IconEraser, IconShapes, IconType,
  IconStickyNote, IconImagePlus, IconPointer, IconSmile, IconHourglass, IconCheckSquare,
  IconDna, IconWand, IconUndo, IconRedo, IconTrash, IconDownload, IconMaximize, IconMinimize, IconX, IconMoreVertical,
} from '../Icons'
import {
  BRUSH_PRESETS, isBrushTool, isGraphiteTool, parseShapeTool, shapeToolId,
  renderBrushStroke, renderGraphiteStroke, renderStroke,
} from './drawingEngine'

// ── Layout idea ───────────────────────────────────────────────
// The bar holds only what you reach for every few seconds. Choices open in small popovers (brush, shape, style).
// Everything occasional lives in the three-dot menu. The prop API is unchanged, so DrawingModal keeps working;
// paper / onPaperChange / onCopilotAction are optional extras (their menu sections simply hide when not passed).

const TEMPLATES = [
  { id: 'brainstorm', label: '💡 Brainstorm' },
  { id: 'todo', label: '✅ To-do Board' },
  { id: 'mindmap', label: '🧠 Mind Map' },
]
const TIMER_PRESETS = [
  { label: '10s', seconds: 10 }, { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 }, { label: '5m', seconds: 300 },
]
const PENS = [
  { id: 'pen', label: 'Pen' },
  { id: 'marker', label: 'Marker' },
  { id: 'pencil-hb', label: 'Pencil HB' },
  { id: 'pencil-2b', label: 'Pencil 2B' },
  { id: 'pencil-4b', label: 'Pencil 4B' },
  { id: 'pencil-6b', label: 'Pencil 6B' },
  { id: 'pencil-mechanical', label: 'Mechanical' },
]
const BRUSHES = Object.entries(BRUSH_PRESETS).map(([k, v]) => ({ id: `brush-${k}`, label: v.label }))

const SHAPES = [
  { kind: 'line', label: 'Line' }, { kind: 'arrow', label: 'Arrow' }, { kind: 'doublearrow', label: 'Double arrow' },
  { kind: 'rect', label: 'Rectangle' }, { kind: 'rounded', label: 'Rounded box' }, { kind: 'circle', label: 'Circle' },
  { kind: 'triangle', label: 'Triangle' }, { kind: 'diamond', label: 'Diamond' }, { kind: 'pentagon', label: 'Pentagon' },
  { kind: 'hexagon', label: 'Hexagon' }, { kind: 'star', label: 'Star' }, { kind: 'heart', label: 'Heart' },
  { kind: 'cross', label: 'Plus' }, { kind: 'bubble', label: 'Speech bubble' },
]
const SHAPE_SVG = {
  line: <line x1="4" y1="20" x2="20" y2="4" />,
  arrow: <><line x1="4" y1="20" x2="20" y2="4" /><polyline points="11,4 20,4 20,13" /></>,
  doublearrow: <><line x1="5" y1="19" x2="19" y2="5" /><polyline points="5,12 5,19 12,19" /><polyline points="12,5 19,5 19,12" /></>,
  rect: <rect x="3.5" y="6" width="17" height="12" />,
  rounded: <rect x="3.5" y="6" width="17" height="12" rx="4" />,
  circle: <ellipse cx="12" cy="12" rx="8.5" ry="8.5" />,
  triangle: <polygon points="12,4 21,20 3,20" />,
  diamond: <polygon points="12,3 21,12 12,21 3,12" />,
  pentagon: <polygon points="12,3 21,10 17.5,20.5 6.5,20.5 3,10" />,
  hexagon: <polygon points="7,4.5 17,4.5 22,12 17,19.5 7,19.5 2,12" />,
  star: <polygon points="12,2.5 14.8,8.8 21.5,9.4 16.4,13.9 18,20.5 12,17 6,20.5 7.6,13.9 2.5,9.4 9.2,8.8" />,
  heart: <path d="M12 20.5C4 14.5 3 9.5 6 6.5 8.5 4.2 11 5.5 12 7.5 13 5.5 15.5 4.2 18 6.5 21 9.5 20 14.5 12 20.5Z" />,
  cross: <polygon points="9,3 15,3 15,9 21,9 21,15 15,15 15,21 9,21 9,15 3,15 3,9 9,9" />,
  bubble: <path d="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />,
}
const CLOSED_SHAPES = new Set(['rect', 'rounded', 'circle', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'heart', 'cross', 'bubble'])
const FILLS = [{ id: 'outline', label: 'Outline' }, { id: 'soft', label: 'Soft' }, { id: 'solid', label: 'Solid' }]
const PAPERS = [{ id: 'plain', label: 'Plain' }, { id: 'dots', label: 'Dots' }, { id: 'grid', label: 'Grid' }, { id: 'lines', label: 'Lines' }]
const REACTION_EMOJIS = ['❤️', '😂', '😭', '🔥', '👀', '👍', '😮', '💀', '🎉']
const SWATCHES = [
  '#111827', '#6b7280', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#a16207', '#7f1d1d',
]

const PANEL = {
  background: '#1e1e2e', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 16,
  boxShadow: '0 16px 48px rgba(0,0,0,0.5)', padding: 12, boxSizing: 'border-box', color: '#e8e8f0', fontFamily: 'inherit',
}
const LABEL = { fontSize: 10.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', margin: '2px 2px 8px' }
const INPUT = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12, padding: '6px 8px', outline: 'none', fontFamily: 'inherit' }

const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c || '')
const isLight = (c) => {
  if (!isHex(c)) return false
  const n = parseInt(c.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.8
}
const previewInk = (c) => (isLight(c) ? '#374151' : c)

// ── small building blocks ─────────────────────────────────────
const ToolButton = forwardRef(function ToolButton({ active, onClick, title, caret, badge, children }, ref) {
  return (
    <button
      ref={ref} onClick={onClick} title={title} aria-label={title} aria-pressed={active ? true : undefined}
      style={{
        position: 'relative', width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(167,139,250,0.18)' : 'transparent', border: `1px solid ${active ? 'rgba(167,139,250,0.4)' : 'transparent'}`,
        color: active ? '#c4b5fd' : 'rgba(255,255,255,0.65)', cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {children}
      {caret && <span style={{ position: 'absolute', right: 4, bottom: 5, width: 0, height: 0, borderLeft: '3px solid transparent', borderRight: '3px solid transparent', borderTop: '4px solid currentColor', opacity: 0.7 }} />}
      {badge && <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: '#a78bfa' }} />}
    </button>
  )
})

const Divider = () => <div aria-hidden="true" style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)', margin: '0 4px', flexShrink: 0 }} />

// Floating panel that is not clipped by the scrolling toolbar (rendered in <body>, placed under its button).
function Popover({ anchorRef, open, onClose, width = 280, align = 'left', children }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const r = anchorRef.current?.getBoundingClientRect()
    if (!r) return
    const vw = window.innerWidth
    const w = Math.min(width, vw - 16)
    const left = align === 'right' ? Math.max(8, Math.min(r.right - w, vw - w - 8)) : Math.max(8, Math.min(r.left, vw - w - 8))
    setPos({ top: r.bottom + 8, left, width: w, maxH: Math.max(200, window.innerHeight - r.bottom - 20) })
  }, [open, anchorRef, width, align])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return
      onClose()
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorRef])

  if (!open || !pos) return null
  return createPortal(
    <div ref={ref} role="dialog" style={{ ...PANEL, position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxH, overflowY: 'auto', zIndex: 99990 }}>
      {children}
    </div>,
    document.body
  )
}

// Live preview: draws a little wave with the REAL brush engine, so what you pick is what you get.
function BrushPreview({ tool, color, size }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const w = 112, h = 34
    const dpr = window.devicePixelRatio || 1
    c.width = w * dpr; c.height = h * dpr
    const ctx = c.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const pts = []
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      pts.push({ x: 10 + t * (w - 20), y: h / 2 + Math.sin(t * Math.PI * 2) * h * 0.24, pressure: 0.35 + 0.55 * Math.sin(t * Math.PI) })
    }
    const stroke = { id: `preview-${tool}`, tool, color: previewInk(color), size, opacity: 1, points: pts }
    if (isBrushTool(tool)) renderBrushStroke(ctx, stroke)
    else if (isGraphiteTool(tool)) renderGraphiteStroke(ctx, stroke)
    else if (tool === 'marker') renderStroke(ctx, { ...stroke, size: size * 1.6 })
    else renderStroke(ctx, stroke)
  }, [tool, color, size])
  return <canvas ref={ref} style={{ width: 112, height: 34, display: 'block', borderRadius: 8, background: '#f8f7ff' }} />
}

function BrushTile({ id, label, active, color, size, onPick }) {
  return (
    <button
      onClick={() => onPick(id)} aria-pressed={active}
      style={{
        display: 'flex', flexDirection: 'column', gap: 5, padding: 6, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
        background: active ? 'rgba(167,139,250,0.16)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? 'rgba(167,139,250,0.55)' : 'rgba(255,255,255,0.07)'}`,
      }}
    >
      <BrushPreview tool={id} color={color} size={Math.max(2, Math.min(size, 9))} />
      <span style={{ fontSize: 11.5, fontWeight: 700, color: active ? '#c4b5fd' : 'rgba(255,255,255,0.8)', textAlign: 'left', padding: '0 2px' }}>{label}</span>
    </button>
  )
}

function ShapeGlyph({ kind, fill, size = 22 }) {
  const closed = CLOSED_SHAPES.has(kind)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      stroke="currentColor" fill={closed && fill !== 'outline' ? 'currentColor' : 'none'} fillOpacity={fill === 'soft' ? 0.28 : 1}>
      {SHAPE_SVG[kind]}
    </svg>
  )
}

function Segmented({ value, options, onChange }) {
  return (
    <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 3, padding: 3, borderRadius: 11, background: 'rgba(255,255,255,0.06)' }}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          style={{
            padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            background: value === o.id ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'transparent', color: value === o.id ? '#fff' : 'rgba(255,255,255,0.7)',
          }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const Switch = ({ on }) => (
  <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? '#7c6cf0' : 'rgba(255,255,255,0.18)', position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
    <span style={{ position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(14px)' : 'none', transition: 'transform .15s' }} />
  </span>
)

function MenuRow({ icon, label, hint, onClick, right, danger, active }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '9px 8px', background: active ? 'rgba(167,139,250,0.12)' : 'none', border: 'none', borderRadius: 10, color: danger ? '#f87171' : '#e8e8f0', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'rgba(167,139,250,0.12)' : 'none' }}
    >
      <span style={{ width: 22, display: 'flex', justifyContent: 'center', color: danger ? '#f87171' : 'rgba(255,255,255,0.7)', fontSize: 15 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        {label}
        {hint && <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>{hint}</span>}
      </span>
      {right}
    </button>
  )
}
const Sep = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

// ── the toolbar ───────────────────────────────────────────────
export default function DrawingToolbar({
  tool, onToolChange, color, onColorChange, size, onSizeChange,
  canUndo, canRedo, onUndo, onRedo, onClear, onExport,
  onAddSticky, onAddImage,
  pointing, onTogglePoint, onPickReaction,
  onStartTimer, onStartVote,
  onAddMindMap, onApplyTemplate,
  onOpenGamePicker,
  onReplay, smartShapeActive, onToggleSmartShape,
  onSaveToChat, saving, saved,
  isFullscreen, onToggleFullscreen, onClose,
  paper, onPaperChange,          // optional: paper pattern (plain | dots | grid | lines)
  onCopilotAction,               // optional: ('brainstorm' | 'guess' | 'summarize') => void
}) {
  const [open, setOpen] = useState(null) // null | 'brush' | 'shape' | 'style' | 'more'
  const [sub, setSub] = useState(null)   // expanded row inside the menu: templates | react | timer | vote
  const [shapeFill, setShapeFill] = useState('outline')
  const [voteQuestion, setVoteQuestion] = useState('')
  const [voteOptions, setVoteOptions] = useState(['', ''])

  const brushRef = useRef(null)
  const shapeRef = useRef(null)
  const styleRef = useRef(null)
  const moreRef = useRef(null)

  const close = () => { setOpen(null); setSub(null) }
  const toggle = (name) => { setSub(null); setOpen((o) => (o === name ? null : name)) }
  const pickTool = (id) => { onToolChange(id); close() }

  const activeShape = parseShapeTool(tool)
  const inBrushGroup = tool === 'pen' || tool === 'marker' || isGraphiteTool(tool) || isBrushTool(tool)
  const pickShape = (kind) => pickTool(shapeToolId(kind, shapeFill))
  const changeFill = (f) => {
    setShapeFill(f)
    if (activeShape) onToolChange(shapeToolId(activeShape.kind, f))
  }
  const doAndClose = (fn) => () => { close(); fn?.() }

  const submitVote = () => {
    const opts = voteOptions.map((o) => o.trim()).filter(Boolean)
    if (!voteQuestion.trim() || opts.length < 2) return
    onStartVote(voteQuestion.trim(), opts)
    setVoteQuestion(''); setVoteOptions(['', '']); close()
  }

  const brushIcon = tool === 'marker' ? <IconMarker size={17} /> : <IconPencil size={17} />

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#181825', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'relative', zIndex: 20 }}>
      <style>{`.dt-scroll{scrollbar-width:none}.dt-scroll::-webkit-scrollbar{display:none}`}</style>

      {/* ── everyday tools (scrolls sideways on small screens) ── */}
      <div className="dt-scroll" style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0, overflowX: 'auto' }}>
        <ToolButton ref={brushRef} active={inBrushGroup} caret onClick={() => toggle('brush')} title="Pens & brushes">{brushIcon}</ToolButton>
        <ToolButton active={tool === 'highlighter'} onClick={() => pickTool('highlighter')} title="Highlighter"><IconHighlighter size={17} /></ToolButton>
        <ToolButton active={tool === 'eraser'} onClick={() => pickTool('eraser')} title="Eraser"><IconEraser size={17} /></ToolButton>
        <ToolButton active={tool === 'select'} onClick={() => pickTool('select')} title="Select & move"><IconCheckSquare size={17} /></ToolButton>
        <Divider />
        <ToolButton ref={shapeRef} active={!!activeShape} caret onClick={() => toggle('shape')} title="Shapes"><IconShapes size={17} /></ToolButton>
        <ToolButton active={tool === 'text'} onClick={() => pickTool('text')} title="Text"><IconType size={17} /></ToolButton>
        {onAddSticky && <ToolButton onClick={onAddSticky} title="Sticky note"><IconStickyNote size={17} /></ToolButton>}
        <Divider />
        <button
          ref={styleRef} onClick={() => toggle('style')} title="Color & thickness" aria-label="Color and thickness"
          style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: open === 'style' ? 'rgba(167,139,250,0.18)' : 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}
        >
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: color, border: '2px solid rgba(255,255,255,0.35)', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)' }} />
        </button>
        <Divider />
        <ToolButton onClick={onUndo} title="Undo (Ctrl+Z)"><IconUndo size={17} style={{ opacity: canUndo ? 1 : 0.3 }} /></ToolButton>
        <ToolButton onClick={onRedo} title="Redo (Ctrl+Shift+Z)"><IconRedo size={17} style={{ opacity: canRedo ? 1 : 0.3 }} /></ToolButton>
      </div>

      {/* ── always-visible right side ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {onSaveToChat && (
          <button
            onClick={onSaveToChat} disabled={saving} title="Save this drawing to the chat"
            style={{
              height: 34, padding: '0 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: saving ? 'default' : 'pointer',
              background: saved ? 'rgba(52,211,153,0.15)' : 'linear-gradient(135deg,#667eea,#764ba2)', border: saved ? '1px solid rgba(52,211,153,0.35)' : 'none',
              color: saved ? '#34d399' : '#fff', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
          </button>
        )}
        <ToolButton ref={moreRef} active={open === 'more'} badge={pointing || smartShapeActive} onClick={() => toggle('more')} title="More"><IconMoreVertical size={17} /></ToolButton>
        <button onClick={onClose} title="Close" aria-label="Close" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#f87171', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <IconX size={16} />
        </button>
      </div>

      {/* ── pens & brushes ── */}
      <Popover anchorRef={brushRef} open={open === 'brush'} onClose={close} width={310}>
        <div style={LABEL}>Pens &amp; pencils</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {PENS.map((p) => <BrushTile key={p.id} {...p} active={tool === p.id} color={color} size={size} onPick={pickTool} />)}
        </div>
        <div style={{ ...LABEL, marginTop: 14 }}>Brushes</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {BRUSHES.map((p) => <BrushTile key={p.id} {...p} active={tool === p.id} color={color} size={size} onPick={pickTool} />)}
        </div>
        <div style={{ ...LABEL, marginTop: 14 }}>Thickness</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="range" min={1} max={40} value={size} onChange={(e) => onSizeChange(Number(e.target.value))} style={{ flex: 1, accentColor: '#a78bfa' }} aria-label="Thickness" />
          <span style={{ width: 24, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{size}</span>
        </div>
      </Popover>

      {/* ── shapes ── */}
      <Popover anchorRef={shapeRef} open={open === 'shape'} onClose={close} width={300}>
        <div style={LABEL}>Style</div>
        <Segmented value={activeShape?.fill || shapeFill} options={FILLS} onChange={changeFill} />
        <div style={{ ...LABEL, marginTop: 14 }}>Shapes</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {SHAPES.map((s) => {
            const active = activeShape?.kind === s.kind
            return (
              <button key={s.kind} onClick={() => pickShape(s.kind)} title={s.label} aria-label={s.label} aria-pressed={active}
                style={{ height: 44, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? '#c4b5fd' : 'rgba(255,255,255,0.75)',
                  background: active ? 'rgba(167,139,250,0.16)' : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? 'rgba(167,139,250,0.55)' : 'rgba(255,255,255,0.07)'}` }}>
                <ShapeGlyph kind={s.kind} fill={activeShape?.fill || shapeFill} />
              </button>
            )
          })}
        </div>
        {onToggleSmartShape && (
          <>
            <Sep />
            <MenuRow icon="✨" label="Smart Shape" hint="Rough gestures snap to clean shapes" onClick={onToggleSmartShape} right={<Switch on={!!smartShapeActive} />} />
          </>
        )}
      </Popover>

      {/* ── color & thickness ── */}
      <Popover anchorRef={styleRef} open={open === 'style'} onClose={close} width={264}>
        <div style={LABEL}>Color</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {SWATCHES.map((c) => (
            <button key={c} onClick={() => onColorChange(c)} aria-label={`Color ${c}`} aria-pressed={color.toLowerCase() === c}
              style={{ aspectRatio: '1', borderRadius: '50%', background: c, cursor: 'pointer', border: color.toLowerCase() === c ? '3px solid #c4b5fd' : '2px solid rgba(255,255,255,0.18)', boxShadow: color.toLowerCase() === c ? '0 0 0 2px rgba(0,0,0,0.4)' : 'none' }} />
          ))}
        </div>
        <label title="Custom color" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
          <span style={{ position: 'relative', width: 28, height: 28, borderRadius: '50%', background: 'conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)', border: '2px solid rgba(255,255,255,0.25)', flexShrink: 0 }}>
            <input type="color" value={isHex(color) ? color : '#000000'} onChange={(e) => onColorChange(e.target.value)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
          </span>
          Custom color
        </label>
        <div style={{ ...LABEL, marginTop: 14 }}>Thickness</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ width: Math.max(3, Math.min(size, 26)), height: Math.max(3, Math.min(size, 26)), borderRadius: '50%', background: color, border: '1px solid rgba(255,255,255,0.3)' }} />
          </span>
          <input type="range" min={1} max={40} value={size} onChange={(e) => onSizeChange(Number(e.target.value))} style={{ flex: 1, accentColor: '#a78bfa' }} aria-label="Thickness" />
          <span style={{ width: 24, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{size}</span>
        </div>
      </Popover>

      {/* ── the three-dot menu ── */}
      <Popover anchorRef={moreRef} open={open === 'more'} onClose={close} width={290} align="right">
        <div style={LABEL}>Add to board</div>
        {onAddImage && <MenuRow icon={<IconImagePlus size={16} />} label="Image" onClick={doAndClose(onAddImage)} />}
        {onAddMindMap && <MenuRow icon={<IconDna size={16} />} label="Mind map" onClick={doAndClose(onAddMindMap)} />}
        {onApplyTemplate && (
          <>
            <MenuRow icon={<IconWand size={16} />} label="Templates" onClick={() => setSub(sub === 'templates' ? null : 'templates')} active={sub === 'templates'} right={<span style={{ opacity: 0.5 }}>{sub === 'templates' ? '▴' : '▾'}</span>} />
            {sub === 'templates' && TEMPLATES.map((t) => (
              <MenuRow key={t.id} icon="" label={t.label} onClick={doAndClose(() => onApplyTemplate(t.id))} />
            ))}
          </>
        )}

        {(onTogglePoint || onPickReaction || onStartTimer || onStartVote || onOpenGamePicker) && (
          <>
            <Sep />
            <div style={LABEL}>Together</div>
            {onTogglePoint && <MenuRow icon={<IconPointer size={16} />} label="Point at something" onClick={() => { onTogglePoint(); close() }} right={<Switch on={!!pointing} />} />}
            {onPickReaction && (
              <>
                <MenuRow icon={<IconSmile size={16} />} label="Send a reaction" onClick={() => setSub(sub === 'react' ? null : 'react')} active={sub === 'react'} right={<span style={{ opacity: 0.5 }}>{sub === 'react' ? '▴' : '▾'}</span>} />
                {sub === 'react' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '2px 4px 8px 38px' }}>
                    {REACTION_EMOJIS.map((e) => (
                      <button key={e} onClick={() => { onPickReaction(e); close() }} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: 'none', fontSize: 17, cursor: 'pointer' }}>{e}</button>
                    ))}
                  </div>
                )}
              </>
            )}
            {onStartTimer && (
              <>
                <MenuRow icon={<IconHourglass size={16} />} label="Start a timer" onClick={() => setSub(sub === 'timer' ? null : 'timer')} active={sub === 'timer'} right={<span style={{ opacity: 0.5 }}>{sub === 'timer' ? '▴' : '▾'}</span>} />
                {sub === 'timer' && (
                  <div style={{ display: 'flex', gap: 6, padding: '2px 4px 8px 38px' }}>
                    {TIMER_PRESETS.map((p) => (
                      <button key={p.seconds} onClick={() => { onStartTimer(p.seconds); close() }} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{p.label}</button>
                    ))}
                  </div>
                )}
              </>
            )}
            {onStartVote && (
              <>
                <MenuRow icon={<IconCheckSquare size={16} />} label="Start a vote" onClick={() => setSub(sub === 'vote' ? null : 'vote')} active={sub === 'vote'} right={<span style={{ opacity: 0.5 }}>{sub === 'vote' ? '▴' : '▾'}</span>} />
                {sub === 'vote' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 4px 8px 38px' }}>
                    <input value={voteQuestion} onChange={(e) => setVoteQuestion(e.target.value)} placeholder="Question…" style={INPUT} />
                    {voteOptions.map((opt, i) => (
                      <input key={i} value={opt} onChange={(e) => setVoteOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))} placeholder={`Option ${i + 1}`} style={INPUT} />
                    ))}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {voteOptions.length < 4 && <button onClick={() => setVoteOptions((p) => [...p, ''])} style={{ flex: 1, background: 'none', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 11.5, padding: '6px 0', cursor: 'pointer' }}>+ Option</button>}
                      <button onClick={submitVote} style={{ flex: 1, background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 8, color: '#c4b5fd', fontSize: 11.5, fontWeight: 700, padding: '6px 0', cursor: 'pointer' }}>Start</button>
                    </div>
                  </div>
                )}
              </>
            )}
            {onOpenGamePicker && <MenuRow icon="🎮" label="Play a game" onClick={doAndClose(onOpenGamePicker)} />}
          </>
        )}

        {onCopilotAction && (
          <>
            <Sep />
            <div style={LABEL}>Curry Copilot</div>
            <MenuRow icon="✨" label="Brainstorm ideas" hint="Turn a topic into sticky notes" onClick={doAndClose(() => onCopilotAction('brainstorm'))} />
            <MenuRow icon="🔍" label="Guess my drawing" hint="Curry looks at the board and guesses" onClick={doAndClose(() => onCopilotAction('guess'))} />
            <MenuRow icon="📝" label="Summarize the board" hint="Notes from your sticky notes and text" onClick={doAndClose(() => onCopilotAction('summarize'))} />
          </>
        )}

        <Sep />
        <div style={LABEL}>Canvas</div>
        {onPaperChange && (
          <div style={{ padding: '0 2px 8px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, margin: '0 0 6px 6px', color: 'rgba(255,255,255,0.7)' }}>Paper</div>
            <Segmented value={paper || 'plain'} options={PAPERS} onChange={onPaperChange} />
          </div>
        )}
        {onReplay && <MenuRow icon="▶️" label="Replay drawing" onClick={doAndClose(onReplay)} />}
        {onExport && <MenuRow icon={<IconDownload size={16} />} label="Export as PNG" onClick={doAndClose(onExport)} />}
        {onToggleFullscreen && <MenuRow icon={isFullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />} label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={doAndClose(onToggleFullscreen)} />}
        {onClear && (
          <MenuRow
            icon={<IconTrash size={16} />} label="Clear canvas" danger
            onClick={() => { close(); if (window.confirm('Clear the whole canvas? This clears it for everyone in the session.')) onClear() }}
          />
        )}
      </Popover>
    </div>
  )
}
