import React, { useEffect, useRef, useState } from 'react'
import DailyIframe from '@daily-co/daily-js'
import { IconMic, IconBluetooth, IconVideo, IconPause, IconUserPlus, IconKeypad } from './Icons'

export default function CallOverlay({ roomUrl, token, callType, callerName, startMuted = false, onEnd }) {
  const callContainerRef = useRef(null)
  const callFrameRef     = useRef(null)
  const [muted, setMuted]         = useState(startMuted)
  const [camOff, setCamOff]       = useState(callType === 'audio')
  const [onHold, setOnHold]       = useState(false)
  const [duration, setDuration]   = useState(0)
  const [connected, setConnected] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!callContainerRef.current) return

    const frame = DailyIframe.createFrame(callContainerRef.current, {
      iframeStyle: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', borderRadius: '0' },
      showLeaveButton: false,
      showFullscreenButton: false,
      showLocalVideo: callType === 'video',
      showParticipantsBar: false,
    })

    callFrameRef.current = frame

    frame.on('joined-meeting', () => {
      setConnected(true)
      if (startMuted) frame.setLocalAudio(false)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    })

    frame.on('left-meeting', () => { onEnd() })
    frame.on('error', () => { onEnd() })

    const joinOpts = { url: roomUrl, startVideoOff: callType === 'audio', startAudioOff: startMuted }
    if (token) joinOpts.token = token
    frame.join(joinOpts)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      frame.destroy()
    }
  }, [])

  const toggleMute = () => {
    callFrameRef.current?.setLocalAudio(muted)
    setMuted(m => !m)
  }

  const toggleCamera = () => {
    if (callType === 'audio') return
    callFrameRef.current?.setLocalVideo(camOff)
    setCamOff(c => !c)
  }

  // Hold = mute both mic and camera locally without leaving the room.
  // The other person keeps their connection alive; they just can't
  // hear or see you until you take the call off hold again.
  const toggleHold = () => {
    const next = !onHold
    setOnHold(next)
    callFrameRef.current?.setLocalAudio(!next && !muted)
    if (callType === 'video') callFrameRef.current?.setLocalVideo(!next && !camOff)
  }

  const toggleBluetooth = async () => {
    if (!navigator.mediaDevices?.selectAudioOutput) {
      alert("Choosing an audio output device isn't supported in this browser — your system default will be used.")
      return
    }
    try {
      const device = await navigator.mediaDevices.selectAudioOutput()
      await callFrameRef.current?.setOutputDeviceAsync?.({ outputDeviceId: device.deviceId })
    } catch (e) { /* user cancelled the picker */ }
  }

  const handleEnd = () => {
    callFrameRef.current?.leave()
    onEnd()
  }

  const fmt = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.bg} />

      <div
        ref={callContainerRef}
        style={{ ...styles.iframeWrap, opacity: callType === 'video' && connected ? 1 : 0, pointerEvents: callType === 'video' ? 'auto' : 'none' }}
      />

      <div style={{ ...styles.topInfo, opacity: callType === 'audio' || !connected ? 1 : 0 }}>
        <div style={styles.statusLabel}>{onHold ? 'On hold' : connected ? fmt(duration) : 'Connecting…'}</div>
        <div style={styles.callerName}>{callerName}</div>
      </div>

      <div style={{ ...styles.audioUI, opacity: callType === 'audio' || !connected ? 1 : 0, pointerEvents: callType === 'audio' || !connected ? 'auto' : 'none' }}>
        <div style={styles.ringGlow}>
          <div style={{ ...styles.ring, animationDelay: '0s' }} />
          <div style={{ ...styles.ring, animationDelay: '0.5s' }} />
          <div style={styles.avatar}>{callerName.charAt(0).toUpperCase()}</div>
        </div>
      </div>

      {/* ── icon grid: add person / hold / bluetooth, mute / end call / keypad ── */}
      <div style={styles.controls}>
        <div style={styles.controlRow}>
          <button style={styles.smallBtn} disabled title="Add people — coming soon">
            <IconUserPlus size={20} />
          </button>
          <button style={{ ...styles.smallBtn, ...(onHold ? styles.smallBtnActive : {}) }} onClick={toggleHold} title={onHold ? 'Resume' : 'Hold'}>
            <IconPause size={20} />
          </button>
          <button style={styles.smallBtn} onClick={toggleBluetooth} title="Audio output">
            <IconBluetooth size={20} />
          </button>
        </div>

        <div style={styles.controlRow}>
          <button style={{ ...styles.smallBtn, ...(muted ? styles.smallBtnActive : {}) }} onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
            <IconMic size={20} style={muted ? { opacity: 0.5 } : undefined} />
          </button>
          <button style={styles.endBtn} onClick={handleEnd} title="End call">📵</button>
          <button style={styles.smallBtn} disabled title="Keypad — coming soon">
            <IconKeypad size={20} />
          </button>
        </div>

        {callType === 'video' && (
          <button style={{ ...styles.camToggle, ...(camOff ? styles.smallBtnActive : {}) }} onClick={toggleCamera} title={camOff ? 'Turn camera on' : 'Turn camera off'}>
            <IconVideo size={18} style={camOff ? { opacity: 0.5 } : undefined} />
          </button>
        )}
      </div>

      <style>{`@keyframes ring-pulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.9); opacity: 0; } }`}</style>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', padding: '56px 0 60px' },
  bg: { position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #1b0f2e 0%, #05060f 100%)', zIndex: 0 },
  iframeWrap: { position: 'absolute', inset: 0, zIndex: 1, transition: 'opacity 0.4s' },

  topInfo: { position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'opacity 0.4s' },
  statusLabel: { fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: 600 },
  callerName: { fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' },

  audioUI: { position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.4s' },
  ringGlow: { position: 'relative', width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute', width: 180, height: 180, borderRadius: '50%',
    border: '2px solid rgba(124,58,237,0.35)', animation: 'ring-pulse 2s ease-out infinite',
  },
  avatar: {
    width: 150, height: 150, borderRadius: '50%',
    background: 'linear-gradient(135deg, #7c3aed, #db2777)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 56, fontWeight: 700, color: '#fff', zIndex: 1,
    boxShadow: '0 0 40px rgba(124,58,237,0.45)',
  },

  controls: { position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 },
  controlRow: { display: 'flex', alignItems: 'center', gap: 22 },
  smallBtn: {
    width: 58, height: 58, borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)',
  },
  smallBtnActive: { background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5' },
  endBtn: {
    width: 66, height: 66, borderRadius: '50%', background: '#ef4444', border: 'none', fontSize: 26, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(239,68,68,0.5)',
  },
  camToggle: {
    width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
}
