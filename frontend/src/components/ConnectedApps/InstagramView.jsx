import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Avatar from '../Avatar'
import InstagramFeed from './InstagramFeed'
import InstagramSearch from './InstagramSearch'
import { openInstagramProfile } from '../../lib/openInstagram'
import { useInstagramFeed } from '../../hooks/useInstagramConnection'

export default function InstagramView({ session, account, status, onDisconnect, disconnecting, onClose }) {
  const [tab, setTab] = useState('posts') // 'posts' | 'search'
  const [toast, setToast] = useState(null)
  const feed = useInstagramFeed(session, status)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Instagram? Mattchat will remove the connection and stop showing your Instagram content here.')) return
    await onDisconnect()
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 15, padding: 4 }}
        >←</button>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Instagram</h3>
        <span
          title="Connected via Instagram — content and actions belong to Instagram"
          style={{
            marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: '#f58529',
            background: 'rgba(245,133,41,0.1)', border: '1px solid rgba(245,133,41,0.3)',
            borderRadius: 20, padding: '4px 10px',
          }}
        >
          via Instagram
        </span>
      </div>

      {/* Profile header */}
      <div
        style={{
          borderRadius: 20, padding: 18, position: 'relative', overflow: 'hidden',
          background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            position: 'absolute', inset: 0, opacity: 0.08,
            background: 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af,#515bd4)',
          }}
        />
        <div style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar name={account?.username} size={64} photoUrl={account?.avatar_url} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              {account?.display_name || account?.username}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>@{account?.username}</div>
            {account?.bio && (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{account.bio}</div>
            )}
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={() => { showToast('Opening Instagram to complete this action.'); openInstagramProfile(account?.username) }}
            style={{
              flex: 1, background: 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af,#515bd4)',
              border: 'none', borderRadius: 12, color: '#fff', fontSize: 12.5, fontWeight: 700,
              padding: '9px 0', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Open profile in Instagram
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12, color: '#f87171', fontSize: 12.5, fontWeight: 700,
              padding: '9px 14px', cursor: disconnecting ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: disconnecting ? 0.6 : 1,
            }}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'posts', label: 'Your posts' },
          { id: 'search', label: 'Find profiles' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              padding: '8px 4px', fontSize: 13, fontWeight: 700,
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: tab === t.id ? '2px solid #dd2a7b' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'posts' ? (
        <InstagramFeed feed={feed} onAction={showToast} />
      ) : (
        <InstagramSearch session={session} onAction={showToast} />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(20,20,30,0.95)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '10px 18px', fontSize: 12.5, fontWeight: 600,
              color: '#fff', zIndex: 500, boxShadow: 'var(--shadow-lg)',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
