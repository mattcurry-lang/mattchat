import React from 'react'

export default function WatchTogetherInvite({ session, currentUserId, inviterName, onAccept, onDecline }) {
  const isInviter = session.started_by === currentUserId

  return (
    <div style={{
      margin: '10px 16px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)',
      borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontSize: 13, color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: 6 }}>
        🎬 {isInviter ? `Waiting for ${inviterName} to join Watch Together…` : `${inviterName} wants to watch together`}
      </div>
      {!isInviter && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onAccept} style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 20, color: '#fff', fontSize: 12, fontWeight: 700, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Join
          </button>
          <button onClick={onDecline} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Not now
          </button>
        </div>
      )}
    </div>
  )
}
