import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Avatar from '../Avatar'

// One row in the Connected Apps section. `service` shape:
// { id, label, icon, connected, username, avatarUrl, comingSoon }
export default function ConnectedAppCard({ service, onConnect, onOpen, busy }) {
  const { label, icon, connected, username, avatarUrl, comingSoon } = service
  return (
    <motion.div
      layout
      whileHover={comingSoon ? {} : { y: -2, backgroundColor: 'var(--bg-surface-3, rgba(255,255,255,0.05))' }}
      whileTap={comingSoon ? {} : { scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
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
      <motion.div
        layout
        animate={{
          background: connected
            ? 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af,#515bd4)'
            : 'var(--bg-surface-3, rgba(255,255,255,0.06))',
        }}
        transition={{ duration: 0.3 }}
        style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: connected ? '0 3px 10px rgba(220,50,130,0.28)' : 'none',
        }}
      >
        <AnimatePresence mode="wait">
          {connected && avatarUrl ? (
            <motion.div key="avatar" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <Avatar name={username} size={42} photoUrl={avatarUrl} />
            </motion.div>
          ) : (
            <motion.span
              key="icon"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{ fontSize: 18, color: connected ? '#fff' : 'var(--text-muted)' }}
            >
              {icon}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: 12, color: connected ? 'var(--text-secondary)' : 'var(--text-muted)', marginTop: 1 }}>
          {comingSoon ? 'Coming soon' : connected ? `@${username}` : 'Not connected'}
        </div>
      </div>

      {!comingSoon && (
        <AnimatePresence mode="wait" initial={false}>
          {connected ? (
            <motion.span
              key="connected"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              style={{
                fontSize: 11, fontWeight: 700, color: '#4ade80',
                background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
                borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap',
              }}
            >
              ● Connected
            </motion.span>
          ) : (
            <motion.button
              key="connect"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              whileHover={{ scale: busy ? 1 : 1.04 }}
              whileTap={{ scale: busy ? 1 : 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              onClick={(e) => { e.stopPropagation(); onConnect?.() }}
              disabled={busy}
              style={{
                background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none',
                borderRadius: 20, color: '#fff', fontSize: 12, fontWeight: 700,
                padding: '7px 14px', cursor: busy ? 'default' : 'pointer',
                fontFamily: 'inherit', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(102,126,234,0.3)',
              }}
            >
              {busy ? 'Connecting…' : 'Connect'}
            </motion.button>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  )
}
