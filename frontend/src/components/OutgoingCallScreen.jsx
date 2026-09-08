import React from 'react'
import { IconPhone, IconMic, IconBluetooth } from './Icons'
// Full-screen "Calling…" screen shown to the CALLER while waiting for
// the other side to pick up — the Mattchat equivalent of WhatsApp's
// full-screen calling view. Uses the app's own brand tokens (--brand,
// --brand-deep, --panel-bg) so it always matches the live theme instead
// of a one-off hardcoded color.
export default function OutgoingCallScreen({ callerName, callType, status, onCancel }) {
  const label = status === 'calling' ? 'CALLING' : 'RINGING'
  return (
    <div style={styles.overlay}>
      <div style={styles.bg} />
      <div style={styles.scanlines} />
      <div style={styles.gridGlow} />

      <div style={styles.modal}>
        <div style={styles.hudLabel}>
          <span style={styles.pulseDot} />
          {callType === 'video' ? `VIDEO CALL · ${label}` : label}
        </div>

        <div style={styles.rippleWrap}>
          <div style={{ ...styles.ripple, animationDelay: '0s' }} />
          <div style={{ ...styles.ripple, animationDelay: '0.5s' }} />
          <div style={{ ...styles.ripple, animationDelay: '1s' }} />
          <div style={styles.orbit}><span style={styles.orbitDot} /></div>
          <div style={styles.avatarCircle}>{callerName.charAt(0).toUpperCase()}</div>
        </div>

        <div style={styles.callerName}>{callerName}</div>
        <div style={styles.subLabel}>MATTCHAT {callType === 'video' ? 'VIDEO' : 'VOICE'}</div>

        <div style={styles.preRow}>
          <button style={styles.preBtn} disabled title="Audio output">
            <IconBluetooth size={18} />
          </button>
          <button style={styles.preBtn} disabled title="Mic">
            <IconMic size={18} />
          </button>
        </div>

        <button style={styles.declineBtn} onClick={onCancel} title="Cancel call">
          <IconPhone size={26} style={{ transform: 'rotate(135deg)' }} />
        </button>
        <div style={styles.btnLabel}>Cancel</div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&display=swap');
        @keyframes ripple-out { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.6); opacity: 0; } }
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
    fontFamily: "'Inter', system-ui, sans-serif",
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
  callerName: { fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px', textAlign: 'center' },
  subLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginTop: -6 },
  preRow: { display: 'flex', gap: 14, marginTop: 10, marginBottom: 8 },
  preBtn: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'not-allowed', backdropFilter: 'blur(6px)',
  },
  declineBtn: {
    width: 64, height: 64, borderRadius: '50%', marginTop: 20,
    background: 'linear-gradient(135deg, #ef4444, #b91c1c)', border: 'none', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(239,68,68,0.5)',
  },
  btnLabel: {
    marginTop: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 700,
    color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em',
  },
}
