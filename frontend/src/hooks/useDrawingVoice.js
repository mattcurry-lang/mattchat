// hooks/useDrawingVoice.js
import { useState, useEffect, useRef, useCallback } from 'react'
import { subscribeToChannel, getChannel } from '../lib/realtimeManager'

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
 * channel (`drawing:${sessionId}`), used purely as a signaling
 * transport for WebRTC offer/answer/ICE — no Daily.co, no billing
 * dependency. Two participants, direct connection.
 *
 * NOTE: signature changed from the Daily version — this needs
 * `sessionId` (not `conversationId`) because signaling has to ride
 * the same channel useDrawingSession already opened, and that
 * channel is keyed by session id.
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
  const remoteUserIdRef = useRef(null)
  const makingOfferRef = useRef(false)
  const polite = useRef(false) // set once we know the remote peer's id

  const send = useCallback((event, payload) => {
    const key = channelKeyRef.current
    if (!key) return
    getChannel(key)?.send({ type: 'broadcast', event, payload: { ...payload, userId } })
  }, [userId])

  const teardownPeer = useCallback(() => {
    stopSpeakingWatchRef.current?.()
    stopSpeakingWatchRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    if (audioElRef.current) {
      audioElRef.current.srcObject = null
      audioElRef.current.remove()
      audioElRef.current = null
    }
    remoteUserIdRef.current = null
    setConnected(false)
    setOtherSpeaking(false)
  }, [])

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.onicecandidate = (e) => {
      if (e.candidate) send('voice-ice-candidate', { candidate: e.candidate })
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
        send('voice-offer', { description: pc.localDescription })
      } catch (err) {
        setVoiceError(err.message || 'Voice negotiation failed')
      } finally {
        makingOfferRef.current = false
      }
    }

    return pc
  }, [send])

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // Start muted, matching the old startAudioOff: true behavior —
    // user has to explicitly toggle mic on.
    stream.getAudioTracks().forEach(t => { t.enabled = false })
    localStreamRef.current = stream
    return stream
  }, [])

  useEffect(() => {
    if (!enabled || !sessionId || !userId) return
    let cancelled = false
    const channelKey = `drawing:${sessionId}`
    channelKeyRef.current = channelKey
    setConnecting(true)
    setVoiceError(null)

    const handleRemotePeer = async (remoteUserId) => {
      if (cancelled || remoteUserId === userId) return
      // Deterministic initiator/polite-peer assignment so both sides
      // agree on who offers first without a race.
      polite.current = userId > remoteUserId
      remoteUserIdRef.current = remoteUserId
      if (!pcRef.current) {
        try {
          const stream = await ensureLocalStream()
          if (cancelled) return
          const pc = createPeerConnection()
          pcRef.current = pc
          stream.getTracks().forEach(track => pc.addTrack(track, stream))
        } catch (err) {
          setVoiceError(err.message || 'Could not access microphone')
          setConnecting(false)
        }
      }
    }

    const buildChannel = (channel) => channel
      .on('broadcast', { event: 'voice-join' }, ({ payload }) => {
        if (payload.userId === userId) return
        handleRemotePeer(payload.userId)
        // Answer back so a late joiner also learns about us even if
        // they missed our own voice-join.
        send('voice-join-ack', {})
      })
      .on('broadcast', { event: 'voice-join-ack' }, ({ payload }) => {
        if (payload.userId === userId) return
        handleRemotePeer(payload.userId)
      })
      .on('broadcast', { event: 'voice-offer' }, async ({ payload }) => {
        if (payload.userId === userId) return
        await handleRemotePeer(payload.userId)
        const pc = pcRef.current
        if (!pc) return
        try {
          const offerCollision = makingOfferRef.current || pc.signalingState !== 'stable'
          if (offerCollision && !polite.current) return // impolite peer ignores colliding offer
          await pc.setRemoteDescription(payload.description)
          await pc.setLocalDescription()
          send('voice-answer', { description: pc.localDescription })
        } catch (err) {
          setVoiceError(err.message || 'Voice negotiation failed')
        }
      })
      .on('broadcast', { event: 'voice-answer' }, async ({ payload }) => {
        if (payload.userId === userId) return
        const pc = pcRef.current
        if (!pc) return
        try {
          await pc.setRemoteDescription(payload.description)
        } catch (err) {
          setVoiceError(err.message || 'Voice negotiation failed')
        }
      })
      .on('broadcast', { event: 'voice-ice-candidate' }, async ({ payload }) => {
        if (payload.userId === userId) return
        const pc = pcRef.current
        if (!pc) return
        try {
          await pc.addIceCandidate(payload.candidate)
        } catch (err) {
          // Benign in many cases (candidate arriving before remote
          // description is set) — don't surface as a hard error.
          console.warn('[useDrawingVoice] addIceCandidate failed:', err)
        }
      })
      .on('broadcast', { event: 'voice-leave' }, ({ payload }) => {
        if (payload.userId === userId) return
        teardownPeer()
        setConnecting(false)
      })

    const unsubscribe = subscribeToChannel(channelKey, buildChannel, {
      onResync: () => {
        // Peer connection survives a realtime resync; nothing to redo
        // here beyond re-announcing so a peer who also resynced can
        // re-discover us if their state got cleared.
        send('voice-join', {})
      },
    })

    // Announce ourselves; if nobody answers we just sit connecting
    // until a peer shows up (or the user leaves the canvas).
    send('voice-join', {})

    // If we're alone, stop showing "connecting" after a short grace
    // period rather than spinning forever.
    const aloneTimeout = setTimeout(() => {
      if (!cancelled && !pcRef.current) setConnecting(false)
    }, 4000)

    return () => {
      cancelled = true
      clearTimeout(aloneTimeout)
      send('voice-leave', {})
      unsubscribe()
      teardownPeer()
      setConnecting(false)
    }
  }, [enabled, sessionId, userId, createPeerConnection, ensureLocalStream, send, teardownPeer])

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !micOn
    stream.getAudioTracks().forEach(t => { t.enabled = next })
    setMicOn(next)
  }, [micOn])

  return { micOn, toggleMic, otherSpeaking, connected, connecting, voiceError }
}
