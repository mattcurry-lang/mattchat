import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'

export default function BibleReaderModal({ onClose }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke(`pulse-bible?reference=${encodeURIComponent(query.trim())}`)
      if (fnError || !data?.ok) throw new Error(data?.error || 'lookup failed')
      setResult({ reference: data.reference, text: data.verse_text, version: data.version })
    } catch (e) {
      console.error('BibleReaderModal search failed:', e)
      setError('Couldn\'t find that passage — try a format like "John 3:16" or "Psalm 23".')
    }
    setLoading(false)
  }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3500, background: 'rgba(10,10,18,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <motion.div
  onClick={e => e.stopPropagation()}
  initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
  style={{ width: 'min(440px,100%)', background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 22, padding: 22 }}
>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
    <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Read a passage</div>
    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16 }}>✕</button>
  </div>
  <div style={{ display: 'flex', gap: 8 }}>
    <input
      value={query}
      onChange={e => setQuery(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && search()}
      placeholder='e.g. "Philippians 4:13"'
      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '9px 12px', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
    />
    <button
      onClick={search}
      disabled={loading || !query.trim()}
      style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '9px 16px', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, fontFamily: 'inherit' }}
    >
      {loading ? '…' : 'Go'}
    </button>
  </div>
  {error && <div style={{ marginTop: 12, fontSize: 12, color: '#f87171' }}>{error}</div>}
  {result && (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ fontSize: 15, lineHeight: 1.65, color: '#fff', fontStyle: 'italic', fontFamily: 'Georgia, serif', marginBottom: 8 }}>
        "{result.text}"
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
        {result.reference} <span style={{ opacity: 0.8 }}>· {result.version}</span>
      </div>
    </div>
  )}
</motion.div>
    </div>,
    document.body
  )
}
