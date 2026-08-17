import React, { useState, useRef, useEffect, useCallback } from 'react'
import DrawingCanvas from './DrawingCanvas'
import DrawingToolbar from './DrawingToolbar'
import { useDrawingSession } from '../../hooks/useDrawingSession'
import { useDrawingVoice } from '../../hooks/useDrawingVoice'
import { IconMic } from '../Icons'

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

  // Phase 3 local UI state
  const [pointing, setPointing] = useState(false)
  const [armedReaction, setArmedReaction] = useState(null)
  const [comments, setComments] = useState({}) // objectId -> [comment]
  const [drawingUserIds, setDrawingUserIds] = useState(() => new Set())
  const drawingTimersRef = useRef(new Map())
  // new local state, alongside the other Phase 3 state:
const [activeTimer, setActiveTimer] = useState(null)   // { id, durationSeconds, label, startsAt, startedBy }
const [timeLeft, setTimeLeft] = useState(0)
const [activePoll, setActivePoll] = useState(null)     // { id, question, options, votes: { userId: optionId }, createdBy }

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

  const voiceSignalHandlerRef = useRef(null)
  const onVoiceSignal = useCallback((payload) => { voiceSignalHandlerRef.current?.(payload) }, [])

  // "X is drawing…" — inferred from stroke_start/stroke_end, no new
  // events needed. Auto-clears after 4s in case a stroke_end is missed
  // (e.g. a dropped connection mid-stroke).
  const markDrawing = useCallback((uid, on) => {
    setDrawingUserIds(prev => {
      const next = new Set(prev)
      if (on) next.add(uid); else next.delete(uid)
      return next
    })
    const timers = drawingTimersRef.current
    if (timers.has(uid)) { clearTimeout(timers.get(uid)); timers.delete(uid) }
    if (on) {
      const t = setTimeout(() => {
        setDrawingUserIds(prev => { const next = new Set(prev); next.delete(uid); return next })
        timers.delete(uid)
      }, 4000)
      timers.set(uid, t)
    }
  }, [])

  const handlers = {
    onInitialStrokes: (strokes) => canvasApiRef.current?.applyInitialStrokes(strokes),
    onRemoteStrokeStart: (payload) => { markDrawing(payload.userId, true); canvasApiRef.current?.applyRemoteStrokeStart(payload) },
    onRemoteStrokeUpdate: (payload) => canvasApiRef.current?.applyRemoteStrokeUpdate(payload),
    onRemoteStrokeEnd: (payload) => { markDrawing(payload.userId, false); canvasApiRef.current?.applyRemoteStrokeEnd(payload) },
    onRemoteUndo: (payload) => canvasApiRef.current?.applyRemoteUndo(payload),
    onRemoteRedo: (payload) => canvasApiRef.current?.applyRemoteRedo(payload),
    onRemoteClear: () => canvasApiRef.current?.applyRemoteClear(),
    onRemoteCursor: (payload) => canvasApiRef.current?.applyRemoteCursor(payload),
    onInitialObjects: (objects) => canvasApiRef.current?.applyInitialObjects(objects),
    onRemoteObjectCreated: (payload) => canvasApiRef.current?.applyRemoteObjectCreated(payload),
    onRemoteObjectMoving: (payload) => canvasApiRef.current?.applyRemoteObjectMoving(payload),
    onRemoteObjectUpdated: (payload) => canvasApiRef.current?.applyRemoteObjectUpdated(payload),
    onRemoteObjectDeleted: (payload) => canvasApiRef.current?.applyRemoteObjectDeleted(payload),
    // add to the handlers object:
  onRemoteVoteStart: (poll) => setActivePoll(poll),
  onRemoteVoteCast: ({ pollId, optionId, userId: voterId }) =>
    setActivePoll(prev => (prev && prev.id === pollId ? { ...prev, votes: { ...prev.votes, [voterId]: optionId } } : prev)),
  onRemoteVoteEnd: ({ pollId }) => setActivePoll(prev => (prev && prev.id === pollId ? { ...prev, ended: true } : prev)),
  onRemoteTimerStart: (timer) => setActiveTimer(timer),
  onRemoteTimerCancel: ({ timerId }) => setActiveTimer(prev => (prev && prev.id === timerId ? null : prev)),
    onRemoteReaction: (payload) => canvasApiRef.current?.applyRemoteReaction(payload),
    onRemotePointer: (payload) => canvasApiRef.current?.applyRemotePointer(payload),
    onRemotePointerOff: (payload) => canvasApiRef.current?.applyRemotePointerOff(payload),
    onInitialComments: (byObject) => setComments(byObject || {}),
    onRemoteCommentCreated: (payload) => setComments(prev => ({ ...prev, [payload.objectId]: [...(prev[payload.objectId] || []), payload] })),
    onRemoteCommentResolved: ({ commentId, objectId }) => setComments(prev => ({ ...prev, [objectId]: (prev[objectId] || []).map(c => (c.id === commentId ? { ...c, resolved: true } : c)) })),
    onRemoteCommentDeleted: ({ commentId, objectId }) => setComments(prev => ({ ...prev, [objectId]: (prev[objectId] || []).filter(c => c.id !== commentId) })),
    onVoiceSignal,
  }

 // pull the new functions off the hook:
const {
  session: drawingSession,
  loading, connectionStatus, participants,
  broadcastStrokeStart, broadcastStrokeUpdate, broadcastStrokeEnd,
  broadcastUndo, broadcastRedo, broadcastClear, broadcastCursor,
  broadcastObjectCreated, broadcastObjectMoving, broadcastObjectUpdated, broadcastObjectDeleted,
  uploadObjectImage, saveToChat,
  broadcastReaction, broadcastPointerMove, broadcastPointerOff,
  addComment, resolveComment, deleteComment,
  startVote, castVote, endVote, startTimer, cancelTimer, 
} = useDrawingSession(conversationId, userId, profile, handlers)

  const { micOn, toggleMic, otherSpeaking, connected, connecting, voiceError, handleSignal } =
    useDrawingVoice(drawingSession?.id, userId, true)

  useEffect(() => { voiceSignalHandlerRef.current = handleSignal }, [handleSignal])
// countdown ticker
useEffect(() => {
  if (!activeTimer) return
  const tick = () => {
    const remaining = Math.max(0, activeTimer.durationSeconds - Math.floor((Date.now() - activeTimer.startsAt) / 1000))
    setTimeLeft(remaining)
    if (remaining === 0) setActiveTimer(null)
  }
  tick()
  const id = setInterval(tick, 250)
  return () => clearInterval(id)
}, [activeTimer])
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && e.shiftKey) { e.preventDefault(); canvasApiRef.current?.redo() }
      else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); canvasApiRef.current?.undo() }
      else if (e.key.toLowerCase() === 'e' && !mod) setTool('eraser')
      else if (e.key.toLowerCase() === 'b' && !mod) setTool('pen')
      else if (e.key === 'Escape') { setTool('pen'); setPointing(false); setArmedReaction(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [])

  useEffect(() => () => { drawingTimersRef.current.forEach(clearTimeout) }, [])

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
    if (window.confirm("Clear the whole canvas for everyone? This can't be undone.")) canvasApiRef.current?.clear()
  }, [])
  // local wrappers, near the other handleX callbacks:
const handleStartTimer = useCallback((seconds) => {
  setActiveTimer(startTimer(seconds))
}, [startTimer])

const handleStartVote = useCallback((question, options) => {
  setActivePoll(startVote(question, options))
}, [startVote])

const handleCastVote = useCallback((optionId) => {
  if (!activePoll) return
  setActivePoll(prev => ({ ...prev, votes: { ...prev.votes, [userId]: optionId } }))
  castVote(activePoll.id, optionId)
}, [activePoll, castVote, userId])

  const handleAddSticky = useCallback(() => canvasApiRef.current?.createStickyNote(), [])
  const handleAddImageClick = useCallback(() => imageFileInputRef.current?.click(), [])

  const handleImageFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
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
  alert(err?.message || 'Could not add that image. Please try again.')
}
  }, [uploadObjectImage])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) { modalRef.current?.requestFullscreen?.().catch(() => {}); setIsFullscreen(true) }
    else { document.exitFullscreen?.(); setIsFullscreen(false) }
  }, [])
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Phase 3: Point and Reaction are mutually exclusive with each other
  // (both repurpose the pointer-down gesture) — arming one disarms the other.
  const handleTogglePoint = useCallback(() => {
    setArmedReaction(null)
    setPointing(v => !v)
  }, [])
  const handlePickReaction = useCallback((emoji) => {
    setPointing(false)
    setArmedReaction(emoji)
  }, [])

  const statusLabel = {
    connecting: 'Connecting…', reconnecting: 'Reconnecting…',
    offline: "You're offline — your drawing is saved locally and will sync when you reconnect.",
    connected: null,
  }[connectionStatus]

  const drawingNames = participants.filter(p => drawingUserIds.has(p.userId)).map(p => p.username).filter(Boolean)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(10,10,16,0.92)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div ref={modalRef} style={{ width: '100%', height: '100%', maxWidth: 1100, maxHeight: 800, background: '#0f0f1a', borderRadius: 20, border: '1px solid rgba(167,139,250,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'drawModalPop 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <style>{`@keyframes drawModalPop { from { opacity:0; transform: scale(0.97); } to { opacity:1; transform:none; } }`}</style>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>🎨 Draw Together</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!loading && participants.length === 0 && (
              <>
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>{inviteSent ? 'Invite sent ✓' : `Waiting for ${inviteeName || 'someone'} to join…`}</span>
                {onInvite && (
                  <button onClick={handleInvite} style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 20, color: '#c4b5fd', fontSize: 11, fontWeight: 700, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Invite {inviteeName || ''}
                  </button>
                )}
              </>
            )}
            {participants.map(p => (
              <div key={p.userId} title={p.username} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '3px 8px 3px 3px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{p.username}</span>
              </div>
            ))}
          </div>
        </div>

        {drawingNames.length > 0 && (
          <div style={{ margin: '6px 16px 0', fontSize: 11, fontWeight: 600, color: '#a5b4fc', textAlign: 'center' }}>
            {drawingNames.join(' & ')} {drawingNames.length === 1 ? 'is' : 'are'} drawing…
          </div>
        )}
{activeTimer && timeLeft > 0 && (
  <div style={{ margin: '6px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 13, fontWeight: 800, color: '#fbbf24' }}>
    <span>⏱️ {activeTimer.label || 'Timer'}</span>
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{timeLeft}s</span>
    {activeTimer.startedBy === userId && (
      <button onClick={() => { cancelTimer(activeTimer.id); setActiveTimer(null) }}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
        cancel
      </button>
    )}
  </div>
)}

{activePoll && (
  <div style={{ margin: '8px 16px 0', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 12, padding: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>🗳️ {activePoll.question}</div>
      <button onClick={() => setActivePoll(null)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>
        ✕
      </button>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {activePoll.options.map(opt => {
        const counts = Object.values(activePoll.votes)
        const voteCount = counts.filter(v => v === opt.id).length
        const total = counts.length || 1
        const pct = Math.round((voteCount / total) * 100)
        const mine = activePoll.votes[userId] === opt.id
        return (
          <button key={opt.id} onClick={() => handleCastVote(opt.id)} disabled={activePoll.ended}
            style={{ position: 'relative', textAlign: 'left', padding: '6px 10px', borderRadius: 8, border: `1px solid ${mine ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.1)'}`, background: 'rgba(255,255,255,0.04)', cursor: activePoll.ended ? 'default' : 'pointer', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'rgba(167,139,250,0.18)' }} />
            <span style={{ position: 'relative', fontSize: 12, fontWeight: 600, color: '#fff' }}>{opt.label} {voteCount > 0 && `— ${voteCount} (${pct}%)`}</span>
          </button>
        )
      })}
    </div>
    {activePoll.createdBy === userId && !activePoll.ended && (
      <button onClick={() => { endVote(activePoll.id); setActivePoll(prev => ({ ...prev, ended: true })) }}
        style={{ marginTop: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
        end vote
      </button>
    )}
    {activePoll.ended && (
      <div style={{ marginTop: 8, fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>Vote ended</div>
    )}
  </div>
)}
        {statusLabel && (
          <div style={{ margin: '8px 16px 0', fontSize: 11.5, fontWeight: 600, textAlign: 'center', color: connectionStatus === 'offline' ? '#fbbf24' : '#a5b4fc', background: connectionStatus === 'offline' ? 'rgba(251,191,36,0.08)' : 'rgba(102,126,234,0.08)', border: `1px solid ${connectionStatus === 'offline' ? 'rgba(251,191,36,0.25)' : 'rgba(102,126,234,0.2)'}`, borderRadius: 10, padding: '6px 10px' }}>
            {statusLabel}
          </div>
        )}

        <input ref={imageFileInputRef} type="file" accept="image/*" onChange={handleImageFileChange} style={{ display: 'none' }} />

        <DrawingToolbar
          tool={tool} onToolChange={setTool} color={color} onColorChange={setColor} size={size} onSizeChange={setSize}
          canUndo={canUndo} canRedo={canRedo}
          onUndo={() => canvasApiRef.current?.undo()} onRedo={() => canvasApiRef.current?.redo()}
          onClear={handleClear} onExport={handleExport}
          onAddSticky={handleAddSticky} onAddImage={handleAddImageClick}
          pointing={pointing} onTogglePoint={handleTogglePoint} onPickReaction={handlePickReaction}
          onSaveToChat={sendMessage ? handleSaveToChat : undefined}
          saving={saveState === 'saving'} saved={saveState === 'saved'}
          onStartTimer={handleStartTimer}
  onStartVote={handleStartVote}
          isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onClose={onClose}
        />

        <div style={{ flex: 1, minHeight: 0, padding: 14 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Opening canvas…</div>
          ) : (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <DrawingCanvas
                ref={canvasApiRef}
                tool={tool} color={color} size={size} opacity={opacity}
                userId={userId} participantUserIds={participants.map(p => p.userId)}
                onCanUndoChange={setCanUndo} onCanRedoChange={setCanRedo}
                onLocalStrokeStart={broadcastStrokeStart}
                onLocalStrokeUpdate={broadcastStrokeUpdate}
                onLocalStrokeEnd={broadcastStrokeEnd}
                onLocalUndo={broadcastUndo} onLocalRedo={broadcastRedo} onLocalClear={broadcastClear}
                onLocalCursorMove={broadcastCursor}
                onLocalObjectCreate={broadcastObjectCreated}
                onLocalObjectMoving={broadcastObjectMoving}
                onLocalObjectUpdate={broadcastObjectUpdated}
                onLocalObjectDelete={broadcastObjectDeleted}
                pointing={pointing}
                onLocalPointerMove={broadcastPointerMove}
                onLocalPointerOff={broadcastPointerOff}
                armedReaction={armedReaction}
                onReactionPlaced={() => setArmedReaction(null)}
                onLocalReaction={broadcastReaction}
                comments={comments}
                onAddComment={addComment}
                onResolveComment={resolveComment}
                onDeleteComment={deleteComment}
              />

              <button onClick={toggleMic} disabled={!connected}
                title={voiceError ? `Voice unavailable: ${voiceError}` : connecting ? 'Connecting voice…' : micOn ? 'Mute mic' : 'Talk to them'}
                style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 50, width: 48, height: 48, borderRadius: '50%', border: 'none',
                  cursor: connected ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: voiceError ? 'rgba(239,68,68,0.6)' : micOn ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'rgba(0,0,0,0.55)',
                  boxShadow: otherSpeaking ? '0 0 0 4px rgba(52,211,153,0.4)' : '0 4px 16px rgba(0,0,0,0.3)', opacity: connecting ? 0.5 : 1, transition: 'box-shadow 0.2s, opacity 0.2s' }}>
                <IconMic size={20} style={{ color: micOn ? '#fff' : 'rgba(255,255,255,0.7)' }} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
