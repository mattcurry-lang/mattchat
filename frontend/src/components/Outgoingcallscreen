import React from 'react'
import { IconPhone, IconMic, IconBluetooth } from './Icons'

// Full-screen "Calling…" screen shown to the CALLER while waiting for
// the other side to pick up — the Mattchat equivalent of WhatsApp's
// full-screen calling view. Uses the app's own brand tokens (--brand,
// --brand-deep, --panel-bg) so it always matches the live theme instead
// of a one-off hardcoded color.
export default function OutgoingCallScreen({ callerName, callType, status, onCancel }) {
  const label = status === 'calling' ? 'Calling…' : 'Ringing…'

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.status}>{callType === 'video' ? `Video call · ${label}` : label}</div>

        <div style={styles.rippleWrap}>
          <div style={{ ...styles.ripple, animationDelay: '0s' }} />
          <div style={{ ...styles.ripple, animationDelay: '0.5s' }} />
          <div style={{ ...styles.ripple, animationDelay: '1s' }} />
          <div style={styles.avatarCircle}>{callerName.charAt(0).toUpperCase()}</div>
        </div>

        <div style={styles.callerName}>{callerName}</div>

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

      <style>{`@keyframes ripple-out { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.6); opacity: 0; } }`}</style>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'linear-gradient(160deg, var(--panel-bg, #0f0e17) 0%, #05060a 100%)',
    zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modal: {
    width: '100%', maxWidth: 340,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  },
  status: { fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginBottom: 6 },
  rippleWrap: { position: 'relative', width: 110, height: 110, marginBottom: 8 },
  ripple: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    border: '2px solid rgba(108,99,255,0.5)', animation: 'ripple-out 2s ease-out infinite',
  },
  avatarCircle: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    background: 'var(--brand-grad, linear-gradient(135deg, #6c63ff, #a78bfa))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 40, fontWeight: 700, color: '#fff', zIndex: 1,
  },
  callerName: { fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px', textAlign: 'center' },
  preRow: { display: 'flex', gap: 14, marginTop: 4, marginBottom: 8 },
  preBtn: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'not-allowed',
  },
  declineBtn: {
    width: 64, height: 64, borderRadius: '50%', marginTop: 20,
    background: '#ef4444', border: 'none', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(239,68,68,0.5)',
  },
  btnLabel: {
    marginTop: 6, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
}
