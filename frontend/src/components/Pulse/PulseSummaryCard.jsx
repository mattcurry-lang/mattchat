import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconSparkle } from '../Icons'

function greetingWord() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// aiSummary: { mostActiveApp, mostActivePerson, priorityLines } | null
// Everything here is either computed directly from `items` (deterministic,
// no AI) or comes from an optional aiSummary the caller fetched from
// Curry — never invented client-side.
export default function PulseSummaryCard({ name, items, loading, aiSummary }) {
  const totalUnread = items.reduce((sum, i) => sum + (i.count || 0), 0)
  const byApp = {}
  items.forEach((i) => { byApp[i.app] = (byApp[i.app] || 0) + (i.count || 0) })
  const mostActiveApp = Object.entries(byApp).sort((a, b) => b[1] - a[1])[0]?.[0]
  const bySender = {}
  items.forEach((i) => { if (i.count > 0) bySender[i.sender] = (bySender[i.sender] || 0) + i.count })
  const mostActivePerson = Object.entries(bySender).sort((a, b) => b[1] - a[1])[0]?.[0]
  const unreadRows = items.filter((i) => i.count > 0)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      style={{
        borderRadius: 20, padding: 20,
        background: 'linear-gradient(135deg, rgba(102,126,234,0.12), rgba(118,75,162,0.12))',
        border: '1px solid rgba(167,139,250,0.25)',
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
        {greetingWord()}{name ? `, ${name}` : ''}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ fontSize: 13, color: 'var(--text-muted)' }}
          >
            Checking your connected accounts…
          </motion.div>
        ) : totalUnread === 0 ? (
          <motion.div
            key="caught-up"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}
          >
            You're all caught up. Nothing needs your attention right now.
          </motion.div>
        ) : (
          <motion.div
            key="unread"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}
          >
            You have{' '}
            <motion.strong
              key={totalUnread}
              initial={{ scale: 1.3, color: '#c4b5fd' }}
              animate={{ scale: 1, color: 'var(--text-primary)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              style={{ display: 'inline-block' }}
            >
              {totalUnread} unread
            </motion.strong>{' '}
            across your connected accounts.
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && totalUnread > 0 && (
        <motion.div layout style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
          <AnimatePresence initial={false}>
            {unreadRows.map((i, idx) => (
              <motion.div
                layout
                key={i.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30, delay: Math.min(idx * 0.04, 0.24) }}
                style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}
              >
                <span>{i.sender}</span>
                <span style={{ color: '#c4b5fd', fontWeight: 700 }}>{i.count}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {aiSummary?.priorityLines?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(167,139,250,0.15)', overflow: 'hidden' }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <IconSparkle size={12} /> Needs your attention
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {aiSummary.priorityLines.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.25) }}
                  style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}
                >
                  {line}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
