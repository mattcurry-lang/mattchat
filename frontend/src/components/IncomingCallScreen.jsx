// IncomingCallScreen.jsx
// Full-screen ringing UI shown while callStatus === 'incoming'. Doesn't
// exist yet in this codebase — CallOverlay only handles connected calls.
// Render this alongside CallOverlay in whatever component reads useCall's
// callStatus (e.g. ChatPage): incoming → this, connecting/in-call → CallOverlay.

import React, { useEffect, useRef } from 'react'
import { IconPhone, IconPhoneOff, IconVideo } from './Icons'
import { useRingtone } from '../hooks/useRingtone'

export default function IncomingCallScreen({ callerName, callType, onAccept, onDecline }) {
  useRingtone(true) // plays + loops for the lifetime of this component, stops on unmount

  return (
    <div style={styles.overlay}>
      <div style={styles.bg} />
      <div style={styles.scanlines} />

      <div style={styles.topLabel}>
        <span style={styles.pulseDot} />
        INCOMING {callType === 'video' ? 'VIDEO' : 'AUDIO'} CALL
      </div>

      <div style={styles.center}>
        <div style={styles.ringStack}>
          <div style={{ ...styles.ring, animationDelay: '0s' }} />
          <div style={{ ...styles.ring, animationDelay: '0.7s' }} />
          <div style={{ ...styles.ring, animationDelay: '1.4s' }} />
          <div style={styles.orbit}>
            <span style={styles.orbitDot} />
          </div>
          <div style={styles.avatar}>{callerName?.charAt(0).toUpperCase() || '?'}</div>
        </div>
        <div style={styles.callerName}>{callerName}</div>
        <div style={styles.subLabel}>Mattchat {callType === 'video' ? 'Video' : 'Voice'} Call</div>
      </div>

      <div style={styles.actions}>
        <button onClick={onDecline} style={styles.declineBtn} aria-label="Decline call">
          <IconPhoneOff size={26} />
          <span style={styles.actionLabel}>Decline</span>
        </button>
        <button onClick={onAccept} style={styles.acceptBtn} aria-label="Accept call">
          {callType === 'video' ? <IconVideo size={26} /> : <IconPhone size={26} />}
          <span style={styles.actionLabel}>Accept</span>
        </button>
      </div>

      <style>{`
        @keyframes ic-ring { 0% { transform: scale(1); opacity: 0.55; } 100% { transform: scale(2.1); opacity: 0; } }
        @keyframes ic-orbit { to { transform: rotate(360deg); } }
        @keyframes ic-pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes ic-avatar-glow { 0%, 100% { box-shadow: 0 0 40px rgba(108,99,255,0.5); } 50% { box-shadow: 0 0 64px rgba(199,125,255,0.65); } }
        @keyframes ic-slide-up { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 10000,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
    padding: '64px 24px 56px', overflow: 'hidden',
    fontFamily: "'Inter', system-ui, sans-serif",
    animation: 'ic-slide-up 0.4s cubic-bezier(0.16,1,0.3,1)',
  },
  bg: {
    position: 'absolute', inset: 0, zIndex: 0,
    background: 'radial-gradient(circle at 50% 20%, #241f3d 0%, #0a0912 62%, #050408 100%)',
  },
  scanlines: {
    position: 'absolute', inset: 0, zIndex: 0, opacity: 0.05, pointerEvents: 'none',
    backgroundImage: 'repeating-linear-gradient(180deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)',
  },
  topLabel: {
    position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8,
    fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2.5,
    color: '#8b7fff', fontWeight: 600,
  },
  pulseDot: { width: 6, height: 6, borderRadius: '50%', background: '#8b7fff', animation: 'ic-pulse-dot 1.4s ease-in-out infinite' },
  center: { position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 },
  ringStack: { position: 'relative', width: 210, height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute', width: 210, height: 210, borderRadius: '50%',
    border: '1.5px solid rgba(139,127,255,0.45)', animation: 'ic-ring 2.6s ease-out infinite',
  },
  orbit: {
    position: 'absolute', width: 176, height: 176, borderRadius: '50%',
    border: '1px dashed rgba(199,125,255,0.35)', animation: 'ic-orbit 9s linear infinite',
  },
  orbitDot: {
    position: 'absolute', top: -3, left: '50%', width: 6, height: 6, borderRadius: '50%',
    background: '#c77dff', boxShadow: '0 0 10px #c77dff', transform: 'translateX(-50%)',
  },
  avatar: {
    width: 150, height: 150, borderRadius: '50%',
    background: 'linear-gradient(135deg, #6c63ff, #c77dff)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 56, fontWeight: 700, color: '#fff',
    animation: 'ic-avatar-glow 2.8s ease-in-out infinite',
  },
  callerName: { fontSize: 27, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px' },
  subLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  actions: { position: 'relative', zIndex: 2, display: 'flex', gap: 56 },
  declineBtn: {
    width: 68, height: 68, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    color: '#fff', boxShadow: '0 6px 24px rgba(239,68,68,0.45)',
  },
  acceptBtn: {
    width: 68, height: 68, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #34d399, #0ea5a0)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    color: '#fff', boxShadow: '0 6px 24px rgba(52,211,153,0.45)',
  },
  actionLabel: { fontSize: 9.5, fontWeight: 700, position: 'absolute', marginTop: 84 },
}
