import React, { useState } from 'react'
import { motion } from 'framer-motion'
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
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

      {item.count > 0 && (
        <div style={{
          minWidth: 22, height: 22, borderRadius: 11, background: 'linear-gradient(135deg,#667eea,#764ba2)',
          color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px',
        }}>
          {item.count > 99 ? '99+' : item.count}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 4 }}
        >⋮</button>
        {menuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
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
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
