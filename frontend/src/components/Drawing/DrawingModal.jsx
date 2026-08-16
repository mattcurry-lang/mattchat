import React, { useState, useRef, useEffect, useCallback } from 'react'
import DrawingCanvas from './DrawingCanvas'
import DrawingToolbar from './DrawingToolbar'

// Phase 1: local-only collaborative-canvas UI shell. No Supabase, no
// session, no persistence yet — this validates the drawing feel,
// toolbar ergonomics, and mobile/desktop input handling in isolation
// before Phase 2 wires in useDrawingSession + realtime broadcast.
export default function DrawingModal({ onClose }) {
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#a78bfa')
  const [size, setSize] = useState(6)
  const [opacity] = useState(1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const canvasApiRef = useRef(null)
  const modalRef = useRef(null)

  // ── Keyboard shortcuts (desktop) ──
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && e.shiftKey) { e.preventDefault(); canvasApiRef.current?.redo() }
      else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); canvasApiRef.current?.undo() }
      else if (e.key.toLowerCase() === 'e' && !mod) setTool('eraser')
      else if (e.key.toLowerCase() === 'b' && !mod) setTool('pen')
      else if (e.key === 'Escape') setTool('pen')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Prevent the whole page from scrolling behind the modal while it's open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [])

  const handleExport = useCallback(() => {
    const dataUrl = canvasApiRef.current?.exportPng()
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `mattchat-drawing-${Date.now()}.png`
    a.click()
  }, [])

  const handleClear = useCallback(() => {
    if (window.confirm('Clear the whole canvas? This can\'t be undone.')) {
      canvasApiRef.current?.clear()
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      modalRef.current?.requestFullscreen?.().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(10,10,16,0.92)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: '100%', height: '100%', maxWidth: 1100, maxHeight: 800,
          background: '#0f0f1a', borderRadius: 20, border: '1px solid rgba(167,139,250,0.15)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'drawModalPop 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <style>{`@keyframes drawModalPop { from { opacity:0; transform: scale(0.97); } to { opacity:1; transform:none; } }`}</style>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            🎨 Draw Together
          </div>
        </div>

        {/* Toolbar */}
        <DrawingToolbar
          tool={tool}
          onToolChange={setTool}
          color={color}
          onColorChange={setColor}
          size={size}
          onSizeChange={setSize}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => canvasApiRef.current?.undo()}
          onRedo={() => canvasApiRef.current?.redo()}
          onClear={handleClear}
          onExport={handleExport}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onClose={onClose}
        />

        {/* Canvas */}
        <div style={{ flex: 1, minHeight: 0, padding: 14 }}>
          <DrawingCanvas
            ref={canvasApiRef}
            tool={tool}
            color={color}
            size={size}
            opacity={opacity}
            onCanUndoChange={setCanUndo}
            onCanRedoChange={setCanRedo}
            onLocalStrokeEnd={() => {}} // Phase 2 will broadcast + persist here
          />
        </div>
      </div>
    </div>
  )
}
