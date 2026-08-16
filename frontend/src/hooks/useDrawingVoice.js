// hooks/useDrawingVoice.js
import { useState, useEffect, useRef, useCallback } from 'react'
import DailyIframe from '@daily-co/daily-js'
import { supabase } from '../lib/supabase'

const FUNCTIONS_BASE = 'https://bqerkvywgxoioocbkxif.supabase.co/functions/v1'

export function useDrawingVoice(conversationId, enabled) {
  const [micOn, setMicOn] = useState(false)
  const [otherSpeaking, setOtherSpeaking] = useState(false)
  const [connected, setConnected] = useState(false)
  const callRef = useRef(null)

  useEffect(() => {
    if (!enabled || !conversationId) return
    let cancelled = false

    const join = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${FUNCTIONS_BASE}/create-drawing-voice-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ conversationId }),
      })
      const data = await res.json()
      if (cancelled || !data.ok) return

      const call = DailyIframe.createCallObject({ audioSource: true, videoSource: false })
      callRef.current = call

      call.on('active-speaker-change', (e) => {
        setOtherSpeaking(e.activeSpeaker?.peerId !== call.participants().local?.session_id)
      })
      call.on('left-meeting', () => setConnected(false))

      await call.join({ url: data.roomUrl, token: data.token, startVideoOff: true, startAudioOff: true })
      if (cancelled) { call.leave(); return }
      setConnected(true)
    }

    join()
    return () => {
      cancelled = true
      callRef.current?.leave()
      callRef.current?.destroy()
      callRef.current = null
      setConnected(false)
      setMicOn(false)
    }
  }, [enabled, conversationId])

  const toggleMic = useCallback(() => {
    const call = callRef.current
    if (!call) return
    const next = !micOn
    call.setLocalAudio(next)
    setMicOn(next)
  }, [micOn])

  return { micOn, toggleMic, otherSpeaking, connected }
}
