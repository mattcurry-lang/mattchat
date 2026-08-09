import React from 'react'
import { startYouTubeConnect } from '../../lib/shortsSupabase'

export default function ConnectYouTubeBanner({ session, onClose }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      background: 'rgba(255,0,0,0.12)', border: '1px solid rgba(255,0,0,0.25)', borderRadius: 12,
      padding: '10px 14px', color: '#fff', fontSize: 13, fontWeight: 600,
    }}>
      <span>🔴 Connect YouTube to see your own subscriptions in Shorts</span>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => startYouTubeConnect(session)}
          style={{ background: '#ff0000', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Connect
        </button>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}>✕</button>
        )}
      </div>
    </div>
  )
}
