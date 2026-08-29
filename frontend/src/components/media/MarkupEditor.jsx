// MarkupEditor.jsx
// A transparent annotation layer drawn on top of a base image/video-frame
// canvas. Exposes an imperative handle so MediaComposer can pull the
// flattened result out via `getMergedCanvas()` at send time.
//
// Tools: pen, eraser, arrow, circle, rectangle, text, blur.
// Undo/redo works on full-canvas ImageData snapshots — simple and reliable
// at the resolution we work with (composer downsamples for editing, see
// MediaComposer's EDIT_MAX_DIM), at the cost of some memory for a long
// undo chain, which we cap.

import { useRef, useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import { IconX } from '../Icons'

const COLORS = ['#ffffff', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#5ac8fa', '#7c5cff', '#000000']
const MAX_HISTORY = 25

const TOOLS = {
  PEN: 'pen', ERASER: 'eraser', ARROW: 'arrow', CIRCLE: 'circle',
  RECT: 'rect', TEXT: 'text', BLUR: 'blur',
}

const MarkupEditor = forwardRef(function MarkupEditor(
  { baseImage, width, height, onClose, onDone },
  ref
) {
  const baseCanvasRef = useRef(null)   // the photo, static
  const markupCanvasRef = useRef(null) // transparent annotation layer
  const drawingRef = useRef(false)
  const startPointRef = useRef(null)
  const snapshotRef = useRef(null)     // markup pixels at stroke start, for shape preview
  const historyRef = useRef([])
  const historyIndexRef = useRef(-1)

  const [tool, setTool] = useState(TOOLS.PEN)
  const [color, setColor] = useState('#ff3b30')
  const [brushSize, setBrushSize] = useState(6)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [textInput, setTextInput] = useState(null) // { x, y } | null while placing text

  // Draw the base image once
  useEffect(() => {
    const canvas = baseCanvasRef.current
    if (!canvas || !baseImage) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(baseImage, 0, 0, width, height)
  }, [baseImage, width, height])

  const pushHistory = useCallback(() => {
    const canvas = markupCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const snap = ctx.getImageData(0, 0, width, height)
    const hist = historyRef.current.slice(0, historyIndexRef.current + 1)
    hist.push(snap)
    if (hist.length > MAX_HISTORY) hist.shift()
    historyRef.current = hist
    historyIndexRef.current = hist.length - 1
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(false)
  }, [width, height])

  // seed history with a blank markup layer
  useEffect(() => {
    const canvas = markupCanvasRef.current
    if (!canvas) return
    canvas.width = width
    canvas.height = height
    pushHistory()
  }, [width, height, pushHistory])

  const restoreSnapshot = (imgData) => {
    const ctx = markupCanvasRef.current.getContext('2d')
    ctx.putImageData(imgData, 0, 0)
  }

  const undo = () => {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current -= 1
    restoreSnapshot(historyRef.current[historyIndexRef.current])
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(true)
  }

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current += 1
    restoreSnapshot(historyRef.current[historyIndexRef.current])
    setCanUndo(true)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
  }

  const getPos = (e) => {
    const rect = markupCanvasRef.current.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  const applyBlurAt = (ctx, x, y, radius) => {
    // Sample the composed (base + markup-so-far) region, blur it via a
    // temporary canvas with CSS filter, and stamp it back — a cheap
    // approximation of a real blur brush without a WASM image lib.
    const size = radius * 2
    const sx = Math.max(0, x - radius), sy = Math.max(0, y - radius)
    const tmp = document.createElement('canvas')
    tmp.width = size; tmp.height = size
    const tctx = tmp.getContext('2d')
    tctx.filter = 'blur(6px)'
    tctx.drawImage(baseCanvasRef.current, sx, sy, size, size, 0, 0, size, size)
    tctx.drawImage(markupCanvasRef.current, sx, sy, size, size, 0, 0, size, size)
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(tmp, sx, sy)
    ctx.restore()
  }

  const handlePointerDown = (e) => {
    if (tool === TOOLS.TEXT) {
      const pos = getPos(e)
      setTextInput({ x: pos.x, y: pos.y, value: '' })
      return
    }
    e.preventDefault()
    drawingRef.current = true
    const pos = getPos(e)
    startPointRef.current = pos
    const ctx = markupCanvasRef.current.getContext('2d')
    snapshotRef.current = ctx.getImageData(0, 0, width, height)

    if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }
    if (tool === TOOLS.BLUR) {
      applyBlurAt(ctx, pos.x, pos.y, brushSize * 2)
    }
  }

  const handlePointerMove = (e) => {
    if (!drawingRef.current) return
    e.preventDefault()
    const pos = getPos(e)
    const ctx = markupCanvasRef.current.getContext('2d')

    if (tool === TOOLS.PEN) {
      ctx.strokeStyle = color
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalCompositeOperation = 'source-over'
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    } else if (tool === TOOLS.ERASER) {
      ctx.lineWidth = brushSize * 2.5
      ctx.lineCap = 'round'
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
    } else if (tool === TOOLS.BLUR) {
      applyBlurAt(ctx, pos.x, pos.y, brushSize * 2)
    } else if ([TOOLS.ARROW, TOOLS.CIRCLE, TOOLS.RECT].includes(tool)) {
      // live preview: restore pre-stroke snapshot, then draw shape fresh
      ctx.putImageData(snapshotRef.current, 0, 0)
      drawShape(ctx, tool, startPointRef.current, pos, color, brushSize)
    }
  }

  const drawShape = (ctx, shapeTool, start, end, strokeColor, lineWidth) => {
    ctx.strokeStyle = strokeColor
    ctx.fillStyle = strokeColor
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    if (shapeTool === TOOLS.RECT) {
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
    } else if (shapeTool === TOOLS.CIRCLE) {
      const rx = Math.abs(end.x - start.x) / 2
      const ry = Math.abs(end.y - start.y) / 2
      const cx = (start.x + end.x) / 2
      const cy = (start.y + end.y) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    } else if (shapeTool === TOOLS.ARROW) {
      const angle = Math.atan2(end.y - start.y, end.x - start.x)
      const headLen = Math.max(12, lineWidth * 3)
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(end.x, end.y)
      ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6))
      ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6))
      ctx.closePath()
      ctx.fill()
    }
  }

  const handlePointerUp = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    pushHistory()
  }

  const commitText = () => {
    if (!textInput?.value?.trim()) { setTextInput(null); return }
    const ctx = markupCanvasRef.current.getContext('2d')
    ctx.fillStyle = color
    ctx.font = `${Math.max(20, brushSize * 4)}px -apple-system, sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillText(textInput.value, textInput.x, textInput.y)
    setTextInput(null)
    pushHistory()
  }

  useImperativeHandle(ref, () => ({
    /** Flattens base + markup into one canvas and returns it. */
    getMergedCanvas: () => {
      const out = document.createElement('canvas')
      out.width = width; out.height = height
      const octx = out.getContext('2d')
      octx.drawImage(baseCanvasRef.current, 0, 0)
      octx.drawImage(markupCanvasRef.current, 0, 0)
      return out
    },
    hasEdits: () => historyIndexRef.current > 0,
  }))

  return (
    <div style={wrapStyle}>
      <div style={canvasStackStyle}>
        <canvas ref={baseCanvasRef} width={width} height={height} style={layerStyle} />
        <canvas
          ref={markupCanvasRef}
          width={width} height={height}
          style={{ ...layerStyle, touchAction: 'none', cursor: tool === TOOLS.TEXT ? 'text' : 'crosshair' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
        {textInput && (
          <input
            autoFocus
            value={textInput.value}
            onChange={(e) => setTextInput(t => ({ ...t, value: e.target.value }))}
            onBlur={commitText}
            onKeyDown={(e) => { if (e.key === 'Enter') commitText() }}
            style={{
              position: 'absolute',
              left: `${(textInput.x / width) * 100}%`,
              top: `${(textInput.y / height) * 100}%`,
              background: 'transparent', border: '1px dashed rgba(255,255,255,0.6)',
              color, fontSize: Math.max(16, brushSize * 3), fontWeight: 700,
              outline: 'none', minWidth: 40,
            }}
          />
        )}
      </div>

      <div style={toolbarStyle}>
        <div style={toolRowStyle}>
          {[
            [TOOLS.PEN, '✏️'], [TOOLS.ERASER, '🧹'], [TOOLS.ARROW, '↗️'],
            [TOOLS.CIRCLE, '⭕'], [TOOLS.RECT, '⬜'], [TOOLS.TEXT, '🔤'], [TOOLS.BLUR, '🌫️'],
          ].map(([id, icon]) => (
            <button
              key={id}
              onClick={() => setTool(id)}
              style={{ ...toolBtnStyle, background: tool === id ? 'var(--accent, #7c5cff)' : 'rgba(255,255,255,0.08)' }}
            >{icon}</button>
          ))}
          <button onClick={undo} disabled={!canUndo} style={{ ...toolBtnStyle, opacity: canUndo ? 1 : 0.35 }}>↶</button>
          <button onClick={redo} disabled={!canRedo} style={{ ...toolBtnStyle, opacity: canRedo ? 1 : 0.35 }}>↷</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: color === c ? '2px solid #7c5cff' : '2px solid rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </div>
          <input
            type="range" min={2} max={24} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{ flex: 1, maxWidth: 100 }}
          />
        </div>
      </div>

      <div style={topBarStyle}>
        <button onClick={onClose} style={iconBtnStyle}><IconX size={16} /></button>
        <button onClick={() => onDone(ref.current?.getMergedCanvas ? ref.current.getMergedCanvas() : markupCanvasRef.current)} style={doneBtnStyle}>
          Done
        </button>
      </div>
    </div>
  )
})

export default MarkupEditor

const wrapStyle = { position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', background: '#000' }
const canvasStackStyle = { position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }
const layerStyle = { position: 'absolute', maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }
const topBarStyle = { position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '14px 16px' }
const iconBtnStyle = { width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', color: '#fff', border: 'none', cursor: 'pointer' }
const doneBtnStyle = { background: 'var(--accent, #7c5cff)', color: '#fff', border: 'none', borderRadius: 20, padding: '9px 20px', fontWeight: 700, cursor: 'pointer' }
const toolbarStyle = { padding: '10px 14px max(10px, env(safe-area-inset-bottom))', background: 'rgba(20,18,30,0.9)', display: 'flex', flexDirection: 'column', gap: 10 }
const toolRowStyle = { display: 'flex', gap: 8, overflowX: 'auto' }
const toolBtnStyle = { width: 38, height: 38, borderRadius: 10, border: 'none', fontSize: 16, cursor: 'pointer', flexShrink: 0 }
