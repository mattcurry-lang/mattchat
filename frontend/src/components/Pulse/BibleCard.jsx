import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useDailyVerse } from '../../hooks/useDailyVerse'
import BibleReaderModal from './BibleReaderModal'

export default function BibleCard() {
  const { verse, loading } = useDailyVerse()
  const [showReader, setShowReader] = useState(false)

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ borderRadius: 18, padding: 16, background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(102,126,234,0.08))', border: '1px solid rgba(167,139,250,0.2)' }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
        Today's Encouragement
      </div>

      {loading ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Finding today's verse…</div>
      ) : verse ? (
        <>
          <div style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-primary)', fontStyle: 'italic', fontFamily: 'Georgia, serif', marginBottom: 8 }}>
            "{verse.text}"
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            {verse.reference} <span style={{ opacity: 0.7 }}>· {verse.version}</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Couldn't load a verse right now.</div>
      )}

      <button
        onClick={() => setShowReader(true)}
        style={{ marginTop: 12, background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 20, color: '#c4b5fd', fontSize: 12, fontWeight: 700, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Look up a passage
      </button>

      {showReader && <BibleReaderModal onClose={() => setShowReader(false)} />}
    </motion.div>
  )
}
