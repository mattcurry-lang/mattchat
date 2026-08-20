import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import Avatar from '../Avatar'

const VERSE_CACHE_KEY = 'pulse_bible_verse_cache'

async function loadVerse() {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const cached = JSON.parse(sessionStorage.getItem(VERSE_CACHE_KEY) || 'null')
    if (cached?.date === today) return cached.verse
  } catch {}

  const { data, error } = await supabase.functions.invoke('pulse-bible')
  if (error || !data?.ok) return null

  const verse = { reference: data.reference, text: data.verse_text, version: data.version }
  try { sessionStorage.setItem(VERSE_CACHE_KEY, JSON.stringify({ date: today, verse })) } catch {}
  return verse
}

export default function BirthdayExperience({ profile, onClose }) {
  const [verse, setVerse] = useState(null)
  const [verseLoading, setVerseLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    loadVerse().then((v) => { if (!cancelled) { setVerse(v); setVerseLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const firstName = (profile?.username || 'Friend').split(' ')[0]

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'radial-gradient(circle at 50% 20%, rgba(118,75,162,0.35), rgba(10,10,18,0.97) 65%)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, overflowY: 'auto',
        }}
      >
        {/* ambient floating orbs for depth */}
        <motion.div
          animate={{ y: [0, -18, 0], opacity: [0.4, 0.65, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: '12%', left: '18%', width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(167,139,250,0.28), transparent 70%)', filter: 'blur(30px)',
          }}
        />
        <motion.div
          animate={{ y: [0, 22, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          style={{
            position: 'absolute', bottom: '10%', right: '15%', width: 260, height: 260, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(102,126,234,0.24), transparent 70%)', filter: 'blur(30px)',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          style={{
            position: 'relative', width: 'min(480px, 100%)',
            background: 'linear-gradient(155deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
            border: '1px solid rgba(255,255,255,0.14)', borderRadius: 28, padding: '40px 30px 32px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
            textAlign: 'center',
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: 16, right: 16, width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 4l16 16M20 4L4 20" /></svg>
          </button>

          {/* profile portrait — the centerpiece */}
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'inline-block', position: 'relative', marginBottom: 22 }}
          >
            <div style={{
              position: 'absolute', inset: -14, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(167,139,250,0.5), transparent 70%)', filter: 'blur(18px)',
            }} />
            <div style={{
              position: 'relative', borderRadius: '50%', padding: 4,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.05))',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 20px 40px rgba(0,0,0,0.4)',
            }}>
              <Avatar name={profile?.username} size={104} photoUrl={profile?.avatar_url} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{
              fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', color: '#fff',
              fontFamily: 'inherit', marginBottom: 8,
            }}
          >
            Happy Birthday, {firstName}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: 26 }}
          >
            Today is yours. Here's something to carry with you into another year.
          </motion.div>

          <AnimatePresence mode="wait">
            {verseLoading ? (
              <motion.div key="loading" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)' }}>
                Finding a verse for you…
              </motion.div>
            ) : verse ? (
              <motion.div
                key="verse"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 22, marginTop: 2,
                }}
              >
                <div style={{ fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(196,181,253,0.8)', fontWeight: 700, marginBottom: 12 }}>
                  A blessing for you
                </div>
                <div style={{
                  fontSize: 16.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.94)',
                  fontStyle: 'italic', fontFamily: 'Georgia, serif', marginBottom: 12,
                }}>
                  "{verse.text}"
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
                  {verse.reference} <span style={{ opacity: 0.6 }}>· {verse.version}</span>
                </div>
              </motion.div>
            ) : null /* verse fetch failed entirely — birthday experience still stands on its own */}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
