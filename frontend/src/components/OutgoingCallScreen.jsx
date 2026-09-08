import React from 'react'
import { IconPhone, IconMic, IconBluetooth, IconVideo } from './Icons'

export default function OutgoingCallScreen({ callerName, callType, status, avatarUrl, onCancel }) {
  const label = status === 'ringing' ? 'RINGING' : 'CALLING'
  const initial = callerName?.charAt(0)?.toUpperCase() || '?'

  return (
    <div style={styles.overlay}>
      {avatarUrl ? (
        <div style={{ ...styles.bgPhoto, backgroundImage: `url(${avatarUrl})` }} />
      ) : (
        <div style={styles.bgGradient} />
      )}
      <div style={styles.bgScrim} />
      <div style={styles.scanlines} />

      <div style={styles.topStatus}>
        <span style={styles.pulseDot} />
        {callType === 'video' ? `VIDEO CALL · ${label}` : label}
      </div>

      <div style={styles.center}>
        <div style={styles.avatarWrap}>
          <div style={{ ...styles.ring, animationDelay: '0s' }} />
          <div style={{ ...styles.ring, animationDelay: '0.6s' }} />
          {avatarUrl ? (
            <img src={avatarUrl} alt={callerName} style={styles.avatarImg} />
          ) : (
            <div style={styles.avatarFallback}>{initial}</div>
          )}
        </div>
        <div style={styles.callerName}>{callerName}</div>
        <div style={styles.subLabel}>MATTCHAT {callType === 'video' ? 'VIDEO' : 'VOICE'}</div>
      </div>

      <div style={styles.controlBar}>
        <button style={styles.pillBtn} disabled title="Audio output"><IconBluetooth size={19} /></button>
        <button style={styles.pillBtn} disabled title="Mic"><IconMic size={19} /></button>
        {callType === 'video' && (
          <button style={styles.pillBtn} disabled title="Camera"><IconVideo size={19} /></button>
        )}
        <button style={styles.endBtn} onClick={onCancel} title="Cancel call" aria-label="Cancel call">
          <IconPhone size={24} style={{ transform: 'rotate(135deg)' }} />
        </button>
      </div>
      <div style={styles.endLabel}>Cancel</div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&display=swap');
        @keyframes ring-pulse { 0% { transform: scale(1); opacity: 0.55; } 100% { transform: scale(1.7); opacity: 0; } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes avatar-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
      `}</style>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, zIndex: 9998, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '64px 24px 56px', fontFamily: "'Inter', system-ui, sans-serif" },
  bgPhoto: { position: 'absolute', inset: -20, zIndex: 0, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(38px) brightness(0.55) saturate(1.1)', transform: 'scale(1.15)' },
  bgGradient: { position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(circle at 50% 20%, #241f3d 0%, #0a0912 60%, #050408 100%)' },
  bgScrim: { position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(180deg, rgba(5,4,8,0.55) 0%, rgba(5,4,8,0.75) 60%, rgba(5,4,8,0.92) 100%)' },
  scanlines: { position: 'absolute', inset: 0, zIndex: 1, opacity: 0.03, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(180deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)' },
  topStatus: { position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, letterSpacing: 2.2, color: '#c9c0ff', fontWeight: 600 },
  pulseDot: { width: 6, height: 6, borderRadius: '50%', background: '#c9c0ff', animation: 'pulse-dot 1.4s ease-in-out infinite' },
  center: { position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  avatarWrap: { position: 'relative', width: 168, height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'avatar-breathe 3.4s ease-in-out infinite' },
  ring: { position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.35)', animation: 'ring-pulse 2.4s ease-out infinite' },
  avatarImg: { width: 150, height: 150, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.25)', boxShadow: '0 0 44px rgba(108,99,255,0.5)' },
  avatarFallback: { width: 150, height: 150, borderRadius: '50%', background: 'linear-gradient(135deg, #6c63ff, #c77dff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 54, fontWeight: 700, color: '#fff', boxShadow: '0 0 44px rgba(108,99,255,0.5)' },
  callerName: { fontSize: 27, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px', textShadow: '0 2px 12px rgba(0,0,0,0.5)' },
  subLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.4, marginTop: -8 },
  controlBar: { position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 18, background: 'rgba(20,18,30,0.55)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 40, padding: '10px 14px', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' },
  pillBtn: { width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'not-allowed' },
  endBtn: { width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 20px rgba(239,68,68,0.55)' },
  endLabel: { position: 'relative', zIndex: 2, marginTop: -8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' },
}
