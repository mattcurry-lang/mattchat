import React, { useState, useRef, useEffect, useCallback } from 'react'
import DrawingCanvas from './DrawingCanvas'
import DrawingToolbar from './DrawingToolbar'
import { useDrawingSession } from '../../hooks/useDrawingSession'
import { useDrawingVoice } from '../../hooks/useDrawingVoice'
import { IconMic } from '../Icons'

// Phase 2: shared, persisted, realtime canvas. This modal now owns the
// session/channel lifecycle via useDrawingSession and wires every remote
// event straight into DrawingCanvas's imperative ref methods —
// DrawingCanvas itself stays completely unaware of Supabase.
export default function DrawingModal({ session, conversationId, userId, profile, sendMessage, onInvite, inviteeName, onClose }) {
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#a78bfa')
  const [size, setSize] = useState(6)
  const [opacity] = useState(1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [saveState, setSaveState] = useState('idle') 
  const [inviteSent, setInviteSent] = useState(false)

  const handleInvite = useCallback(async () => {
    if (!onInvite) return
    setInviteSent(false)
    await onInvite()
    setInviteSent(true)
    setTimeout(() => setInviteSent(false), 3000)
  }, [onInvite])
  
  const canvasApiRef = useRef(null)
  const modalRef = useRef(null)
  const imageFileInputRef = useRef(null)

  // useDrawingVoice needs the drawing session's id (from
  // useDrawingSession's return) to know which channel to signal on,
  // but useDrawingSession needs a voice-signal handler (from
  // useDrawingVoice's return) in its `handlers` argument — a genuine
  // circular dependency between the two hooks in the same render.
  //
  // Broken by indirection: useDrawingSession gets a stable callback
  // that forwards to whatever's in voiceSignalHandlerRef; we point
  // that ref at the real voice.handleSignal in an effect below, once
  // useDrawingVoice has actually run.
  const voiceSignalHandlerRef = useRef(null)
  const onVoiceSignal = useCallback((payload) => {
    voiceSignalHandlerRef.current?.(payload)
  }, [])

  const handlers = {
    onInitialStrokes: (strokes) => canvasApiRef.current?.applyInitialStrokes(strokes),
    onRemoteStrokeStart: (payload) => canvasApiRef.current?.applyRemoteStrokeStart(payload),
    onRemoteStrokeUpdate: (payload) => canvasApiRef.current?.applyRemoteStrokeUpdate(payload),
    onRemoteStrokeEnd: (payload) => canvasApiRef.current?.applyRemoteStrokeEnd(payload),
    onRemoteUndo: (payload) => canvasApiRef.current?.applyRemoteUndo(payload),
    onRemoteRedo: (payload) => canvasApiRef.current?.applyRemoteRedo(payload),
    onRemoteClear: () => canvasApiRef.current?.applyRemoteClear(),
    onRemoteCursor: (payload) => canvasApiRef.current?.applyRemoteCursor(payload),
    onInitialObjects: (objects) => canvasApiRef.current?.applyInitialObjects(objects),
    onRemoteObjectCreated: (payload) => canvasApiRef.current?.applyRemoteObjectCreated(payload),
    onRemoteObjectMoving: (payload) => canvasApiRef.current?.applyRemoteObjectMoving(payload),
    onRemoteObjectUpdated: (payload) => canvasApiRef.current?.applyRemoteObjectUpdated(payload),
    onRemoteObjectDeleted: (payload) => canvasApiRef.current?.applyRemoteObjectDeleted(payload),
    onVoiceSignal,
  }

  const {
    session: drawingSession, // aliased — distinct from the `session` prop above
    loading, connectionStatus, participants,
    broadcastStrokeStart, broadcastStrokeUpdate, broadcastStrokeEnd,
    broadcastUndo, broadcastRedo, broadcastClear, broadcastCursor,
    broadcastObjectCreated, broadcastObjectMoving, broadcastObjectUpdated, broadcastObjectDeleted,
    uploadObjectImage, saveToChat,
  } = useDrawingSession(conversationId, userId, profile, handlers)

  const { micOn, toggleMic, otherSpeaking, connected, connecting, voiceError, handleSignal } =
    useDrawingVoice(drawingSession?.id, userId, true)

  // Wire the real signal handler into the ref useDrawingSession's
  // onVoiceSignal forwards to. Runs after mount/update, once
  // handleSignal reflects the current session — see the comment above.
  useEffect(() => {
    voiceSignalHandlerRef.current = handleSignal
  }, [handleSignal])

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

  const handleAddSticky = useCallback(() => {
    canvasApiRef.current?.createStickyNote()
  }, [])

  const handleAddImageClick = useCallback(() => {
    imageFileInputRef.current?.click()
  }, [])

  const handleImageFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again later
    if (!file) return
    try {
      const url = await uploadObjectImage(file)
      const dims = await new Promise((resolve) => {
        const img = new window.Image()
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
        img.onerror = () => resolve({ w: 400, h: 300 })
        img.src = url
      })
      canvasApiRef.current?.createImageObject({ url, naturalWidth: dims.w, naturalHeight: dims.h })
    } catch (err) {
      console.error('image insert failed:', err)
      alert('Could not add that image. Please try again.')
    }
  }, [uploadObjectImage])

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!loading && participants.length === 0 && (
              <>
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>
                  {inviteSent ? 'Invite sent ✓' : `Waiting for ${inviteeName || 'someone'} to join…`}
                </span>
                {onInvite && (
                  <button
                    onClick={handleInvite}
                    style={{
                      background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
                      borderRadius: 20, color: '#c4b5fd', fontSize: 11, fontWeight: 700,
                      padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Invite {inviteeName || ''}
                  </button>
                )}
              </>
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

        {/* Hidden file input for the Image tool — the toolbar button just
            triggers this via onAddImage, keeping the picker itself here
            alongside the upload logic that already lives in this modal. */}
        <input
          ref={imageFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageFileChange}
          style={{ display: 'none' }}
        />

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
          onAddSticky={handleAddSticky}
          onAddImage={handleAddImageClick}
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
        onLocalObjectCreate={broadcastObjectCreated}
        onLocalObjectMoving={broadcastObjectMoving}
        onLocalObjectUpdate={broadcastObjectUpdated}
        onLocalObjectDelete={broadcastObjectDeleted}
      />

     {/* Voice Button Sibling */}
      <button
        onClick={toggleMic}
        disabled={!connected}
        title={
          voiceError ? `Voice unavailable: ${voiceError}` :
          connecting ? 'Connecting voice…' :
          micOn ? 'Mute mic' : 'Talk to them'
        }
        style={{
          position: 'absolute', bottom: 20, right: 20, zIndex: 50,
          width: 48, height: 48, borderRadius: '50%', border: 'none',
          cursor: connected ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: voiceError ? 'rgba(239,68,68,0.6)' : micOn ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'rgba(0,0,0,0.55)',
          boxShadow: otherSpeaking ? '0 0 0 4px rgba(52,211,153,0.4)' : '0 4px 16px rgba(0,0,0,0.3)',
          opacity: connecting ? 0.5 : 1,
          transition: 'box-shadow 0.2s, opacity 0.2s',
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
