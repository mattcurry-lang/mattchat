import React, { useEffect, useRef, useState } from 'react'
import DailyIframe from '@daily-co/daily-js'
import { IconMic, IconBluetooth, IconVideo, IconUser } from './Icons'

export default function CallOverlay({ roomUrl, token, callType, callerName, startMuted = false, onEnd }) {
  const callContainerRef = useRef(null)
  const callFrameRef     = useRef(null)
  const [muted, setMuted]         = useState(startMuted)
  const [camOff, setCamOff]       = useState(callType === 'audio')
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

      <div style={{ ...styles.audioUI, opacity: callType === 'audio' || !connected ? 1 : 0, pointerEvents: callType === 'audio' || !connected ? 'auto' : 'none' }}>
        <div style={styles.avatar}>{callerName.charAt(0).toUpperCase()}</div>
        <div style={styles.callerName}>{callerName}</div>
        <div style={styles.callStatus}>{connected ? fmt(duration) : 'Connecting…'}</div>

        {!connected && (
          <div style={styles.rings}>
            <div style={{ ...styles.ring, animationDelay: '0s' }} />
            <div style={{ ...styles.ring, animationDelay: '0.4s' }} />
            <div style={{ ...styles.ring, animationDelay: '0.8s' }} />
          </div>
        )}
      </div>

      <div style={styles.controls}>
        <button style={styles.smallBtn} disabled title="Add people — coming soon">
          <IconUser size={20} />
        </button>

        <button style={{ ...styles.controlBtn, ...(muted ? styles.controlBtnActive : {}) }} onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
          <IconMic size={22} style={muted ? { opacity: 0.5 } : undefined} />
        </button>

        {callType === 'video' && (
          <button style={{ ...styles.controlBtn, ...(camOff ? styles.controlBtnActive : {}) }} onClick={toggleCamera} title={camOff ? 'Turn camera on' : 'Turn camera off'}>
            <IconVideo size={22} style={camOff ? { opacity: 0.5 } : undefined} />
          </button>
        )}

        <button style={styles.smallBtn} onClick={toggleBluetooth} title="Audio output">
          <IconBluetooth size={20} />
        </button>

        <button style={styles.endBtn} onClick={handleEnd} title="End call">📵</button>
      </div>

      <style>{`@keyframes ring-pulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.2); opacity: 0; } }`}</style>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bg: { position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #1b0f2e 0%, #05060f 100%)', zIndex: 0 },
  iframeWrap: { position: 'absolute', inset: 0, zIndex: 1, transition: 'opacity 0.4s' },
  audioUI: { position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, transition: 'opacity 0.4s' },
  avatar: {
    width: 100, height: 100, borderRadius: '50%',
    background: 'linear-gradient(135deg, #7c3aed, #db2777)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 40, fontWeight: 700, color: '#fff', marginBottom: 8,
    boxShadow: '0 0 0 4px rgba(124,58,237,0.3)',
  },
  callerName: { fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' },
  callStatus: { fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' },
  rings: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', marginTop: -80 },
  ring: {
    position: 'absolute', width: 100, height: 100, borderRadius: '50%',
    border: '2px solid rgba(124,58,237,0.4)', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)', animation: 'ring-pulse 1.6s ease-out infinite',
  },
  controls: { position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 16, zIndex: 10 },
  smallBtn: {
    width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)',
  },
  controlBtn: {
    width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 22, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', backdropFilter: 'blur(8px)',
  },
  controlBtnActive: { background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(239,68,68,0.5)' },
  endBtn: {
    width: 64, height: 64, borderRadius: '50%', background: '#ef4444', border: 'none', fontSize: 26, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(239,68,68,0.5)',
  },
}
