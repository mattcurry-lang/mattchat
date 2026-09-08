import React, { useEffect, useState } from 'react'
import { IconPhone, IconMic, IconBluetooth } from './Icons'
import { useRingtone } from '../hooks/useRingtone'

export default function IncomingCallModal({ callerName, callType, avatarUrl, onAnswer, onDecline }) {
  const [dots, setDots] = useState('.')
  const [startMuted, setStartMuted] = useState(false)

  useRingtone(true, 'ringtone')

  useEffect(() => {
    const id = setInterval(() => setDots(d => (d.length >= 3 ? '.' : d + '.')), 500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setTimeout(onDecline, 45000)
    return () => clearTimeout(id)
  }, [onDecline])

  const pickBluetoothDevice = async () => {
    if (!navigator.mediaDevices?.selectAudioOutput) {
      alert("Choosing a Bluetooth/other output device isn't supported in this browser — your system default will be used.")
      return
    }
    try { await navigator.mediaDevices.selectAudioOutput() } catch (e) { /* user cancelled */ }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.bg} />
      <div style={styles.scanlines} />
      <div style={styles.gridGlow} />

      <div style={styles.modal}>
        <div style={styles.hudLabel}>
          <span style={styles.pulseDot} />
          {callType === 'video' ? 'INCOMING VIDEO CALL' : `INCOMING CALL${dots}`}
        </div>

        <div style={styles.rippleWrap}>
          <div style={{ ...styles.ripple, animationDelay: '0s' }} />
          <div style={{ ...styles.ripple, animationDelay: '0.5s' }} />
          <div style={{ ...styles.ripple, animationDelay: '1s' }} />
          <div style={styles.orbit}><span style={styles.orbitDot} /></div>
         {avatarUrl ? (
           <img src={avatarUrl} alt={callerName} style={styles.avatarImg} />
         ) : (
           <div style={styles.avatarCircle}>{callerName.charAt(0).toUpperCase()}</div>
          )}
        </div>

        <div style={styles.callerName}>{callerName}</div>
        <div style={styles.subLabel}>MATTCHAT {callType === 'video' ? 'VIDEO' : 'VOICE'}</div>

        <div style={styles.preRow}>
          <button style={styles.preBtn} onClick={pickBluetoothDevice} title="Choose audio output" aria-label="Choose audio output">
            <IconBluetooth size={18} />
          </button>
          <button
            style={{ ...styles.preBtn, ...(startMuted ? styles.preBtnActive : {}) }}
            onClick={() => setStartMuted(v => !v)}
            aria-label={startMuted ? 'Will join muted' : 'Join with microphone on'}
          >
            <IconMic size={18} />
          </button>
        </div>

        <div style={styles.btnRow}>
          <button style={styles.declineBtn} onClick={onDecline} title="Decline" aria-label="Decline call">
            <IconPhone size={26} style={{ transform: 'rotate(135deg)' }} />
          </button>
          <button style={styles.answerBtn} onClick={() => onAnswer(startMuted)} title="Answer" aria-label="Answer call">
            <IconPhone size={26} />
          </button>
        </div>
        <div style={styles.btnLabelRow}>
          <span>Decline</span>
          <span>Answer</span>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&display=swap');
        @keyframes ripple-out { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.6); opacity: 0; } }
        @keyframes incoming-slide { from { opacity: 0; transform: translateY(32px) scale(0.95); } to { opacity: 1; transform: none; } }
        @keyframes ic-orbit { to { transform: rotate(360deg); } }
        @keyframes ic-pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes ic-avatar-glow { 0%, 100% { box-shadow: 0 0 36px rgba(108,99,255,0.5); } 50% { box-shadow: 0 0 56px rgba(199,125,255,0.6); } }
        @keyframes ic-grid-drift { 0% { background-position: 0 0; } 100% { background-position: 60px 60px; } }
      `}</style>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9998,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden',
  },
  bg: { position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(circle at 50% 18%, #241f3d 0%, #0a0912 60%, #050408 100%)' },
  scanlines: { position: 'absolute', inset: 0, zIndex: 0, opacity: 0.04, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(180deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)' },
  gridGlow: {
    position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.35,
    backgroundImage: 'linear-gradient(rgba(139,127,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(139,127,255,0.08) 1px, transparent 1px)',
    backgroundSize: '60px 60px', animation: 'ic-grid-drift 18s linear infinite',
  },
  modal: {
    position: 'relative', zIndex: 2, width: '100%', maxWidth: 340,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    animation: 'incoming-slide 0.3s cubic-bezier(0.34,1.56,0.64,1)', fontFamily: "'Inter', system-ui, sans-serif",
  },
  hudLabel: {
    display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11, letterSpacing: 2.2, color: '#8b7fff', fontWeight: 600, marginBottom: 6,
  },
  pulseDot: { width: 6, height: 6, borderRadius: '50%', background: '#8b7fff', animation: 'ic-pulse-dot 1.4s ease-in-out infinite' },
  rippleWrap: { position: 'relative', width: 110, height: 110, marginBottom: 8 },
  ripple: { position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(108,99,255,0.5)', animation: 'ripple-out 2s ease-out infinite' },
  orbit: { position: 'absolute', top: -18, left: -18, right: -18, bottom: -18, borderRadius: '50%', border: '1px dashed rgba(199,125,255,0.35)', animation: 'ic-orbit 9s linear infinite' },
  orbitDot: { position: 'absolute', top: -3, left: '50%', width: 6, height: 6, borderRadius: '50%', background: '#c77dff', boxShadow: '0 0 10px #c77dff', transform: 'translateX(-50%)' },
  avatarCircle: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    background: 'var(--brand-grad, linear-gradient(135deg, #6c63ff, #c77dff))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 40, fontWeight: 700, color: '#fff', zIndex: 1,
    animation: 'ic-avatar-glow 2.8s ease-in-out infinite',
  },
   avatarImg: {
    position: 'absolute', inset: 0, borderRadius: '50%', objectFit: 'cover',
    zIndex: 1, border: '2px solid rgba(255,255,255,0.2)',
 },
  callerName: { fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px', textAlign: 'center' },
  subLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginTop: -6 },
  preRow: { display: 'flex', gap: 14, marginTop: 10, marginBottom: 8 },
  preBtn: {
    width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(6px)',
  },
  preBtnActive: { background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5' },
  btnRow: { display: 'flex', gap: 40, marginTop: 20 },
  declineBtn: {
    width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(239,68,68,0.5)',
  },
  answerBtn: {
    width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #34d399, #0ea5a0)',
    border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(52,211,153,0.5)',
  },
  btnLabelRow: {
    display: 'flex', gap: 40, marginTop: 6, fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em',
  },
}
