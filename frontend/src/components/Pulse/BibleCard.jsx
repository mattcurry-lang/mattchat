import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDailyVerse } from '../../hooks/useDailyVerse'
import BibleReaderModal from './BibleReaderModal'
import FullChapterModal from './FullChapterModal'

export default function BibleCard() {
  const { verse, loading } = useDailyVerse()
  const [showReader, setShowReader] = useState(false)
  const [showFullChapter, setShowFullChapter] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      style={{
        position: 'relative',
        borderRadius: 22,
        padding: '22px 20px',
        background: 'linear-gradient(135deg, rgba(35,24,75,0.85) 0%, rgba(18,15,38,0.95) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(167,139,250,0.25)',
        boxShadow: isHovered 
          ? '0 20px 40px -12px rgba(108, 99, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
          : '0 10px 30px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
      }}
    >
      {/* Ambient background glow orb */}
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '120px',
        height: '120px',
        background: 'radial-gradient(circle, rgba(167,139,250,0.2) 0%, rgba(108,99,255,0) 70%)',
        zIndex: 0,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header Tag */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11, 
            fontWeight: 800, 
            color: '#c4b5fd', 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em',
            background: 'rgba(167,139,250,0.12)',
            padding: '4px 10px',
            borderRadius: 20,
            border: '1px solid rgba(167,139,250,0.2)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#a78bfa', boxShadow: '0 0 8px #a78bfa' }} />
            Today's Encouragement
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '16px 0', fontSize: 13, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ width: 14, height: 14, border: '2px solid rgba(167,139,250,0.3)', borderTopColor: '#a78bfa', borderRadius: '50%' }}
            />
            Synchronizing daily passage...
          </div>
        ) : verse ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={verse.reference}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Verse Text */}
              <div style={{ 
                fontSize: 15, 
                lineHeight: 1.65, 
                color: '#f8fafc', 
                fontStyle: 'italic', 
                fontFamily: 'Georgia, serif', 
                marginBottom: 10,
                textShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}>
                "{verse.text}"
              </div>

              {/* Verse Reference & Version Badge */}
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#a78bfa' }}>✦</span> {verse.reference} 
                <span style={{ opacity: 0.5, fontWeight: 500 }}>· {verse.version}</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {verse.fullText && (
                  <motion.button
                    whileHover={{ scale: 1.02, translateY: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowFullChapter(true)}
                    style={{ 
                      background: 'linear-gradient(135deg, #6c63ff 0%, #a78bfa 100%)', 
                      border: 'none', 
                      borderRadius: 24, 
                      color: '#fff', 
                      fontSize: 12, 
                      fontWeight: 700, 
                      padding: '8px 16px', 
                      cursor: 'pointer', 
                      fontFamily: 'inherit',
                      boxShadow: '0 4px 14px rgba(108,99,255,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    Read full chapter
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.02, translateY: -1, background: 'rgba(167,139,250,0.25)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowReader(true)}
                  style={{ 
                    background: 'rgba(167,139,250,0.12)', 
                    border: '1px solid rgba(167,139,250,0.3)', 
                    borderRadius: 24, 
                    color: '#e2d9f3', 
                    fontSize: 12, 
                    fontWeight: 700, 
                    padding: '8px 16px', 
                    cursor: 'pointer', 
                    fontFamily: 'inherit',
                    backdropFilter: 'blur(8px)',
                    transition: 'background 0.2s ease'
                  }}
                >
                  Look up a passage
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', padding: '12px 0' }}>
            Couldn't load a verse right now. Please check your connection.
          </div>
        )}
      </div>

      {showReader && <BibleReaderModal onClose={() => setShowReader(false)} />}
      {showFullChapter && verse?.fullText && (
        <FullChapterModal
          reference={verse.reference}
          fullText={verse.fullText}
          version={verse.version}
          onClose={() => setShowFullChapter(false)}
        />
      )}
    </motion.div>
  )
}
