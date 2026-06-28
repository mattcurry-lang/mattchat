import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type CallStatus =
  | 'idle'
  | 'calling'       // we initiated, waiting for answer
  | 'incoming'      // someone is calling us
  | 'connecting'    // answered, Daily connecting
  | 'in-call'
  | 'ended'

export interface ActiveCall {
  id: string
  conversationId: string
  roomUrl: string
  roomName: string
  token?: string
  callType: 'audio' | 'video'
  initiatedBy: string
  status: string
}

export function useCall(userId: string, conversationId: string | null) {
  const [callStatus, setCallStatus]   = useState<CallStatus>('idle')
  const [activeCall, setActiveCall]   = useState<ActiveCall | null>(null)
  const [callToken, setCallToken]     = useState<string | null>(null)
  const [callError, setCallError]     = useState<string | null>(null)
  const callRef = useRef<ActiveCall | null>(null)

  // Subscribe to incoming calls for this conversation
  useEffect(() => {
    if (!conversationId || !userId) return

    const channel = supabase
      .channel(`calls:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'active_calls',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const call = payload.new as any
          // Don't notify ourselves of our own call
          if (call.initiated_by === userId) return
          if (call.status !== 'ringing') return

          const incoming: ActiveCall = {
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
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_calls',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const call = payload.new as any
          if (call.status === 'ended' || call.status === 'declined') {
            setCallStatus('ended')
            setTimeout(() => {
              setCallStatus('idle')
              setActiveCall(null)
              setCallToken(null)
              callRef.current = null
            }, 2000)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, userId])

  // Initiate a call
  const startCall = useCallback(async (callType: 'audio' | 'video') => {
    if (!conversationId) return
    setCallStatus('calling')
    setCallError(null)

    try {
      const session = await supabase.auth.getSession()
      const res = await fetch(
        'https://bqerkvywgxoioocbkxif.supabase.co/functions/v1/create-call-room',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({ conversationId, callType }),
        }
      )
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to start call')

      const call: ActiveCall = {
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
    } catch (err: any) {
      setCallError(err.message)
      setCallStatus('idle')
    }
  }, [conversationId, userId])

  // Answer an incoming call
  const answerCall = useCallback(async () => {
    const call = callRef.current
    if (!call) return
    setCallStatus('connecting')

    try {
      // Update status to answered
      await supabase
        .from('active_calls')
        .update({ status: 'answered' })
        .eq('id', call.id)

      // Get a token for the joiner
      const session = await supabase.auth.getSession()
      const res = await fetch('https://api.daily.co/v1/meeting-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({
          properties: {
            room_name: call.roomName,
            user_name: userId,
            exp: Math.floor(Date.now() / 1000) + 3600,
          },
        }),
      })

      // If direct token fetch fails (CORS), we join without token
      // Daily allows joining public rooms without a token
      const tokenData = await res.json().catch(() => ({ token: null }))
      setCallToken(tokenData.token || null)
      setCallStatus('in-call')
    } catch (err: any) {
      setCallError(err.message)
      setCallStatus('idle')
    }
  }, [userId])

  // Decline an incoming call
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

  // End an active call
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
