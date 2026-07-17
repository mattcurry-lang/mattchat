import React from 'react'
import { motion } from 'framer-motion'
import Avatar from '../Avatar'

// One row in the Connected Apps section. `service` shape:
// { id, label, icon, connected, username, avatarUrl, comingSoon }
export default function ConnectedAppCard({ service, onConnect, onOpen, busy }) {
  const { label, icon, connected, username, avatarUrl, comingSoon } = service

  return (
    <motion.div
      whileHover={comingSoon ? {} : { y: -1 }}
      transition={{ duration: 0.15 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 14px',
        borderRadius: 16,
        background: 'var(--bg-surface-2)',
        border: '1px solid var(--border)',
        opacity: comingSoon ? 0.55 : 1,
        cursor: comingSoon ? 'default' : connected ? 'pointer' : 'default',
      }}
      onClick={() => { if (connected && !comingSoon) onOpen?.() }}
    >
      <div
        style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: connected
            ? 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af,#515bd4)'
            : 'var(--bg-surface-3, rgba(255,255,255,0.06))',
        }}
      >
        {connected && avatarUrl ? (
          <Avatar name={username} size={42} photoUrl={avatarUrl} />
        ) : (
          <span style={{ fontSize: 18, color: connected ? '#fff' : 'var(--text-muted)' }}>{icon}</span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: 12, color: connected ? 'var(--text-secondary)' : 'var(--text-muted)', marginTop: 1 }}>
          {comingSoon ? 'Coming soon' : connected ? `@${username}` : 'Not connected'}
        </div>
      </div>

      {!comingSoon && (
        connected ? (
          <span
            style={{
              fontSize: 11, fontWeight: 700, color: '#4ade80',
              background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
              borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap',
            }}
          >
            ● Connected
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onConnect?.() }}
            disabled={busy}
            style={{
              background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none',
              borderRadius: 20, color: '#fff', fontSize: 12, fontWeight: 700,
              padding: '7px 14px', cursor: busy ? 'default' : 'pointer',
              fontFamily: 'inherit', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap',
            }}
          >
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        )
      )}
    </motion.div>
  )
}
