import React from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

export default function FullChapterModal({ reference, fullText, version, onClose }) {
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3600, background: 'rgba(10,10,18,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        style={{
          width: 'min(520px,100%)', maxHeight: '80vh', overflowY: 'auto',
          background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', border: '1px solid rgba(167,139,250,0.25)',
          borderRadius: 22, padding: 22,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{reference} <span style={{ opacity: 0.6, fontWeight: 600 }}>· {version}</span></div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.75, color: '#fff', fontFamily: 'Georgia, serif' }}>
          {fullText}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
