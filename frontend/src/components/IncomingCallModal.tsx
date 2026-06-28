 import React, { useEffect, useState } from 'react'

interface Props {
  callerName: string
  callType: 'audio' | 'video'
  onAnswer: () => void
  onDecline: () => void
}

export default function IncomingCallModal({ callerName, callType, onAnswer, onDecline }: Props) {
  const [dots, setDots] = useState('.')

  // Animated dots for "calling" effect
  useEffect(() => {
    const id = setInterval(() => {
      setDots(d => d.length >= 3 ? '.' : d + '.')
    }, 500)
    return () => clearInterval(id)
  }, [])

  // Auto-decline after 45 seconds if no answer
  useEffect(() => {
    const id = setTimeout(onDecline, 45000)
    return () => clearTimeout(id)
  }, [onDecline])

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Ripple rings */}
        <div style={styles.rippleWrap}>
          <div style={{ ...styles.ripple, animationDelay: '0s' }} />
          <div style={{ ...styles.ripple, animationDelay: '0.5s' }} />
          <div style={{ ...styles.ripple, animationDelay: '1s' }} />
          <div style={styles.avatarCircle}>
            {callerName.charAt(0).toUpperCase()}
          </div>
        </div>

        <div style={styles.callerName}>{callerName}</div>
        <div style={styles.callType}>
          {callType === 'video' ? '📹' : '📞'} Incoming {callType} call{dots}
        </div>

        <div style={styles.btnRow}>
          {/* Decline */}
          <button style={styles.declineBtn} onClick={onDecline}>
            <span style={styles.btnIcon}>📵</span>
            <span style={styles.btnLabel}>Decline</span>
          </button>

          {/* Answer */}
          <button style={styles.answerBtn} onClick={onAnswer}>
            <span style={styles.btnIcon}>{callType === 'video' ? '📹' : '📞'}</span>
            <span style={styles.btnLabel}>Answer</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ripple-out {
          0%   { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes incoming-slide {
          from { opacity: 0; transform: translateY(32px) scale(0.95); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(12,20,69,0.7)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: 'linear-gradient(160deg, #1a1a3e 0%, #0c1445 100%)',
    borderRadius: 28,
    padding: '48px 40px 36px',
    width: '100%',
    maxWidth: 340,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.3)',
    animation: 'incoming-slide 0.3s cubic-bezier(0.34,1.56,0.64,1)',
  },
  rippleWrap: {
    position: 'relative',
    width: 96,
    height: 96,
    marginBottom: 8,
  },
  ripple: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: '2px solid rgba(99,102,241,0.5)',
    animation: 'ripple-out 2s ease-out infinite',
  },
  avatarCircle: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 36,
    fontWeight: 700,
    color: '#fff',
    zIndex: 1,
  },
  callerName: {
    fontSize: 22,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.4px',
    textAlign: 'center',
  },
  callType: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: 500,
    marginBottom: 8,
    textAlign: 'center',
    minHeight: 20,
  },
  btnRow: {
    display: 'flex',
    gap: 32,
    marginTop: 16,
  },
  declineBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.4)',
    borderRadius: '50px',
    padding: '14px 24px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  answerBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(16,185,129,0.2)',
    border: '1px solid rgba(16,185,129,0.5)',
    borderRadius: '50px',
    padding: '14px 24px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  btnIcon: {
    fontSize: 28,
  },
  btnLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
}
