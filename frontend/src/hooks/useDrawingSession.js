import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel, getChannel } from '../lib/realtimeManager'
import { colorForUser } from '../components/Drawing/drawingEngine'

const CURSOR_THROTTLE_MS = 45

/**
 * One shared drawing session per conversation, on one realtime channel
 * (`drawing:${sessionId}`) carrying both broadcast (strokes, cursors)
 * and presence (who's here) — matching the single-channel-per-topic
 * pattern realtimeManager.js already enforces everywhere else.
 *
 * `handlers` are remote-event callbacks the caller (DrawingModal) wires
 * straight into the canvas's imperative ref methods, so this hook never
 * needs to know anything about canvas internals — it only speaks in
 * stroke/cursor payloads.
 */
export function useDrawingSession(conversationId, userId, profile, handlers = {}) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('connecting') // connecting | connected | reconnecting | offline
  const [participants, setParticipants] = useState([]) // [{userId, username, avatarUrl, color}]
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const lastCursorSentRef = useRef(0)
  const channelKeyRef = useRef(null)
  const myColor = colorForUser(userId)

  // ── Find or create the conversation's single active session ──
  useEffect(() => {
    if (!conversationId) { setSession(null); setLoading(false); return }
    let cancelled = false
    setLoading(true)

    const run = async () => {
      const { data: existing } = await supabase
        .from('drawing_sessions')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('status', 'active')
        .maybeSingle()

      if (cancelled) return
      if (existing) { setSession(existing); setLoading(false); return }

      const { data: created, error } = await supabase
        .from('drawing_sessions')
        .insert({ conversation_id: conversationId, created_by: userId })
        .select()
        .single()

      if (cancelled) return
      if (error) {
        // Race: the other person opened the canvas in the same instant
        // and the unique-active-per-conversation index rejected ours —
        // just re-fetch theirs instead of erroring out.
        const { data: retry } = await supabase
          .from('drawing_sessions')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('status', 'active')
          .maybeSingle()
        setSession(retry || null)
      } else {
        setSession(created)
      }
      setLoading(false)
    }

    run()
    return () => { cancelled = true }
  }, [conversationId, userId])

  // ── Load persisted strokes whenever we (re)connect to a session ──
 const loadStrokes = useCallback(async () => {
    if (!session?.id) return
    const { data } = await supabase
      .from('drawing_strokes')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
    const strokes = (data || []).map(row => ({
      id: row.client_stroke_id, userId: row.user_id, tool: row.tool, color: row.color,
      size: row.size, opacity: row.opacity, points: row.points,
      textContent: row.text_content, deleted: row.deleted,
    }))
    handlersRef.current.onInitialStrokes?.(strokes)
  }, [session?.id])

  useEffect(() => { loadStrokes() }, [loadStrokes])

  // ── Realtime: one channel per session, broadcast + presence together ──
  useEffect(() => {
    if (!session?.id) return
    const channelKey = `drawing:${session.id}`
    channelKeyRef.current = channelKey
    setConnectionStatus('connecting')

    const buildChannel = (channel) => channel
      .on('broadcast', { event: 'stroke_start' }, ({ payload }) => {
        if (payload.userId !== userId) handlersRef.current.onRemoteStrokeStart?.(payload)
      })
      .on('broadcast', { event: 'stroke_update' }, ({ payload }) => {
        if (payload.userId !== userId) handlersRef.current.onRemoteStrokeUpdate?.(payload)
      })
      .on('broadcast', { event: 'stroke_end' }, ({ payload }) => {
        if (payload.userId !== userId) handlersRef.current.onRemoteStrokeEnd?.(payload)
      })
      .on('broadcast', { event: 'undo' }, ({ payload }) => {
        if (payload.userId !== userId) handlersRef.current.onRemoteUndo?.(payload)
      })
      .on('broadcast', { event: 'redo' }, ({ payload }) => {
        if (payload.userId !== userId) handlersRef.current.onRemoteRedo?.(payload)
      })
      .on('broadcast', { event: 'clear' }, ({ payload }) => {
        handlersRef.current.onRemoteClear?.(payload)
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        if (payload.userId !== userId) handlersRef.current.onRemoteCursor?.(payload)
      })
      // Voice (WebRTC) signaling rides this same channel. Only one
      // buildChannel per channel key ever actually runs (see
      // realtimeManager's openChannel), so useDrawingVoice can't
      // register its own .on() handlers here — it hands us a single
      // callback instead and we forward every voice-signal broadcast
      // to it, kind-tagged, and let it sort out offer/answer/ice/etc.
      .on('broadcast', { event: 'voice-signal' }, ({ payload }) => {
        if (payload.userId !== userId) handlersRef.current.onVoiceSignal?.(payload)
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const list = Object.values(state).flat().map((p) => ({
          userId: p.userId, username: p.username, avatarUrl: p.avatarUrl, color: p.color,
        }))
        // De-dupe by userId — the same person open in two tabs shouldn't
        // render as two separate participants.
        const byId = new Map()
        list.forEach(p => byId.set(p.userId, p))
        setParticipants(Array.from(byId.values()))
      })

    // Presence tracking needs the channel to have actually joined —
    // realtimeManager doesn't expose a "just subscribed" callback to
    // callers, so poll briefly for channel.state === 'joined' rather
    // than adding a new capability to the shared manager for this one
    // caller (smallest safe change per the app's own architecture notes).
    const track = () => {
      const ch = getChannel(channelKey)
      if (ch && ch.state === 'joined') {
        ch.track({
          userId, username: profile?.username || 'Someone',
          avatarUrl: profile?.avatar_url || null, color: myColor,
        })
        setConnectionStatus('connected')
      } else {
        setTimeout(track, 250)
      }
    }

    const unsubscribe = subscribeToChannel(channelKey, buildChannel, {
      onResync: () => {
        setConnectionStatus('reconnecting')
        loadStrokes()   // resync any strokes we missed while disconnected
        track()          // presence resets on reconnect — retrack
      },
    })

    track()

    return () => {
      getChannel(channelKey)?.untrack?.()
      unsubscribe()
    }
  }, [session?.id, userId, profile?.username, profile?.avatar_url, myColor, loadStrokes])

  // ── Browser online/offline awareness (spec sections 9 & 21) ──
  useEffect(() => {
    const goOffline = () => setConnectionStatus('offline')
    const goOnline = () => setConnectionStatus('reconnecting')
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  const send = useCallback((event, payload) => {
    const key = channelKeyRef.current
    if (!key) return
    getChannel(key)?.send({ type: 'broadcast', event, payload })
  }, [])

  const broadcastStrokeStart = useCallback((stroke) => {
    send('stroke_start', { ...stroke, userId })
  }, [send, userId])

  const broadcastStrokeUpdate = useCallback((strokeId, newPoints) => {
    send('stroke_update', { strokeId, newPoints, userId })
  }, [send, userId])

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

  // ── Save to Chat: uploads the exported PNG, sends a `drawing:` message ──
  const saveToChat = useCallback(async (dataUrl, sendMessageFn) => {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const path = `${conversationId}/${Date.now()}.png`
    const { error: uploadError } = await supabase.storage
      .from('drawing-media')
      .upload(path, blob, { contentType: 'image/png', upsert: false })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('drawing-media').getPublicUrl(path)
    const names = participants.map(p => p.username).filter(Boolean)
    const label = names.length ? names.join(' & ') : 'Someone'
    await sendMessageFn(`drawing:${data.publicUrl}::${label}`)
    return data.publicUrl
  }, [conversationId, participants])

  return {
    session, loading, connectionStatus, participants, myColor,
    broadcastStrokeStart, broadcastStrokeUpdate, broadcastStrokeEnd,
    broadcastUndo, broadcastRedo, broadcastClear, broadcastCursor,
    saveToChat,
  }
}
