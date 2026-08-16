import React, { useState, useRef, useEffect, useCallback } from 'react'
import DrawingCanvas from './DrawingCanvas'
import DrawingToolbar from './DrawingToolbar'
import { useDrawingSession } from '../../hooks/useDrawingSession'

// Phase 2: shared, persisted, realtime canvas. This modal now owns the
// session/channel lifecycle via useDrawingSession and wires every remote
// event straight into DrawingCanvas's imperative ref methods —
// DrawingCanvas itself stays completely unaware of Supabase.
export default function DrawingModal({ session, conversationId, userId, profile, sendMessage, onClose }) {
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#a78bfa')
  const [size, setSize] = useState(6)
  const [opacity] = useState(1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved
  const canvasApiRef = useRef(null)
  const modalRef = useRef(null)
  const { micOn, toggleMic, otherSpeaking, connected } = useDrawingVoice(conversationId, true)

  const handlers = {
    onInitialStrokes: (strokes) => canvasApiRef.current?.applyInitialStrokes(strokes),
    onRemoteStrokeStart: (payload) => canvasApiRef.current?.applyRemoteStrokeStart(payload),
    onRemoteStrokeUpdate: (payload) => canvasApiRef.current?.applyRemoteStrokeUpdate(payload),
    onRemoteStrokeEnd: (payload) => canvasApiRef.current?.applyRemoteStrokeEnd(payload),
    onRemoteUndo: (payload) => canvasApiRef.current?.applyRemoteUndo(payload),
    onRemoteRedo: (payload) => canvasApiRef.current?.applyRemoteRedo(payload),
    onRemoteClear: () => canvasApiRef.current?.applyRemoteClear(),
    onRemoteCursor: (payload) => canvasApiRef.current?.applyRemoteCursor(payload),
  }

  const {
    loading, connectionStatus, participants,
    broadcastStrokeStart, broadcastStrokeUpdate, broadcastStrokeEnd,
    broadcastUndo, broadcastRedo, broadcastClear, broadcastCursor,
    saveToChat,
  } = useDrawingSession(conversationId, userId, profile, handlers)

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

  const handleSaveToChat = useCallback(async () => {
    if (!sendMessage || saveState === 'saving') return
    const dataUrl = canvasApiRef.current?.exportPng()
    if (!dataUrl) return
    setSaveState('saving')
    try {
      await saveToChat(dataUrl, sendMessage)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1800)
    } catch (e) {
      console.error('saveToChat failed:', e)
      setSaveState('idle')
      alert('Could not save the drawing to chat. Please try again.')
    }
  }, [sendMessage, saveState, saveToChat])

  const handleClear = useCallback(() => {
    if (window.confirm("Clear the whole canvas for everyone? This can't be undone.")) {
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

  const statusLabel = {
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting…',
    offline: "You're offline — your drawing is saved locally and will sync when you reconnect.",
    connected: null,
  }[connectionStatus]

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            🎨 Draw Together
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!loading && participants.length === 0 && (
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>Waiting for someone to join…</span>
            )}
            {participants.map(p => (
              <div key={p.userId} title={p.username} style={{
                display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.06)',
                borderRadius: 20, padding: '3px 8px 3px 3px',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{p.username}</span>
              </div>
            ))}
          </div>
        </div>

        {statusLabel && (
          <div style={{
            margin: '8px 16px 0', fontSize: 11.5, fontWeight: 600, textAlign: 'center',
            color: connectionStatus === 'offline' ? '#fbbf24' : '#a5b4fc',
            background: connectionStatus === 'offline' ? 'rgba(251,191,36,0.08)' : 'rgba(102,126,234,0.08)',
            border: `1px solid ${connectionStatus === 'offline' ? 'rgba(251,191,36,0.25)' : 'rgba(102,126,234,0.2)'}`,
            borderRadius: 10, padding: '6px 10px',
          }}>
            {statusLabel}
          </div>
        )}

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
          onSaveToChat={sendMessage ? handleSaveToChat : undefined}
          saving={saveState === 'saving'}
          saved={saveState === 'saved'}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onClose={onClose}
        />

      {/* Canvas */}
<div style={{ flex: 1, minHeight: 0, padding: 14 }}>
  {loading ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
      Opening canvas…
    </div>
  ) : (
    /* Relative container to anchor absolute-positioned siblings */
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DrawingCanvas
        ref={canvasApiRef}
        tool={tool}
        color={color}
        size={size}
        opacity={opacity}
        userId={userId}
        participantUserIds={participants.map(p => p.userId)}
        onCanUndoChange={setCanUndo}
        onCanRedoChange={setCanRedo}
        onLocalStrokeStart={broadcastStrokeStart}
        onLocalStrokeUpdate={broadcastStrokeUpdate}
        onLocalStrokeEnd={broadcastStrokeEnd}
        onLocalUndo={broadcastUndo}
        onLocalRedo={broadcastRedo}
        onLocalClear={broadcastClear}
        onLocalCursorMove={broadcastCursor}
      />

      {/* Voice Button Sibling */}
      <button
        onClick={toggleMic}
        title={micOn ? 'Mute mic' : 'Talk to them'}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 50,
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: micOn ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'rgba(0,0,0,0.55)',
          boxShadow: otherSpeaking ? '0 0 0 4px rgba(52,211,153,0.4)' : '0 4px 16px rgba(0,0,0,0.3)',
          transition: 'box-shadow 0.2s',
        }}
      >
        <IconMic size={20} style={{ color: micOn ? '#fff' : 'rgba(255,255,255,0.7)' }} />
      </button>
    </div>
  )}
</div>
      </div>
    </div>
  )
}
