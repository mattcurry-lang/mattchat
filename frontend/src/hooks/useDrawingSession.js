import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel, getChannel } from '../lib/realtimeManager'
import { colorForUser } from '../components/Drawing/drawingEngine'

const CURSOR_THROTTLE_MS = 45
const POINTER_THROTTLE_MS = 45

export function useDrawingSession(conversationId, userId, profile, handlers = {}) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [participants, setParticipants] = useState([])
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const lastCursorSentRef = useRef(0)
  const lastPointerSentRef = useRef(0)
  const channelKeyRef = useRef(null)
  const myColor = colorForUser(userId)

  useEffect(() => {
    if (!conversationId) { setSession(null); setLoading(false); return }
    let cancelled = false
    setLoading(true)

    const run = async () => {
      const { data: existing } = await supabase
        .from('drawing_sessions').select('*')
        .eq('conversation_id', conversationId).eq('status', 'active').maybeSingle()
      if (cancelled) return
      if (existing) { setSession(existing); setLoading(false); return }

      const { data: created, error } = await supabase
        .from('drawing_sessions').insert({ conversation_id: conversationId, created_by: userId })
        .select().single()
      if (cancelled) return
      if (error) {
        const { data: retry } = await supabase
          .from('drawing_sessions').select('*')
          .eq('conversation_id', conversationId).eq('status', 'active').maybeSingle()
        setSession(retry || null)
      } else {
        setSession(created)
      }
      setLoading(false)
    }
    run()
    return () => { cancelled = true }
  }, [conversationId, userId])

  const loadStrokes = useCallback(async () => {
    if (!session?.id) return
    const { data } = await supabase.from('drawing_strokes').select('*')
      .eq('session_id', session.id).order('created_at', { ascending: true })
    const strokes = (data || []).map(row => ({
      id: row.client_stroke_id, userId: row.user_id, tool: row.tool, color: row.color,
      size: row.size, opacity: row.opacity, points: row.points,
      textContent: row.text_content, deleted: row.deleted,
    }))
    handlersRef.current.onInitialStrokes?.(strokes)
  }, [session?.id])

  const loadObjects = useCallback(async () => {
    if (!session?.id) return
    const { data } = await supabase.from('canvas_objects').select('*')
      .eq('session_id', session.id).order('created_at', { ascending: true })
    const objects = (data || []).map(row => ({
      id: row.client_object_id, userId: row.user_id, type: row.type, data: row.data,
      x: row.x, y: row.y, width: row.width, height: row.height,
      rotation: row.rotation, zIndex: row.z_index, deleted: row.deleted,
    }))
    handlersRef.current.onInitialObjects?.(objects)
  }, [session?.id])

  // Comments grouped by object_id, keyed to client_object_id — same
  // key space canvas_objects already round-trips on.
  const loadComments = useCallback(async () => {
    if (!session?.id) return
    const { data } = await supabase.from('canvas_object_comments').select('*')
      .eq('session_id', session.id).order('created_at', { ascending: true })
    const byObject = {}
    for (const row of data || []) {
      if (!byObject[row.object_id]) byObject[row.object_id] = []
      byObject[row.object_id].push({
        id: row.id, objectId: row.object_id, userId: row.user_id,
        text: row.text, resolved: row.resolved, createdAt: row.created_at,
      })
    }
    handlersRef.current.onInitialComments?.(byObject)
  }, [session?.id])

  useEffect(() => { loadStrokes() }, [loadStrokes])
  useEffect(() => { loadObjects() }, [loadObjects])
  useEffect(() => { loadComments() }, [loadComments])

  useEffect(() => {
    if (!session?.id) return
    const channelKey = `drawing:${session.id}`
    channelKeyRef.current = channelKey
    setConnectionStatus('connecting')

    const buildChannel = (channel) => channel
      .on('broadcast', { event: 'stroke_start' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteStrokeStart?.(payload) })
      .on('broadcast', { event: 'stroke_update' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteStrokeUpdate?.(payload) })
      .on('broadcast', { event: 'stroke_end' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteStrokeEnd?.(payload) })
      .on('broadcast', { event: 'undo' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteUndo?.(payload) })
      .on('broadcast', { event: 'redo' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteRedo?.(payload) })
      .on('broadcast', { event: 'clear' }, ({ payload }) => { handlersRef.current.onRemoteClear?.(payload) })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteCursor?.(payload) })
      .on('broadcast', { event: 'object_created' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteObjectCreated?.(payload) })
      .on('broadcast', { event: 'object_moving' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteObjectMoving?.(payload) })
      .on('broadcast', { event: 'object_updated' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteObjectUpdated?.(payload) })
      .on('broadcast', { event: 'object_deleted' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteObjectDeleted?.(payload) })
      
  .on('broadcast', { event: 'vote_start' }, ({ payload }) => { handlersRef.current.onRemoteVoteStart?.(payload) })
  .on('broadcast', { event: 'vote_cast' }, ({ payload }) => { handlersRef.current.onRemoteVoteCast?.(payload) })
  .on('broadcast', { event: 'vote_end' }, ({ payload }) => { handlersRef.current.onRemoteVoteEnd?.(payload) })
  .on('broadcast', { event: 'timer_start' }, ({ payload }) => { handlersRef.current.onRemoteTimerStart?.(payload) })
  .on('broadcast', { event: 'timer_cancel' }, ({ payload }) => { handlersRef.current.onRemoteTimerCancel?.(payload) })
  .on('broadcast', { event: 'game_start' }, ({ payload }) => { handlersRef.current.onRemoteGameStart?.(payload) })
  .on('broadcast', { event: 'game_guess' }, ({ payload }) => { handlersRef.current.onRemoteGameGuess?.(payload) })
  .on('broadcast', { event: 'game_reveal' }, ({ payload }) => { handlersRef.current.onRemoteGameReveal?.(payload) })
  .on('broadcast', { event: 'game_end' }, ({ payload }) => { handlersRef.current.onRemoteGameEnd?.(payload) })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteReaction?.(payload) })
      .on('broadcast', { event: 'pointer' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemotePointer?.(payload) })
      .on('broadcast', { event: 'pointer_off' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemotePointerOff?.(payload) })
      .on('broadcast', { event: 'comment_created' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteCommentCreated?.(payload) })
      .on('broadcast', { event: 'comment_resolved' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteCommentResolved?.(payload) })
      .on('broadcast', { event: 'comment_deleted' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onRemoteCommentDeleted?.(payload) })
       .on('broadcast', { event: 'game_move' }, ({ payload }) => { handlersRef.current.onRemoteGameMove?.(payload) })
      .on('broadcast', { event: 'voice-signal' }, ({ payload }) => { if (payload.userId !== userId) handlersRef.current.onVoiceSignal?.(payload) })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const list = Object.values(state).flat().map((p) => ({ userId: p.userId, username: p.username, avatarUrl: p.avatarUrl, color: p.color }))
        const byId = new Map()
        list.forEach(p => byId.set(p.userId, p))
        setParticipants(Array.from(byId.values()))
      })

    const track = () => {
      const ch = getChannel(channelKey)
      if (ch && ch.state === 'joined') {
        ch.track({ userId, username: profile?.username || 'Someone', avatarUrl: profile?.avatar_url || null, color: myColor })
        setConnectionStatus('connected')
      } else {
        setTimeout(track, 250)
      }
    }

    const unsubscribe = subscribeToChannel(channelKey, buildChannel, {
      onResync: () => {
        setConnectionStatus('reconnecting')
        loadStrokes(); loadObjects(); loadComments()
        track()
      },
    })
    track()

    return () => { getChannel(channelKey)?.untrack?.(); unsubscribe() }
  }, [session?.id, userId, profile?.username, profile?.avatar_url, myColor, loadStrokes, loadObjects, loadComments])

  useEffect(() => {
    const goOffline = () => setConnectionStatus('offline')
    const goOnline = () => setConnectionStatus('reconnecting')
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline) }
  }, [])

  const send = useCallback((event, payload) => {
    const key = channelKeyRef.current
    if (!key) return
    getChannel(key)?.send({ type: 'broadcast', event, payload })
  }, [])

  const broadcastStrokeStart = useCallback((stroke) => { send('stroke_start', { ...stroke, userId }) }, [send, userId])
  const broadcastStrokeUpdate = useCallback((strokeId, newPoints) => { send('stroke_update', { strokeId, newPoints, userId }) }, [send, userId])
  const broadcastStrokeEnd = useCallback(async (stroke) => {
    send('stroke_end', { ...stroke, userId })
    if (!session?.id) return
    const { error } = await supabase.from('drawing_strokes').insert({
      client_stroke_id: stroke.id, session_id: session.id, user_id: userId,
      tool: stroke.tool, color: stroke.color, size: stroke.size, opacity: stroke.opacity,
      points: stroke.points, text_content: stroke.textContent || null, deleted: false,
    })
    if (error) console.error('[useDrawingSession] persist stroke failed:', error)
  }, [send, session?.id, userId])
  const broadcastUndo = useCallback(async (strokeId) => {
    send('undo', { strokeId, userId })
    await supabase.from('drawing_strokes').update({ deleted: true }).eq('client_stroke_id', strokeId).eq('user_id', userId)
  }, [send, userId])
  const broadcastRedo = useCallback(async (strokeId) => {
    send('redo', { strokeId, userId })
    await supabase.from('drawing_strokes').update({ deleted: false }).eq('client_stroke_id', strokeId).eq('user_id', userId)
  }, [send, userId])
  const broadcastClear = useCallback(async () => {
    send('clear', { userId })
    if (session?.id) await supabase.from('drawing_strokes').delete().eq('session_id', session.id)
  }, [send, session?.id, userId])
  const broadcastCursor = useCallback((x, y) => {
    const now = Date.now()
    if (now - lastCursorSentRef.current < CURSOR_THROTTLE_MS) return
    lastCursorSentRef.current = now
    send('cursor', { x, y, userId })
  }, [send, userId])

  const broadcastObjectCreated = useCallback(async (object) => {
    send('object_created', { ...object, userId })
    if (!session?.id) return
    const { error } = await supabase.from('canvas_objects').insert({
      client_object_id: object.id, session_id: session.id, user_id: userId,
      type: object.type, data: object.data, x: object.x, y: object.y,
      width: object.width, height: object.height, rotation: object.rotation || 0,
      z_index: object.zIndex || 0, deleted: false,
    })
    if (error) console.error('[useDrawingSession] persist object failed:', error)
  }, [send, session?.id, userId])
  const broadcastObjectMoving = useCallback((objectId, patch) => { send('object_moving', { objectId, patch, userId }) }, [send, userId])
  const broadcastObjectUpdated = useCallback(async (objectId, patch) => {
    send('object_updated', { objectId, patch, userId })
    const dbPatch = {}
    if ('x' in patch) dbPatch.x = patch.x
    if ('y' in patch) dbPatch.y = patch.y
    if ('width' in patch) dbPatch.width = patch.width
    if ('height' in patch) dbPatch.height = patch.height
    if ('rotation' in patch) dbPatch.rotation = patch.rotation
    if ('data' in patch) dbPatch.data = patch.data
    if ('zIndex' in patch) dbPatch.z_index = patch.zIndex
    dbPatch.updated_at = new Date().toISOString()
    const { error } = await supabase.from('canvas_objects').update(dbPatch).eq('client_object_id', objectId)
    if (error) console.error('[useDrawingSession] persist object update failed:', error)
  }, [send, userId])
  const broadcastObjectDeleted = useCallback(async (objectId) => {
    send('object_deleted', { objectId, userId })
    await supabase.from('canvas_objects').update({ deleted: true }).eq('client_object_id', objectId)
  }, [send, userId])

  const uploadObjectImage = useCallback(async (file) => {
  const safeName = (file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${conversationId}/objects/${Date.now()}-${safeName}`
  const { error: uploadError } = await supabase.storage
    .from('drawing-media')
    .upload(path, file, { contentType: file.type || 'image/png', upsert: false })
  if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`)
  const { data } = supabase.storage.from('drawing-media').getPublicUrl(path)
  return data.publicUrl
}, [conversationId])

 const saveToChat = useCallback(async (dataUrl, sendMessageFn) => {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const path = `${conversationId}/${Date.now()}.png`
  const { error: uploadError } = await supabase.storage.from('drawing-media')
    .upload(path, blob, { contentType: 'image/png', upsert: false })
  if (uploadError) throw new Error(`Save to chat failed: ${uploadError.message}`)
  const { data } = supabase.storage.from('drawing-media').getPublicUrl(path)
  const names = Array.from(new Set(
    [profile?.username, ...participants.map(p => p.username)].filter(Boolean)
  ))
  const label = names.length ? names.join(' & ') : 'Someone'
  await sendMessageFn(`drawing:${data.publicUrl}::${label}`)
  return data.publicUrl
}, [conversationId, participants, profile?.username])

  // ── Phase 3: reactions (ephemeral, no table) ──
  const broadcastReaction = useCallback((emoji, x, y) => {
    send('reaction', { emoji, x, y, userId, username: profile?.username || 'Someone' })
  }, [send, userId, profile?.username])

  // ── Phase 3: live pointer (ephemeral, no table) ──
  const broadcastPointerMove = useCallback((x, y) => {
    const now = Date.now()
    if (now - lastPointerSentRef.current < POINTER_THROTTLE_MS) return
    lastPointerSentRef.current = now
    send('pointer', { x, y, userId, username: profile?.username || 'Someone', color: myColor })
  }, [send, userId, profile?.username, myColor])
  const broadcastPointerOff = useCallback(() => { send('pointer_off', { userId }) }, [send, userId])

  // ── Phase 3: comments (persisted) ──
  const addComment = useCallback(async (objectId, text) => {
    if (!session?.id || !text.trim()) return
    const { data, error } = await supabase.from('canvas_object_comments').insert({
      session_id: session.id, object_id: objectId, user_id: userId, text: text.trim(),
    }).select().single()
    if (error) { console.error('[useDrawingSession] add comment failed:', error); return }
    const comment = { id: data.id, objectId: data.object_id, userId: data.user_id, text: data.text, resolved: data.resolved, createdAt: data.created_at }
    send('comment_created', { ...comment, userId })
    return comment
  }, [session?.id, userId, send])

  const resolveComment = useCallback(async (commentId, objectId) => {
    await supabase.from('canvas_object_comments').update({ resolved: true }).eq('id', commentId)
    send('comment_resolved', { commentId, objectId, userId })
  }, [send, userId])

  const deleteComment = useCallback(async (commentId, objectId) => {
    await supabase.from('canvas_object_comments').delete().eq('id', commentId)
    send('comment_deleted', { commentId, objectId, userId })
  }, [send, userId])
  // add near the other broadcast* functions, before the return statement:

const startVote = useCallback((question, optionLabels) => {
  const poll = {
    id: `${userId}-${Date.now()}`, question,
    options: optionLabels.map((label, i) => ({ id: `opt-${i}`, label })),
    votes: {}, createdBy: userId,
  }
  send('vote_start', poll)
  return poll
}, [send, userId])

const castVote = useCallback((pollId, optionId) => {
  send('vote_cast', { pollId, optionId, userId })
}, [send, userId])

const endVote = useCallback((pollId) => {
  send('vote_end', { pollId, userId })
}, [send, userId])

const startTimer = useCallback((durationSeconds, label) => {
  const timer = { id: `${userId}-${Date.now()}`, durationSeconds, label, startsAt: Date.now(), startedBy: userId }
  send('timer_start', timer)
  return timer
}, [send, userId])
// add near the other broadcast* functions, before the return statement:

// `word` is deliberately NOT part of `publicPayload` — it never
// leaves this device for Pictionary rounds. The caller keeps it in
// its own local state as the "I already know this" source of truth.
const startGame = useCallback((gameConfig) => {
  const game = {
    id: `${userId}-${Date.now()}`,
    type: gameConfig.type,          // 'pictionary' | 'secret_drawing'
    prompt: gameConfig.type === 'secret_drawing' ? gameConfig.prompt : undefined,
    drawerId: gameConfig.type === 'pictionary' ? userId : undefined,
    startedBy: userId,
    phase: 'active',
  }
  send('game_start', game)
  return game
}, [send, userId])

const sendGuess = useCallback((gameId, text) => {
  send('game_guess', { gameId, userId, username: profile?.username || 'Someone', text })
}, [send, userId, profile?.username])

const revealGame = useCallback((gameId) => {
  send('game_reveal', { gameId })
}, [send])

const endGame = useCallback((gameId) => {
  send('game_end', { gameId, userId })
}, [send, userId])
const cancelTimer = useCallback((timerId) => {
  send('timer_cancel', { timerId, userId })
}, [send, userId])
const sendGameMove = useCallback((gameId, move) => {
  send('game_move', { gameId, userId, move })
}, [send, userId])
  return {
    session, loading, connectionStatus, participants, myColor,
    broadcastStrokeStart, broadcastStrokeUpdate, broadcastStrokeEnd,
    broadcastUndo, broadcastRedo, broadcastClear, broadcastCursor,
    broadcastObjectCreated, broadcastObjectMoving, broadcastObjectUpdated, broadcastObjectDeleted,
    uploadObjectImage, saveToChat,
    broadcastReaction, broadcastPointerMove, broadcastPointerOff,startGame, sendGuess, revealGame, endGame,
    addComment, resolveComment, deleteComment,startVote, castVote, endVote, startTimer, cancelTimer, sendGameMove,
  }
}
