import React from 'react'
import { motion } from 'framer-motion'
import { IconX } from '../Icons'

function WhatsAppIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.02c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.95-.3-1.63-.6-2.87-1.24-4.74-4.13-4.88-4.32-.14-.19-1.17-1.55-1.17-2.96s.72-2.1.98-2.39c.24-.27.53-.34.71-.34.18 0 .35 0 .5.01.16.01.38-.06.59.45.24.58.81 1.99.88 2.13.07.14.11.31.02.5-.09.19-.14.31-.27.48-.14.16-.29.36-.41.48-.14.14-.28.28-.12.55.16.27.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.2 1.37.27.14.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.22.6-.13.24.09 1.55.73 1.82.86.27.13.45.2.51.31.07.11.07.61-.17 1.3z"
      />
    </svg>
  )
}

export default function WhatsAppView({ session, account, status, onDisconnect, disconnecting, onClose }) {
  const connected = status === 'connected'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0 }}>←</button>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0, flex: 1 }}>WhatsApp</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <IconX size={16} />
        </button>
      </div>

      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
          borderRadius: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            width: 44, height: 44, borderRadius: 13, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: connected ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'var(--bg-surface-3, rgba(255,255,255,0.06))',
            color: connected ? '#fff' : 'var(--text-muted)',
            boxShadow: connected ? '0 3px 10px rgba(102,126,234,0.28)' : 'none',
          }}
        >
          <WhatsAppIcon size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {connected ? (account?.display_name || 'WhatsApp Business') : 'Not connected'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
            {connected ? account?.username : 'Connect a WhatsApp Business number to start messaging from Mattchat'}
          </div>
        </div>
        {connected && (
          <span
            style={{
              fontSize: 11, fontWeight: 700, color: '#4ade80',
              background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
              borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap',
            }}
          >
            ● Connected
          </span>
        )}
      </div>

      {connected && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, padding: '0 2px' }}>
            Mattchat can now send and receive WhatsApp messages for this number. Open the WhatsApp tab
            from the sidebar to see conversations.
          </div>
          <button
            onClick={onDisconnect}
            disabled={disconnecting}
            style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 12, color: '#f87171', fontSize: 13, fontWeight: 700,
              padding: '10px 14px', cursor: disconnecting ? 'default' : 'pointer',
              fontFamily: 'inherit', opacity: disconnecting ? 0.6 : 1,
            }}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect WhatsApp'}
          </button>
        </>
      )}
    </motion.div>
  )
}
