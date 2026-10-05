import React from 'react'
import { useConnectionStatus } from '../lib/connectivity'

// During the grace window: set to false to say nothing at all
const SHOW_RECONNECTING_PILL = true

export default function ConnectionBanner() {
  const { status } = useConnectionStatus()
  if (status === 'online') return null

  if (status === 'reconnecting') {
    if (!SHOW_RECONNECTING_PILL) return null
    return (
      <div role="status" style={{
        position: 'fixed', top: 'max(8px, env(safe-area-inset-top, 0px))', left: '50%', transform: 'translateX(-50%)',
        zIndex: 100001, background: 'rgba(124,58,237,0.92)', color: '#fff', fontSize: 11.5, fontWeight: 700,
        padding: '5px 12px', borderRadius: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
      }}>
        Reconnecting… messages will send automatically
      </div>
    )
  }

  return (
    <div role="status" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100001, background: '#7c3aed', color: '#fff',
      fontSize: 12, fontWeight: 700, textAlign: 'center', padding: 'max(6px, env(safe-area-inset-top, 0px)) 12px 6px',
    }}>
      You're offline. Downloaded music and saved chats still work.
    </div>
  )
}
