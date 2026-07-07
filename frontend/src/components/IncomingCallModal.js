import React, { useEffect, useState } from 'react'
import { IconPhone, IconMic, IconBluetooth } from './Icons'

export default function IncomingCallModal({ callerName, callType, onAnswer, onDecline }) {
  const [dots, setDots] = useState('.')
  const [startMuted, setStartMuted] = useState(false)

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
      <div style={styles.modal}>
        <div style={styles.status}>{callType === 'video' ? 'Incoming video call' : `Incoming call${dots}`}</div>

        <div style={styles.rippleWrap}>
          <div style={{ ...styles.ripple, animationDelay: '0s' }} />
          <div style={{ ...styles.ripple, animationDelay: '0.5s' }} />
          <div style={{ ...styles.ripple, animationDelay: '1s' }} />
          <div style={styles.avatarCircle}>{callerName.charAt(0).toUpperCase()}</div>
        </div>

        <div style={styles.callerName}>{callerName}</div>

        {/* Pre-answer controls — bluetooth picker + start-muted toggle */}
        <div style={styles.preRow}>
          <button style={styles.preBtn} onClick={pickBluetoothDevice} title="Choose audio output">
            <IconBluetooth size={18} />
          </button>
          <button
            style={{ ...styles.preBtn, ...(startMuted ? styles.preBtnActive : {}) }}
            onClick={() => setStartMuted(v => !v)}
            title={startMuted ? 'Will join muted' : 'Join with mic on'}
          >
            <IconMic size={18} />
          </button>
        </div>

        <div style={styles.btnRow}>
          <button style={styles.declineBtn} onClick={onDecline} title="Decline">
            <IconPhone size={26} style={{ transform: 'rotate(135deg)' }} />
          </button>
          <button style={styles.answerBtn} onClick={() => onAnswer(startMuted)} title="Answer">
            <IconPhone size={26} />
          </button>
        </div>
        <div style={styles.btnLabelRow}>
          <span>Decline</span>
          <span>Answer</span>
        </div>
      </div>

      <style>{`
        @keyframes ripple-out { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.6); opacity: 0; } }
        @keyframes incoming-slide { from { opacity: 0; transform: translateY(32px) scale(0.95); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'linear-gradient(160deg, #1b0f2e 0%, #05060f 100%)',
    zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modal: {
    width: '100%', maxWidth: 340,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    animation: 'incoming-slide 0.3s cubic-bezier(0.34,1.56,0.64,1)',
  },
  status: { fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginBottom: 6 },
  rippleWrap: { position: 'relative', width: 110, height: 110, marginBottom: 8 },
  ripple: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    border: '2px solid rgba(129,90,220,0.5)', animation: 'ripple-out 2s ease-out infinite',
  },
  avatarCircle: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    background: 'linear-gradient(135deg, #7c3aed, #db2777)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 40, fontWeight: 700, color: '#fff', zIndex: 1,
  },
  callerName: { fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px', textAlign: 'center' },
  preRow: { display: 'flex', gap: 14, marginTop: 4, marginBottom: 8 },
  preBtn: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
  preBtnActive: { background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5' },
  btnRow: { display: 'flex', gap: 40, marginTop: 20 },
  declineBtn: {
    width: 64, height: 64, borderRadius: '50%',
    background: '#ef4444', border: 'none', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(239,68,68,0.5)',
  },
  answerBtn: {
    width: 64, height: 64, borderRadius: '50%',
    background: '#22c55e', border: 'none', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(34,197,94,0.5)',
  },
  btnLabelRow: {
    display: 'flex', gap: 40, marginTop: 6,
    fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em',
  },
}
