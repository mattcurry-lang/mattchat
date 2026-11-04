import React, { useState } from 'react'
import { motion } from 'framer-motion'
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
        borderRadius: 24,
        padding: '24px 22px',
        // Added bottom margin so the floating navbar never covers the card content
        marginBottom: '110px', 
        background: 'linear-gradient(135deg, rgba(40, 28, 85, 0.95) 0%, rgba(20, 16, 42, 0.98) 100%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(167,139,250,0.3)',
        boxShadow: isHovered 
          ? '0 24px 50px -12px rgba(108, 99, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
          : '0 14px 35px -10px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Decorative divine glow orb in background */}
      <div style={{
        position: 'absolute',
        top: '-50px',
        right: '-50px',
        width: '140px',
        height: '140px',
        background: 'radial-gradient(circle, rgba(167,139,250,0.25) 0%, rgba(108,99,255,0) 70%)',
        zIndex: 0,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header Tag */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 11.5, 
            fontWeight: 800, 
            color: '#c4b5fd', 
            textTransform: 'uppercase', 
            letterSpacing: '0.09em',
            background: 'rgba(167,139,250,0.15)',
            padding: '5px 12px',
            borderRadius: 20,
            border: '1px solid rgba(167,139,250,0.25)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#a78bfa', boxShadow: '0 0 10px #a78bfa' }} />
            Today's Encouragement
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>✨</div>
        </div>

        {loading ? (
          <div style={{ padding: '20px 0', fontSize: 13, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ width: 16, height: 16, border: '2px solid rgba(167,139,250,0.3)', borderTopColor: '#a78bfa', borderRadius: '50%' }}
            />
            Synchronizing daily passage...
          </div>
        ) : verse ? (
          <div>
            {/* Verse Text */}
            <div style={{ 
              fontSize: 15.5, 
              lineHeight: 1.7, 
              color: '#f8fafc', 
              fontStyle: 'italic', 
              fontFamily: 'Georgia, serif', 
              marginBottom: 12,
              textShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}>
              "{verse.text}"
            </div>

            {/* Verse Reference & Version Badge */}
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
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
                    fontSize: 12.5, 
                    fontWeight: 700, 
                    padding: '9px 18px', 
                    cursor: 'pointer', 
                    fontFamily: 'inherit',
                    boxShadow: '0 4px 16px rgba(108,99,255,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  📖 Read full chapter
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.02, translateY: -1, background: 'rgba(167,139,250,0.25)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowReader(true)}
                style={{ 
                  background: 'rgba(167,139,250,0.12)', 
                  border: '1px solid rgba(167,139,250,0.35)', 
                  borderRadius: 24, 
                  color: '#e2d9f3', 
                  fontSize: 12.5, 
                  fontWeight: 700, 
                  padding: '9px 18px', 
                  cursor: 'pointer', 
                  fontFamily: 'inherit',
                  backdropFilter: 'blur(8px)',
                  transition: 'background 0.2s ease'
                }}
              >
                🔍 Look up a passage
              </motion.button>
            </div>
          </div>
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
