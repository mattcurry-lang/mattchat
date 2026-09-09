import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { IconX, IconMusic, IconSearch } from '../../Icons'

export default function ShareTrackSheet({ track, conversations = [], onShare, onClose }) {
  const [query, setQuery] = useState('')
  const [sentTo, setSentTo] = useState(new Set())

  const filtered = query.trim()
    ? conversations.filter((c) => c.name?.toLowerCase().includes(query.trim().toLowerCase()))
    : conversations

  const handleShare = (conversationId) => {
    setSentTo((prev) => new Set(prev).add(conversationId))
    onShare(conversationId, track)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        style={{
          width: '100%', maxHeight: '75vh', display: 'flex', flexDirection: 'column',
          background: 'var(--bg-surface-1)', border: '1px solid var(--border)', borderBottom: 'none',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 10px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Share song</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IconX size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px 12px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {track.artwork ? <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={14} style={{ color: 'var(--text-muted)' }} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{track.artist}</div>
          </div>
        </div>

        <div style={{ padding: '0 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
            <IconSearch size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people or groups"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13 }}
            />
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 8px 12px' }}>
          {filtered.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '12px 8px' }}>No conversations found.</div>
          ) : (
            filtered.map((c) => {
              const sent = sentTo.has(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => !sent && handleShare(c.id)}
                  disabled={sent}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 10, background: 'transparent', border: 'none', cursor: sent ? 'default' : 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-surface-2)' }}>
                    {c.avatarUrl && <img src={c.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: sent ? '#a78bfa' : 'var(--text-muted)' }}>{sent ? 'Sent' : 'Send'}</div>
                </button>
              )
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
