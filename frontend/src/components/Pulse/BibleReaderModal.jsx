import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { parseBibleQuery } from '../../lib/bibleBooks'

export default function BibleReaderModal({ onClose }) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('search') // 'search' | 'chapterPicker' | 'passage'
  const [activeBook, setActiveBook] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchReference = async (reference) => {
    setLoading(true); setError(null); setResult(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke(`pulse-bible?reference=${encodeURIComponent(reference)}`)
      if (fnError || !data?.ok) throw new Error(data?.error || 'lookup failed')
      setResult({ reference: data.reference, text: data.verse_text, version: data.version })
      setMode('passage')
    } catch (e) {
      console.error('BibleReaderModal fetch failed:', e)
      setError('Couldn\'t find that passage — try a format like "John 3:16", "Psalm 23", or just a book name like "Genesis".')
    }
    setLoading(false)
  }

  const search = async () => {
    if (!query.trim()) return
    const parsed = parseBibleQuery(query)
    if (!parsed) return

    if (parsed.type === 'book') {
      setActiveBook(parsed.book)
      setMode('chapterPicker')
      setError(null)
      return
    }
    if (parsed.type === 'chapter') {
      setActiveBook(parsed.book)
      await fetchReference(`${parsed.book.name} ${parsed.chapter}`)
      return
    }
    // type === 'verse'
    await fetchReference(parsed.reference)
  }

  const pickChapter = (chapterNum) => {
    fetchReference(`${activeBook.name} ${chapterNum}`)
  }

  const backToChapterPicker = () => {
    setMode('chapterPicker')
    setResult(null)
    setError(null)
  }

  const backToSearch = () => {
    setMode('search')
    setActiveBook(null)
    setResult(null)
    setError(null)
    setQuery('')
  }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3500, background: 'rgba(10,10,18,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        style={{
          width: 'min(480px,100%)', maxHeight: '82vh', display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', border: '1px solid rgba(167,139,250,0.25)',
          borderRadius: 22, overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {mode !== 'search' && (
              <button
                onClick={mode === 'passage' && activeBook ? backToChapterPicker : backToSearch}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 26, height: 26, color: '#fff', cursor: 'pointer', fontSize: 13 }}
              >
                ←
              </button>
            )}
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
              {mode === 'search' && 'Read a passage'}
              {mode === 'chapterPicker' && activeBook?.name}
              {mode === 'passage' && result?.reference}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 22px' }}>
          <AnimatePresence mode="wait">
            {mode === 'search' && (
              <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && search()}
                    placeholder='"Genesis", "Genesis 3", or "John 3:16"'
                    autoFocus
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
                <div style={{ marginTop: 14, fontSize: 11.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                  Search a whole book (e.g. "Genesis") to browse its chapters, a specific chapter (e.g. "Genesis 3"), or an exact verse (e.g. "Genesis 3:16").
                </div>
              </motion.div>
            )}

            {mode === 'chapterPicker' && activeBook && (
              <motion.div key="chapters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 8 }}>
                  {Array.from({ length: activeBook.chapters }, (_, i) => i + 1).map(num => (
                    <button
                      key={num}
                      onClick={() => pickChapter(num)}
                      disabled={loading}
                      style={{
                        aspectRatio: '1', borderRadius: 10, background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(167,139,250,0.25)', color: '#fff', fontSize: 13, fontWeight: 700,
                        cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                {loading && <div style={{ marginTop: 14, fontSize: 12.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Loading chapter…</div>}
                {error && <div style={{ marginTop: 14, fontSize: 12, color: '#f87171' }}>{error}</div>}
              </motion.div>
            )}

            {mode === 'passage' && result && (
              <motion.div key="passage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ fontSize: 15, lineHeight: 1.75, color: '#fff', fontFamily: 'Georgia, serif', marginBottom: 10 }}>
                  {result.text}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
                  {result.reference} <span style={{ opacity: 0.8 }}>· {result.version}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
