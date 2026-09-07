import React, { useEffect, useRef, useState } from 'react'
import DailyIframe from '@daily-co/daily-js'
import { IconMic, IconBluetooth, IconVideo, IconPause, IconUserPlus, IconKeypad, IconPhoneOff, IconMinimize2 } from './Icons'

export default function CallOverlay({ roomUrl, token, callType, callerName, startMuted = false, onEnd }) {
  const callContainerRef = useRef(null)
  const callFrameRef     = useRef(null)
  const [muted, setMuted]         = useState(startMuted)
  const [camOff, setCamOff]       = useState(callType === 'audio')
  const [onHold, setOnHold]       = useState(false)
  const [duration, setDuration]   = useState(0)
  const [connected, setConnected] = useState(false)
  const [networkQuality, setNetworkQuality] = useState('good') // 'good' | 'low' | 'very-low'
  const [minimized, setMinimized] = useState(false)
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

    // Real Daily.js event — surfaces actual connection quality rather
    // than faking a signal-strength indicator with no data behind it.
    frame.on('network-quality-change', (ev) => {
      setNetworkQuality(ev?.threshold || 'good')
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

  const toggleMute = () => { callFrameRef.current?.setLocalAudio(muted); setMuted(m => !m) }
  const toggleCamera = () => {
    if (callType === 'audio') return
    callFrameRef.current?.setLocalVideo(camOff)
    setCamOff(c => !c)
  }
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
  const handleEnd = () => { callFrameRef.current?.leave(); onEnd() }
  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const qualityColor = { good: '#34d399', low: '#fbbf24', 'very-low': '#ef4444' }[networkQuality] || '#34d399'
  const qualityLabel = { good: 'STABLE', low: 'WEAK SIGNAL', 'very-low': 'POOR CONNECTION' }[networkQuality] || 'STABLE'

  // Minimized: shrinks to a small draggable-feeling floating pill so a
  // call can keep running while someone browses the rest of the app —
  // a real capability gap the blank overlay didn't have at all.
  if (minimized) {
    return (
      <div style={styles.miniPill} onClick={() => setMinimized(false)}>
        <div style={styles.miniAvatar}>{callerName.charAt(0).toUpperCase()}</div>
        <div style={styles.miniInfo}>
          <div style={styles.miniName}>{callerName}</div>
          <div style={styles.miniDuration}>{onHold ? 'On hold' : fmt(duration)}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleEnd() }}
          style={styles.miniEndBtn}
          aria-label="End call"
        >
          <IconPhoneOff size={15} />
        </button>
      </div>
    )
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.bg} />
      <div style={styles.scanlines} />
      <div style={{ ...styles.gridGlow, opacity: connected ? 0.5 : 0.2 }} />

      <div
        ref={callContainerRef}
        style={{ ...styles.iframeWrap, opacity: callType === 'video' && connected ? 1 : 0, pointerEvents: callType === 'video' ? 'auto' : 'none' }}
      />

      <div style={styles.topBar}>
        <button onClick={() => setMinimized(true)} style={styles.minimizeBtn} aria-label="Minimize call">
          <IconMinimize2 size={16} />
        </button>
        <div style={{ ...styles.qualityBadge, borderColor: `${qualityColor}55`, color: qualityColor }}>
          <span style={{ ...styles.qualityDot, background: qualityColor, boxShadow: `0 0 6px ${qualityColor}` }} />
          {qualityLabel}
        </div>
      </div>

      <div style={{ ...styles.topInfo, opacity: callType === 'audio' || !connected ? 1 : 0 }}>
        <div style={styles.statusLabel}>{onHold ? 'ON HOLD' : connected ? fmt(duration) : 'CONNECTING…'}</div>
        <div style={styles.callerName}>{callerName}</div>
      </div>

      <div style={{ ...styles.audioUI, opacity: callType === 'audio' || !connected ? 1 : 0, pointerEvents: callType === 'audio' || !connected ? 'auto' : 'none' }}>
        <div style={styles.ringGlow}>
          <div style={{ ...styles.ring, animationDelay: '0s' }} />
          <div style={{ ...styles.ring, animationDelay: '0.5s' }} />
          <div style={styles.orbit}><span style={styles.orbitDot} /></div>
          <div style={styles.avatar}>{callerName.charAt(0).toUpperCase()}</div>
        </div>
        {connected && !onHold && (
          <div style={styles.waveBars} aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} style={{ ...styles.waveBar, animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}
      </div>

      <div style={styles.controls}>
        <div style={styles.controlRow}>
          <button style={styles.smallBtn} disabled title="Add people — coming soon" aria-label="Add people — coming soon">
            <IconUserPlus size={20} />
          </button>
          <button style={{ ...styles.smallBtn, ...(onHold ? styles.smallBtnActive : {}) }} onClick={toggleHold} title={onHold ? 'Resume' : 'Hold'} aria-label={onHold ? 'Resume call' : 'Hold call'}>
            <IconPause size={20} />
          </button>
          <button style={styles.smallBtn} onClick={toggleBluetooth} title="Audio output" aria-label="Choose audio output device">
            <IconBluetooth size={20} />
          </button>
        </div>

        <div style={styles.controlRow}>
          <button style={{ ...styles.smallBtn, ...(muted ? styles.smallBtnActive : {}) }} onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>
            <IconMic size={20} style={muted ? { opacity: 0.5 } : undefined} />
          </button>
          <button style={styles.endBtn} onClick={handleEnd} title="End call" aria-label="End call">
            <IconPhoneOff size={26} />
          </button>
          <button style={styles.smallBtn} disabled title="Keypad — coming soon" aria-label="Keypad — coming soon">
            <IconKeypad size={20} />
          </button>
        </div>

        {callType === 'video' && (
          <button style={{ ...styles.camToggle, ...(camOff ? styles.smallBtnActive : {}) }} onClick={toggleCamera} title={camOff ? 'Turn camera on' : 'Turn camera off'} aria-label={camOff ? 'Turn camera on' : 'Turn camera off'}>
            <IconVideo size={18} style={camOff ? { opacity: 0.5 } : undefined} />
          </button>
        )}
      </div>

      <style>{`
        @keyframes ring-pulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.9); opacity: 0; } }
        @keyframes co-orbit { to { transform: rotate(360deg); } }
        @keyframes co-wave { 0%, 100% { height: 6px; } 50% { height: 26px; } }
        @keyframes co-grid-drift { 0% { background-position: 0 0; } 100% { background-position: 60px 60px; } }
      `}</style>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', padding: '56px 0 60px', fontFamily: "'Inter', system-ui, sans-serif" },
  bg: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 15%, #241f3d 0%, #0a0912 60%, #050408 100%)', zIndex: 0 },
  scanlines: { position: 'absolute', inset: 0, zIndex: 0, opacity: 0.04, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(180deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)' },
  gridGlow: {
    position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', transition: 'opacity 0.6s ease',
    backgroundImage: 'linear-gradient(rgba(139,127,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(139,127,255,0.08) 1px, transparent 1px)',
    backgroundSize: '60px 60px', animation: 'co-grid-drift 18s linear infinite',
  },
  iframeWrap: { position: 'absolute', inset: 0, zIndex: 1, transition: 'opacity 0.4s' },

  topBar: { position: 'relative', zIndex: 3, display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 20px' },
  minimizeBtn: { width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qualityBadge: { display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: '5px 10px', borderRadius: 20, border: '1px solid', background: 'rgba(0,0,0,0.25)' },
  qualityDot: { width: 5, height: 5, borderRadius: '50%' },

  topInfo: { position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'opacity 0.4s' },
  statusLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 600, letterSpacing: 1 },
  callerName: { fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' },

  audioUI: { position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, transition: 'opacity 0.4s' },
  ringGlow: { position: 'relative', width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 180, height: 180, borderRadius: '50%', border: '2px solid rgba(108,99,255,0.35)', animation: 'ring-pulse 2s ease-out infinite' },
  orbit: { position: 'absolute', width: 150, height: 150, borderRadius: '50%', border: '1px dashed rgba(199,125,255,0.3)', animation: 'co-orbit 10s linear infinite' },
  orbitDot: { position: 'absolute', top: -3, left: '50%', width: 6, height: 6, borderRadius: '50%', background: '#c77dff', boxShadow: '0 0 10px #c77dff', transform: 'translateX(-50%)' },
  avatar: { width: 150, height: 150, borderRadius: '50%', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, fontWeight: 700, color: '#fff', zIndex: 1, boxShadow: '0 0 40px rgba(108,99,255,0.45)' },
  waveBars: { display: 'flex', alignItems: 'flex-end', gap: 4, height: 26 },
  waveBar: { width: 3, height: 6, borderRadius: 2, background: 'linear-gradient(180deg, #c77dff, #6c63ff)', animation: 'co-wave 1.1s ease-in-out infinite' },

  controls: { position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 },
  controlRow: { display: 'flex', alignItems: 'center', gap: 22 },
  smallBtn: { width: 58, height: 58, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' },
  smallBtnActive: { background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5' },
  endBtn: { width: 66, height: 66, borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(239,68,68,0.5)', color: '#fff' },
  camToggle: { width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  miniPill: {
    position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 14px 8px 8px', borderRadius: 40, cursor: 'pointer',
    background: 'rgba(20,18,30,0.92)', border: '1px solid rgba(139,127,255,0.35)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(14px)',
  },
  miniAvatar: { width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff' },
  miniInfo: { display: 'flex', flexDirection: 'column' },
  miniName: { fontSize: 12.5, fontWeight: 700, color: '#fff' },
  miniDuration: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: 'rgba(255,255,255,0.5)' },
  miniEndBtn: { width: 26, height: 26, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
