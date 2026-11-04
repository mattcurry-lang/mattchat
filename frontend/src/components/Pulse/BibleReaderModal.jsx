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
  
  // Reading preferences for comfortable immersion
  const [fontSize, setFontSize] = useState(16) // Default comfortable reading size
  const [isBookmarked, setIsBookmarked] = useState(false)

  const fetchReference = async (reference) => {
    setLoading(true); setError(null); setResult(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke(`pulse-bible?reference=${encodeURIComponent(reference)}`)
      if (fnError || !data?.ok) throw new Error(data?.error || 'lookup failed')
      setResult({ reference: data.reference, text: data.verse_text, version: data.version })
      setMode('passage')
      setIsBookmarked(false) // reset bookmark state for new passage
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3500, background: 'rgba(10,10,18,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.96 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: 'min(620px, 100%)', 
          maxHeight: '85vh', 
          display: 'flex', 
          flexDirection: 'column',
          background: 'linear-gradient(160deg, #1b1730 0%, #12101b 100%)', 
          border: '1px solid rgba(167,139,250,0.3)',
          borderRadius: 24, 
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(108, 99, 255, 0.15)',
        }}
      >
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {mode !== 'search' && (
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={mode === 'passage' && activeBook ? backToChapterPicker : backToSearch}
                style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '50%', width: 32, height: 32, color: '#c4b5fd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}
                title="Go back"
              >
                ←
              </motion.button>
            )}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(167,139,250,0.8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {mode === 'search' && 'Scripture Explorer'}
                {mode === 'chapterPicker' && 'Select Chapter'}
                {mode === 'passage' && 'Reading Mode'}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginTop: 2 }}>
                {mode === 'search' && 'Look up any passage'}
                {mode === 'chapterPicker' && activeBook?.name}
                {mode === 'passage' && result?.reference}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Font size adjustment tools when reading */}
            {mode === 'passage' && (
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '2px 8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <button 
                  onClick={() => setFontSize(prev => Math.max(13, prev - 2))}
                  style={{ background: 'none', border: 'none', color: '#c4b5fd', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 6px' }}
                  title="Decrease text size"
                >
                  A-
                </button>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '0 2px' }}>|</span>
                <button 
                  onClick={() => setFontSize(prev => Math.min(24, prev + 2))}
                  style={{ background: 'none', border: 'none', color: '#c4b5fd', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '4px 6px' }}
                  title="Increase text size"
                >
                  A+
                </button>
              </div>
            )}

            {/* Bookmark button */}
            {mode === 'passage' && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsBookmarked(!isBookmarked)}
                style={{ 
                  background: isBookmarked ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.06)', 
                  border: '1px solid rgba(167,139,250,0.3)', 
                  borderRadius: '50%', 
                  width: 36, 
                  height: 36, 
                  color: isBookmarked ? '#a78bfa' : 'rgba(255,255,255,0.6)', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: 15
                }}
                title={isBookmarked ? 'Bookmarked' : 'Bookmark verse'}
              >
                {isBookmarked ? '♥' : '♡'}
              </motion.button>
            )}

            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose} 
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 36, height: 36, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}
              title="Close"
            >
              ✕
            </motion.button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 32px' }}>
          <AnimatePresence mode="wait">
            {mode === 'search' && (
              <motion.div key="search" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && search()}
                    placeholder='Type a book or verse (e.g. "John 3:16" or "Psalms")'
                    autoFocus
                    style={{ 
                      flex: 1, 
                      background: 'rgba(255,255,255,0.06)', 
                      border: '1px solid rgba(167,139,250,0.25)', 
                      borderRadius: 14, 
                      padding: '12px 16px', 
                      color: '#fff', 
                      fontSize: 14, 
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={search}
                    disabled={loading || !query.trim()}
                    style={{ 
                      background: 'linear-gradient(135deg, #6c63ff 0%, #a78bfa 100%)', 
                      border: 'none', 
                      borderRadius: 14, 
                      color: '#fff', 
                      fontSize: 13, 
                      fontWeight: 700, 
                      padding: '0 22px', 
                      cursor: loading ? 'default' : 'pointer', 
                      opacity: loading || !query.trim() ? 0.6 : 1, 
                      fontFamily: 'inherit',
                      boxShadow: '0 4px 14px rgba(108,99,255,0.4)'
                    }}
                  >
                    {loading ? '…' : 'Search'}
                  </motion.button>
                </div>
                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, fontSize: 13, color: '#f87171', lineHeight: 1.5 }}>
                    {error}
                  </motion.div>
                )}
                <div style={{ marginTop: 24, padding: 18, background: 'rgba(167,139,250,0.06)', borderRadius: 16, border: '1px solid rgba(167,139,250,0.15)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>✨ Quick Search Tips</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8 }}>
                    <li><strong>Whole Book:</strong> Type <span style={{ color: '#fff' }}>"Genesis"</span> to open chapter selector.</li>
                    <li><strong>Chapter:</strong> Type <span style={{ color: '#fff' }}>"Psalm 23"</span> or <span style={{ color: '#fff' }}>"Romans 8"</span>.</li>
                    <li><strong>Specific Verse:</strong> Type <span style={{ color: '#fff' }}>"John 3:16"</span> for immediate reading.</li>
                  </ul>
                </div>
              </motion.div>
            )}

            {mode === 'chapterPicker' && activeBook && (
              <motion.div key="chapters" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>
                  Select a chapter from <strong style={{ color: '#fff' }}>{activeBook.name}</strong> ({activeBook.chapters} chapters available):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))', gap: 10 }}>
                  {Array.from({ length: activeBook.chapters }, (_, i) => i + 1).map(num => (
                    <motion.button
                      key={num}
                      whileHover={{ scale: 1.06, backgroundColor: 'rgba(167,139,250,0.2)' }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => pickChapter(num)}
                      disabled={loading}
                      style={{
                        aspectRatio: '1', 
                        borderRadius: 12, 
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(167,139,250,0.25)', 
                        color: '#fff', 
                        fontSize: 14, 
                        fontWeight: 700,
                        cursor: loading ? 'default' : 'pointer', 
                        fontFamily: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                      }}
                    >
                      {num}
                    </motion.button>
                  ))}
                </div>
                {loading && (
                  <div style={{ marginTop: 20, fontSize: 13, color: '#c4b5fd', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <div style={{ width: 14, height: 14, border: '2px solid rgba(167,139,250,0.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Loading chapter text...
                  </div>
                )}
                {error && <div style={{ marginTop: 14, fontSize: 12, color: '#f87171' }}>{error}</div>}
              </motion.div>
            )}

            {mode === 'passage' && result && (
              <motion.div key="passage" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(167,139,250,0.18)', 
                  borderRadius: 20, 
                  padding: '24px 24px',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.3)'
                }}>
                  <div style={{ 
                    fontSize: fontSize, 
                    lineHeight: 1.85, 
                    color: '#f1f5f9', 
                    fontFamily: 'Georgia, serif', 
                    marginBottom: 20,
                    whiteSpace: 'pre-line',
                    letterSpacing: '0.01em'
                  }}>
                    {result.text}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                    <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📖</span> {result.reference} 
                      <span style={{ opacity: 0.5, fontWeight: 500, color: '#fff' }}>· {result.version}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                      Word & Spirit
                    </div>
                  </div>
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
