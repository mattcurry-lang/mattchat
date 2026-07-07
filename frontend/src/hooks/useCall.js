import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const FUNCTIONS_BASE = 'https://bqerkvywgxoioocbkxif.supabase.co/functions/v1'
const MISSED_CALL_TIMEOUT_MS = 30000

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
  const logCallMessage = useCallback(async (call, status, durationSeconds = 0) => {
    if (!call?.conversationId) return
    await supabase.from('messages').insert({
      conversation_id: call.conversationId,
      sender_id: call.initiatedBy,
      content: `call_log:${call.callType}:${status}:${durationSeconds}`,
      message_type: 'call_log',
    })
  }, [])

  // ── GLOBAL listener — catches incoming calls on ANY conversation ──
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`incoming-calls:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'active_calls',
      }, (payload) => {
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
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'active_calls',
      }, (payload) => {
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
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ── Start a call ──────────────────────────────────────────────────
  const startCall = useCallback(async (callType) => {
    if (!conversationId) return
    setCallStatus('calling')
    setCallError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${FUNCTIONS_BASE}/create-call-room-ts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ conversationId, callType }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to start call')

      const call = {
        id: data.callId || '',
        conversationId,
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
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${FUNCTIONS_BASE}/get-call-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ callId: call.id, roomName: call.roomName }),
      })
      const data = await res.json()
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

      // Only log a "completed" bubble if the call actually connected;
      // if nobody answered before endCall fired, the missed-call
      // timeout path already handles that message instead.
      if (wasAnswered) {
        await logCallMessage(call, 'completed', duration)
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
