import React from 'react'
import { motion } from 'framer-motion'
import { IconX } from '../Icons'
import WhatsAppIcon from '../icons/WhatsAppIcon'

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
