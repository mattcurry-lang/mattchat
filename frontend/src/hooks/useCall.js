import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useCall(userId, conversationId) {
  const [callStatus, setCallStatus] = useState('idle')
  const [activeCall, setActiveCall]   = useState(null)
  const [callToken, setCallToken]     = useState(null)
  const [callError, setCallError]     = useState(null)
  const callRef = useRef(null)

  // ── GLOBAL listener — catches incoming calls on ANY conversation ──
  // This runs regardless of which chat is open
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
        // Ignore calls we initiated
        if (call.initiated_by === userId) return
        if (call.status !== 'ringing') return

        // Only ring if this call is in a conversation we're a member of
        supabase
          .from('conversation_members')
          .select('id')
          .eq('conversation_id', call.conversation_id)
          .eq('user_id', userId)
          .single()
          .then(({ data }) => {
            if (!data) return // not our conversation

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
        // Only handle updates for our current active call
        if (!callRef.current) return
        if (call.id !== callRef.current.id) return

        if (call.status === 'ended' || call.status === 'declined') {
          setCallStatus('ended')
          setTimeout(() => {
            setCallStatus('idle')
            setActiveCall(null)
            setCallToken(null)
            callRef.current = null
          }, 2000)
        }
      })
      .subscribe((status) => {
        console.log('useCall global subscription:', status)
      })

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ── Start a call ──────────────────────────────────────────────────
  const startCall = useCallback(async (callType) => {
    if (!conversationId) return
    setCallStatus('calling')
    setCallError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        'https://bqerkvywgxoioocbkxif.supabase.co/functions/v1/create-call-room-ts',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ conversationId, callType }),
        }
      )
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
      setCallStatus('connecting')
    } catch (err) {
      setCallError(err.message)
      setCallStatus('idle')
    }
  }, [conversationId, userId])

  // ── Answer an incoming call ───────────────────────────────────────
  const answerCall = useCallback(async () => {
    const call = callRef.current
    if (!call) return
    setCallStatus('connecting')

    try {
      if (call.id) {
        await supabase
          .from('active_calls')
          .update({ status: 'answered' })
          .eq('id', call.id)
      }
      setCallToken(null)
      setCallStatus('in-call')
    } catch (err) {
      setCallError(err.message)
      setCallStatus('idle')
    }
  }, [])

  // ── Decline an incoming call ──────────────────────────────────────
  const declineCall = useCallback(async () => {
    const call = callRef.current
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
  }, [])

  // ── End an active call ────────────────────────────────────────────
  const endCall = useCallback(async () => {
    const call = callRef.current
    if (call?.id) {
      await supabase
        .from('active_calls')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', call.id)
    }
    setCallStatus('ended')
    setTimeout(() => {
      setCallStatus('idle')
      setActiveCall(null)
      setCallToken(null)
      callRef.current = null
    }, 2000)
  }, [])

  return {
    callStatus,
    activeCall,
    callToken,
    callError,
    startCall,
    answerCall,
    declineCall,
    endCall,
  }
}
