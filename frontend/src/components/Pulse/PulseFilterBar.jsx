import React from 'react'
import { motion } from 'framer-motion'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'priority', label: 'Priority' },
  { id: 'unread', label: 'Unread' },
  { id: 'mattchat', label: 'Mattchat' },
  { id: 'gmail', label: 'Gmail' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'more', label: 'More apps' },
]

export default function PulseFilterBar({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
      {FILTERS.map((f) => {
        const isActive = active === f.id
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            style={{
              position: 'relative', flexShrink: 0, padding: '7px 14px', borderRadius: 20,
              border: '1px solid ' + (isActive ? 'transparent' : 'var(--border)'),
              background: isActive ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'var(--bg-surface-2)',
              color: isActive ? '#fff' : 'var(--text-secondary)',
              fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {isActive && (
              <motion.div
                layoutId="pulse-filter-pill"
                style={{ position: 'absolute', inset: 0, borderRadius: 20, background: 'linear-gradient(135deg,#667eea,#764ba2)', zIndex: -1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
