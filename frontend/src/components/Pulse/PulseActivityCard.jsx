import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppIcon } from './PulseIcons'

const IMPORTANCE_COLOR = {
  critical: '#f87171',
  high: '#fb923c',
  medium: '#60a5fa',
  low: 'var(--text-muted)',
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function PulseActivityCard({ item, privacyMode, onOpen, onMarkRead }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const Icon = AppIcon[item.app] || AppIcon.mattchat

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ y: -1, backgroundColor: 'var(--bg-surface-3, rgba(255,255,255,0.05))' }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        borderRadius: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
        cursor: 'pointer', position: 'relative',
      }}
      onClick={() => onOpen?.(item)}
    >
      <Icon size={40} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{item.sender}</span>
          {item.importance !== 'low' && !item.error && (
            <span style={{
              fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3,
              color: IMPORTANCE_COLOR[item.importance], border: `1px solid ${IMPORTANCE_COLOR[item.importance]}`,
              borderRadius: 6, padding: '1px 5px',
            }}>
              {item.importance}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: item.error ? '#f87171' : 'var(--text-secondary)', marginTop: 2 }}>
          {privacyMode && !item.error ? (item.app === 'gmail' ? 'New email' : item.app === 'mattchat' ? 'New message' : 'New activity') : item.title}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>{timeAgo(item.receivedAt)}</div>
      </div>

      <AnimatePresence>
        {item.count > 0 && (
          <motion.div
            key={item.count}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
            style={{
              minWidth: 22, height: 22, borderRadius: 11, background: 'linear-gradient(135deg,#667eea,#764ba2)',
              color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px',
              boxShadow: '0 2px 6px rgba(102,126,234,0.35)',
            }}
          >
            {item.count > 99 ? '99+' : item.count}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position: 'relative' }}>
        <motion.button
          whileHover={{ scale: 1.15, color: 'var(--text-secondary)' }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 4 }}
        >⋮</motion.button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              style={{
                position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: 4,
                background: 'var(--bg-surface-1, #14141f)', border: '1px solid var(--border)', borderRadius: 12,
                boxShadow: 'var(--shadow-lg)', minWidth: 150, overflow: 'hidden',
              }}
            >
              {[
                { label: 'Open app', action: () => { onOpen?.(item); setMenuOpen(false) } },
                { label: 'Mark read', action: () => { onMarkRead?.(item); setMenuOpen(false) } },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={opt.action}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
                    background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 12.5,
                    fontFamily: 'inherit', cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
