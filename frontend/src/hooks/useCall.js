import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

const FUNCTIONS_BASE = 'https://bqerkvywgxoioocbkxif.supabase.co/functions/v1'
const MISSED_CALL_TIMEOUT_MS = 30000

// Calls to verify_jwt=true edge functions occasionally fail with a bare
// 401 "Unauthorized" from Supabase's own gateway (not our function code) —
// this happens when the cached access_token is stale, e.g. the tab was
// backgrounded and the auto-refresh timer got throttled. Retrying once
// with a forcibly refreshed session clears it up almost every time.
async function fetchCallFn(path, body) {
  const { data: { session } } = await supabase.auth.getSession()
  let res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshed?.session?.access_token}` },
      body: JSON.stringify(body),
    })
  }
  return res.json()
}

export function useCall(userId, conversationId) {
  const [callStatus, setCallStatus] = useState('idle')
  const [activeCall, setActiveCall]   = useState(null)
  const [callToken, setCallToken]     = useState(null)
  const [callError, setCallError]     = useState(null)
  const callRef = useRef(null)
  const missedTimerRef = useRef(null)

  const clearMissedTimer = () => {
    if (missedTimerRef.current) {
      clearTimeout(missedTimerRef.current)
      missedTimerRef.current = null
    }
  }

  // Writes a call-outcome line into the conversation, WhatsApp-style.
  // status: 'completed' | 'missed' | 'declined'
  // durationSeconds: only meaningful for 'completed'
  //
  // IMPORTANT: sender_id must be the CURRENTLY LOGGED-IN user (userId),
  // not call.initiatedBy. RLS on `messages` requires sender_id = auth.uid(),
  // so when the person who did NOT start the call declines/ends it, an
  // insert using call.initiatedBy (someone else's id) gets silently
  // rejected and no bubble ever shows up. Using userId here means the
  // insert always succeeds, no matter which side of the call runs it.
  const logCallMessage = useCallback(async (call, status, durationSeconds = 0) => {
    if (!call?.conversationId) return
    const { error } = await supabase.from('messages').insert({
      conversation_id: call.conversationId,
      sender_id: userId,
      content: `call_log:${call.callType}:${status}:${durationSeconds}`,
      message_type: 'call_log',
    })
    if (error) console.error('logCallMessage insert failed:', error)
  }, [userId])

  // ── GLOBAL listener — catches incoming calls on ANY conversation ──
// ── GLOBAL listener — catches incoming calls on ANY conversation ──
  // Migrated onto the shared realtime manager: reconnects with backoff
  // automatically, and re-checks for a live incoming/active call on
  // resync so a dropped socket during ring-in can't silently eat the
  // call the way a bare supabase.channel() subscription would.
  const checkForActiveCall = useCallback(() => {
    if (!userId) return
     if (callRef.current) return
    supabase
      .from('active_calls')
      .select('id, conversation_id, room_url, room_name, call_type, initiated_by, status')
      .neq('initiated_by', userId)
      .in('status', ['ringing', 'answered'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data: call, error }) => {
        if (error || !call) return
        supabase
          .from('conversation_members')
          .select('user_id')
          .eq('conversation_id', call.conversation_id)
          .eq('user_id', userId)
          .single()
          .then(({ data, error: memberErr }) => {
            if (memberErr || !data) return
            if (callRef.current?.id === call.id) return // already tracking it

            const incoming = {
              id: call.id,
              conversationId: call.conversation_id,
              roomUrl: call.room_url,
              roomName: call.room_name,
              callType: call.call_type,
              initiatedBy: call.initiated_by,
              status: call.status,
            }
            callRef.current = incoming
            setActiveCall(incoming)
            setCallStatus(call.status === 'answered' ? 'connecting' : 'incoming')
          })
      })
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const handleInsert = (payload) => {
      console.log('[useCall] INSERT received:', payload.new.initiated_by, 'me:', userId
      const call = payload.new
      if (call.initiated_by === userId) return
      if (call.status !== 'ringing') return

      supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', call.conversation_id)
        .eq('user_id', userId)
        .single()
        .then(({ data, error }) => {
          if (error || !data) return

          const incoming = {
            id: call.id,
            conversationId: call.conversation_id,
            roomUrl: call.room_url,
            roomName: call.room_name,
            callType: call.call_type,
            initiatedBy: call.initiated_by,
            status: call.status,
          }
          callRef.current = incoming
          setActiveCall(incoming)
          setCallStatus('incoming')
        })
    }

    const handleUpdate = (payload) => {
      const call = payload.new
      if (!callRef.current) return
      if (call.id !== callRef.current.id) return

      if (call.status === 'answered') {
        clearMissedTimer()
        setCallStatus('connecting')
        return
      }

      if (call.status === 'ended' || call.status === 'declined' || call.status === 'missed') {
        clearMissedTimer()
        setCallStatus(call.status === 'missed' ? 'missed' : 'ended')
        setTimeout(() => {
          setCallStatus('idle')
          setActiveCall(null)
          setCallToken(null)
          callRef.current = null
        }, 2000)
      }
    }

    const unsubscribe = subscribeToChannel(
      `incoming-calls:${userId}`,
      (channel, emit) => channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'active_calls' }, (p) => emit('insert', p))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'active_calls' }, (p) => emit('update', p)),
      {
        onEvent: (type, payload) => {
          if (type === 'insert') handleInsert(payload)
          else if (type === 'update') handleUpdate(payload)
        },
        // A drop during ring-in is the one case that actually matters —
        // this re-checks the DB for anything ringing/answered we might
        // have missed while disconnected, instead of just leaving the
        // call unanswered on this device forever.
        onResync: checkForActiveCall,
      }
    )

    return unsubscribe
  }, [userId, checkForActiveCall])

  // ── Start a call ──────────────────────────────────────────────────
  // targetConversationId is optional — pass it when starting a call
  // from somewhere that isn't "inside" a conversation (e.g. the Calls
  // tab's New Call picker), so the call can begin without first
  // setting activeConvo and navigating the UI into that chat. When
  // omitted, falls back to the conversationId this hook was created
  // with (the normal in-chat call-button behavior).
  const startCall = useCallback(async (callType, targetConversationId) => {
    const targetId = targetConversationId || conversationId
    if (!targetId) return
    setCallStatus('calling')
    setCallError(null)

    try {
      const data = await fetchCallFn('create-call-room-ts', { conversationId: targetId, callType })
      if (!data.ok) throw new Error(data.error || 'Failed to start call')

      const call = {
        id: data.callId || '',
        conversationId: targetId,
        roomUrl: data.roomUrl,
        roomName: data.roomName,
        callType,
        initiatedBy: userId,
        status: 'ringing',
      }
      callRef.current = call
      setActiveCall(call)
      setCallToken(data.token)
      setCallStatus('ringing')

      clearMissedTimer()
      missedTimerRef.current = setTimeout(async () => {
        if (callRef.current?.id !== call.id) return

        if (call.id) {
          const { data: current } = await supabase
            .from('active_calls')
            .select('status')
            .eq('id', call.id)
            .single()

          if (current?.status === 'ringing') {
            await supabase
              .from('active_calls')
              .update({ status: 'missed', ended_at: new Date().toISOString() })
              .eq('id', call.id)
            await logCallMessage(call, 'missed', 0)
          }
        }

        setCallStatus('missed')
        setTimeout(() => {
          setCallStatus('idle')
          setActiveCall(null)
          setCallToken(null)
          callRef.current = null
        }, 2500)
      }, MISSED_CALL_TIMEOUT_MS)
    } catch (err) {
      setCallError(err.message)
      setCallStatus('idle')
    }
  }, [conversationId, userId, logCallMessage])

  // ── Answer an incoming call ───────────────────────────────────────
  const answerCall = useCallback(async () => {
    const call = callRef.current
    if (!call) return
    clearMissedTimer()
    setCallStatus('connecting')
    setCallError(null)

    try {
      const data = await fetchCallFn('get-call-token', { callId: call.id, roomName: call.roomName })
      if (!data.ok) throw new Error(data.error || 'Failed to get call token')

      if (call.id) {
        await supabase
          .from('active_calls')
          .update({ status: 'answered', answered_at: new Date().toISOString() })
          .eq('id', call.id)
      }

      setCallToken(data.token)
      setCallStatus('in-call')
    } catch (err) {
      setCallError(err.message)
      if (call?.id) {
        await supabase
          .from('active_calls')
          .update({ status: 'declined', ended_at: new Date().toISOString() })
          .eq('id', call.id)
      }
      setCallStatus('idle')
      setActiveCall(null)
      setCallToken(null)
      callRef.current = null
    }
  }, [])

  // ── Decline an incoming call ──────────────────────────────────────
  const declineCall = useCallback(async () => {
    clearMissedTimer()
    const call = callRef.current
    if (call?.id) {
      await supabase
        .from('active_calls')
        .update({ status: 'declined', ended_at: new Date().toISOString() })
        .eq('id', call.id)
      await logCallMessage(call, 'declined', 0)
    }
    setCallStatus('idle')
    setActiveCall(null)
    setCallToken(null)
    callRef.current = null
  }, [logCallMessage])

  // ── End an active call ────────────────────────────────────────────
  const endCall = useCallback(async () => {
    clearMissedTimer()
    const call = callRef.current
    if (call?.id) {
      const { data: current } = await supabase
        .from('active_calls')
        .select('answered_at')
        .eq('id', call.id)
        .single()

      const wasAnswered = !!current?.answered_at
      const duration = wasAnswered
        ? Math.max(0, Math.round((Date.now() - new Date(current.answered_at).getTime()) / 1000))
        : 0

      await supabase
        .from('active_calls')
        .update({ status: 'ended', ended_at: new Date().toISOString(), duration_seconds: duration })
        .eq('id', call.id)

      if (wasAnswered) {
        // Call connected and was hung up normally.
        await logCallMessage(call, 'completed', duration)
      } else if (current) {
        // Caller cancelled before anyone answered (and before the 30s
        // missed-call timeout fired). Previously this logged nothing —
        // log it as missed so it's not silently dropped.
        await logCallMessage(call, 'missed', 0)
      }
    }
    setCallStatus('ended')
    setTimeout(() => {
      setCallStatus('idle')
      setActiveCall(null)
      setCallToken(null)
      callRef.current = null
    }, 2000)
  }, [logCallMessage])

  useEffect(() => clearMissedTimer, [])

  return { callStatus, activeCall, callToken, callError, startCall, answerCall, declineCall, endCall }
}
