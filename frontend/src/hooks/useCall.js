import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useCall(userId, conversationId) {
  const [callStatus, setCallStatus] = useState('idle')
  const [activeCall, setActiveCall] = useState(null)
  const [callToken, setCallToken]   = useState(null)
  const [callError, setCallError]   = useState(null)
  const callRef = useRef(null)

  useEffect(() => {
    if (!conversationId || !userId) return

    const channel = supabase
      .channel(`calls:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'active_calls',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const call = payload.new
        if (call.initiated_by === userId) return
        if (call.status !== 'ringing') return

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
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'active_calls',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const call = payload.new
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
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, userId])

  const startCall = useCallback(async (callType) => {
    if (!conversationId) return
    setCallStatus('calling')
    setCallError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        'https://bqerkvywgxoioocbkxif.supabase.co/functions/v1/create-call-room',
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
        id: '',
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

  const answerCall = useCallback(async () => {
    const call = callRef.current
    if (!call) return
    setCallStatus('connecting')

    try {
      await supabase
        .from('active_calls')
        .update({ status: 'answered' })
        .eq('id', call.id)

      setCallToken(null)
      setCallStatus('in-call')
    } catch (err) {
      setCallError(err.message)
      setCallStatus('idle')
    }
  }, [])

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

  return { callStatus, activeCall, callToken, callError, startCall, answerCall, declineCall, endCall }
}
