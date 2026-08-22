import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useDailyVerse } from '../../hooks/useDailyVerse'
import BibleReaderModal from './BibleReaderModal'

export default function BibleCard() {
  const { verse, loading } = useDailyVerse()
  const [showReader, setShowReader] = useState(false)
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ borderRadius: 18, padding: 16, background: 'linear-gradient(135deg, rgba(45,32,90,0.9), rgba(30,25,55,0.9))', border: '1px solid rgba(167,139,250,0.25)' }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
        Today's Encouragement
      </div>
      {loading ? (
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>Finding today's verse…</div>
      ) : verse ? (
        <>
          <div style={{ fontSize: 14.5, lineHeight: 1.6, color: '#fff', fontStyle: 'italic', fontFamily: 'Georgia, serif', marginBottom: 8 }}>
            "{verse.text}"
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
            {verse.reference} <span style={{ opacity: 0.8 }}>· {verse.version}</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>Couldn't load a verse right now.</div>
      )}
      <button
        onClick={() => setShowReader(true)}
        style={{ marginTop: 12, background: 'rgba(167,139,250,0.18)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 20, color: '#c4b5fd', fontSize: 12, fontWeight: 700, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Look up a passage
      </button>
      {showReader && <BibleReaderModal onClose={() => setShowReader(false)} />}
    </motion.div>
  )
}
