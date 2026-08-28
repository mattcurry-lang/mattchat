// hooks/useWatchVoice.js
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

// Simple volume-threshold speaking detector on a remote MediaStream —
// same approach as useDrawingVoice's watchSpeaking.
function watchSpeaking(stream, onChange) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const src = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  analyser.smoothingTimeConstant = 0.6
  src.connect(analyser)
  const data = new Uint8Array(analyser.frequencyBinCount)
  let speaking = false
  let raf
  const THRESHOLD = 18

  const tick = () => {
    analyser.getByteFrequencyData(data)
    const avg = data.reduce((a, b) => a + b, 0) / data.length
    const isSpeaking = avg > THRESHOLD
    if (isSpeaking !== speaking) {
      speaking = isSpeaking
      onChange(speaking)
    }
    raf = requestAnimationFrame(tick)
  }
  tick()

  return () => {
    cancelAnimationFrame(raf)
    src.disconnect()
    analyser.disconnect()
    ctx.close().catch(() => {})
  }
}

/**
 * Peer-to-peer voice for a Watch Together session — no Daily.co, no
 * billing dependency. Two participants, direct WebRTC connection,
 * STUN only. Same shape as useDrawingVoice, but — unlike drawing,
 * where useDrawingSession already owns the realtime channel and
 * realtimeManager only lets one hook register .on() per channel key
 * — Watch Together's chat channel is created directly via
 * supabase.channel() in useWatchTogether, not through realtimeManager.
 * So this hook is free to own its own dedicated signaling channel
 * (`watch-voice:${sessionId}`) rather than needing a forwarded
 * onVoiceSignal handler threaded through another hook.
 *
 * Wiring in WatchTogetherPlayer:
 *
 *   const voice = useWatchVoice(watchSession?.id, currentUserId, !mini)
 *   <button onClick={voice.toggleMic}>...</button>
 */
export function useWatchVoice(sessionId, userId, enabled) {
  const [micOn, setMicOn] = useState(false)
  const [otherSpeaking, setOtherSpeaking] = useState(false)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [voiceError, setVoiceError] = useState(null)

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const audioElRef = useRef(null)
  const stopSpeakingWatchRef = useRef(null)
  const channelRef = useRef(null)
  const makingOfferRef = useRef(false)
  const politeRef = useRef(false)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const send = useCallback((payload) => {
    channelRef.current?.send({ type: 'broadcast', event: 'voice-signal', payload: { ...payload, userId } })
  }, [userId])

  const teardownPeer = useCallback(() => {
    stopSpeakingWatchRef.current?.()
    stopSpeakingWatchRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    if (audioElRef.current) {
      audioElRef.current.srcObject = null
      audioElRef.current.remove()
      audioElRef.current = null
    }
    setConnected(false)
    setOtherSpeaking(false)
  }, [])

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    // Start muted — matches Draw Together's behavior; user has to
    // explicitly toggle mic on.
    stream.getAudioTracks().forEach(t => { t.enabled = false })
    localStreamRef.current = stream
    return stream
  }, [])

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.onicecandidate = (e) => {
      if (e.candidate) send({ kind: 'ice-candidate', candidate: e.candidate })
    }

    pc.ontrack = (e) => {
      const [remoteStream] = e.streams
      const audioEl = new Audio()
      audioEl.srcObject = remoteStream
      audioEl.autoplay = true
      audioElRef.current = audioEl
      stopSpeakingWatchRef.current = watchSpeaking(remoteStream, setOtherSpeaking)
      setConnected(true)
      setConnecting(false)
    }

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        setConnected(false)
      }
    }

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true
        await pc.setLocalDescription()
        send({ kind: 'offer', description: pc.localDescription })
      } catch (err) {
        setVoiceError(err.message || 'Voice negotiation failed')
      } finally {
        makingOfferRef.current = false
      }
    }

    return pc
  }, [send])

  const ensurePeer = useCallback(async (remoteUserId) => {
    if (pcRef.current) return pcRef.current
    politeRef.current = userId > remoteUserId
    const stream = await ensureLocalStream()
    const pc = createPeerConnection()
    pcRef.current = pc
    stream.getTracks().forEach(track => pc.addTrack(track, stream))
    return pc
  }, [userId, ensureLocalStream, createPeerConnection])

  const handleSignal = useCallback(async (payload) => {
    if (!enabledRef.current) return
    const { kind, userId: remoteUserId } = payload
    try {
      if (kind === 'join' || kind === 'join-ack') {
        const isNew = !pcRef.current
        await ensurePeer(remoteUserId)
        if (kind === 'join') send({ kind: 'join-ack' })
        if (isNew) setConnecting(true)
        return
      }
      if (kind === 'offer') {
        const pc = await ensurePeer(remoteUserId)
        const offerCollision = makingOfferRef.current || pc.signalingState !== 'stable'
        if (offerCollision && !politeRef.current) return
        await pc.setRemoteDescription(payload.description)
        await pc.setLocalDescription()
        send({ kind: 'answer', description: pc.localDescription })
        return
      }
      if (kind === 'answer') {
        await pcRef.current?.setRemoteDescription(payload.description)
        return
      }
      if (kind === 'ice-candidate') {
        try {
          await pcRef.current?.addIceCandidate(payload.candidate)
        } catch (err) {
          console.warn('[useWatchVoice] addIceCandidate failed:', err)
        }
        return
      }
      if (kind === 'leave') {
        teardownPeer()
        setConnecting(false)
        return
      }
    } catch (err) {
      setVoiceError(err.message || 'Voice negotiation failed')
    }
  }, [ensurePeer, send, teardownPeer])

  useEffect(() => {
    if (!enabled || !sessionId || !userId) return
    let cancelled = false
    setConnecting(true)
    setVoiceError(null)

    const channel = supabase.channel(`watch-voice:${sessionId}`)
    channel
      .on('broadcast', { event: 'voice-signal' }, ({ payload }) => {
        if (payload.userId === userId) return // ignore our own echo
        handleSignal(payload)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && !cancelled) send({ kind: 'join' })
      })
    channelRef.current = channel

    // If nobody answers, stop showing "connecting" after a grace period.
    const aloneTimeout = setTimeout(() => {
      if (!cancelled && !pcRef.current) setConnecting(false)
    }, 4000)

    return () => {
      cancelled = true
      clearTimeout(aloneTimeout)
      send({ kind: 'leave' })
      channel.unsubscribe()
      channelRef.current = null
      teardownPeer()
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
      setConnecting(false)
      setMicOn(false)
    }
  }, [enabled, sessionId, userId, send, teardownPeer, handleSignal])

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !micOn
    stream.getAudioTracks().forEach(t => { t.enabled = next })
    setMicOn(next)
  }, [micOn])

  return { micOn, toggleMic, otherSpeaking, connected, connecting, voiceError }
}
