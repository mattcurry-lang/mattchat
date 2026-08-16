// hooks/useDrawingVoice.js
import { useState, useEffect, useRef, useCallback } from 'react'
import { getChannel } from '../lib/realtimeManager'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

// Simple volume-threshold speaking detector on a remote MediaStream —
// replaces Daily's built-in active-speaker-change event now that we
// own the peer connection ourselves.
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
  const THRESHOLD = 18 // tune if it feels too sensitive / not sensitive enough

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
 * Peer-to-peer voice over the drawing session's existing realtime
 * channel — no Daily.co, no billing dependency. Two participants,
 * direct WebRTC connection, STUN only.
 *
 * IMPORTANT: this hook does NOT call subscribeToChannel itself.
 * realtimeManager only ever runs the FIRST buildChannel registered
 * for a given channel key (see openChannel) — useDrawingSession
 * already owns `drawing:${sessionId}`, so a second .on() registration
 * here would silently never fire. Instead, useDrawingSession forwards
 * every `voice-signal` broadcast to the `onVoiceSignal` handler you
 * wire into it, and you feed those payloads into this hook via
 * `handleSignal`. Outgoing sends are fine as-is (getChannel().send()
 * doesn't need registration, only receiving does).
 *
 * Wiring in DrawingModal:
 *
 *   const voice = useDrawingVoice(session?.id, userId, voiceEnabled)
 *   const drawing = useDrawingSession(conversationId, userId, profile, {
 *     ...strokeHandlers,
 *     onVoiceSignal: voice.handleSignal,
 *   })
 */
export function useDrawingVoice(sessionId, userId, enabled) {
  const [micOn, setMicOn] = useState(false)
  const [otherSpeaking, setOtherSpeaking] = useState(false)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [voiceError, setVoiceError] = useState(null)

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const audioElRef = useRef(null)
  const stopSpeakingWatchRef = useRef(null)
  const channelKeyRef = useRef(null)
  const makingOfferRef = useRef(false)
  const politeRef = useRef(false) // set once we know the remote peer's id
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const send = useCallback((payload) => {
    const key = channelKeyRef.current
    if (!key) return
    getChannel(key)?.send({ type: 'broadcast', event: 'voice-signal', payload: { ...payload, userId } })
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // Start muted, matching the old startAudioOff: true behavior —
    // user has to explicitly toggle mic on.
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

    // Perfect-negotiation onnegotiationneeded, guarded by politeness
    // to avoid offer glare when both sides try to negotiate at once.
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

  /**
   * Feed a `voice-signal` broadcast payload here (from
   * useDrawingSession's onVoiceSignal handler). payload.userId is
   * already guaranteed to be the OTHER peer's id — useDrawingSession
   * filters out our own echoes before calling us.
   */
  const handleSignal = useCallback(async (payload) => {
    if (!enabledRef.current) return
    const { kind, userId: remoteUserId } = payload
    try {
      if (kind === 'join' || kind === 'join-ack') {
        const isNew = !pcRef.current
        await ensurePeer(remoteUserId)
        if (kind === 'join') send({ kind: 'join-ack' }) // let a late joiner discover us too
        if (isNew) setConnecting(true)
        return
      }
      if (kind === 'offer') {
        const pc = await ensurePeer(remoteUserId)
        const offerCollision = makingOfferRef.current || pc.signalingState !== 'stable'
        if (offerCollision && !politeRef.current) return // impolite peer ignores colliding offer
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
          // Benign in many cases (candidate arriving before remote
          // description is set) — don't surface as a hard error.
          console.warn('[useDrawingVoice] addIceCandidate failed:', err)
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
    channelKeyRef.current = `drawing:${sessionId}`
    setConnecting(true)
    setVoiceError(null)

    // Wait for useDrawingSession's channel to actually exist before
    // announcing — it may still be joining when this effect fires.
    const announce = () => {
      if (cancelled) return
      if (getChannel(channelKeyRef.current)) {
        send({ kind: 'join' })
      } else {
        setTimeout(announce, 250)
      }
    }
    announce()

    // If nobody answers, stop showing "connecting" after a grace
    // period rather than spinning forever.
    const aloneTimeout = setTimeout(() => {
      if (!cancelled && !pcRef.current) setConnecting(false)
    }, 4000)

    return () => {
      cancelled = true
      clearTimeout(aloneTimeout)
      send({ kind: 'leave' })
      teardownPeer()
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
      setConnecting(false)
      setMicOn(false)
    }
  }, [enabled, sessionId, userId, send, teardownPeer])

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !micOn
    stream.getAudioTracks().forEach(t => { t.enabled = next })
    setMicOn(next)
  }, [micOn])

  return { micOn, toggleMic, otherSpeaking, connected, connecting, voiceError, handleSignal }
}
