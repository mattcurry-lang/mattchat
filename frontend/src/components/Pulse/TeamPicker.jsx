import React from 'react'
import { motion } from 'framer-motion'
import { usePlTeamsList } from '../../hooks/useFootballData'

export default function TeamPicker({ onSelect }) {
  const { teams, loading, error } = usePlTeamsList()

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Choose your team</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Pulse will remember it — you can change this anytime.</div>

      {loading && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '16px 0' }}>Loading clubs…</div>}
      {error && <div style={{ fontSize: 12.5, color: '#f87171' }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 10 }}>
          {teams.map((t) => (
            <motion.button
              key={t.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelect(t.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '12px 6px', borderRadius: 14, border: '1px solid var(--border)',
                background: 'var(--bg-surface-2)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <img src={t.crest} alt={t.name} style={{ width: 32, height: 32, objectFit: 'contain' }} />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.25 }}>
                {t.shortName || t.name}
              </span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}
