import React from 'react'
import { motion } from 'framer-motion'
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        borderRadius: 20, padding: 20,
        background: 'linear-gradient(135deg, rgba(102,126,234,0.12), rgba(118,75,162,0.12))',
        border: '1px solid rgba(167,139,250,0.25)',
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
        {greetingWord()}{name ? `, ${name}` : ''}
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Checking your connected accounts…</div>
      ) : totalUnread === 0 ? (
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>You're all caught up. Nothing needs your attention right now.</div>
      ) : (
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
          You have <strong style={{ color: 'var(--text-primary)' }}>{totalUnread} unread</strong> across your connected accounts.
        </div>
      )}

      {!loading && totalUnread > 0 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {mostActiveApp && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Most active: <span style={{ color: '#c4b5fd', fontWeight: 700 }}>{mostActiveApp}</span>
            </div>
          )}
          {mostActivePerson && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              From: <span style={{ color: '#c4b5fd', fontWeight: 700 }}>{mostActivePerson}</span>
            </div>
          )}
        </div>
      )}

      {aiSummary?.priorityLines?.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(167,139,250,0.15)' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <IconSparkle size={12} /> Needs your attention
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {aiSummary.priorityLines.map((line, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
