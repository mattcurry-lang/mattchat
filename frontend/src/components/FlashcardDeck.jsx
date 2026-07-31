import { useState } from 'react'
import { IconX, IconChevronLeft, IconChevronRight } from './Icons'

export default function FlashcardDeck({ cards, title, onClose }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (!cards || cards.length === 0) return null
  const card = cards[index]

  const go = (dir) => {
    setFlipped(false)
    setIndex((i) => Math.max(0, Math.min(cards.length - 1, i + dir)))
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <div style={s.headerTitle}>{title || 'Flashcards'} · {index + 1}/{cards.length}</div>
          <button style={s.iconBtn} onClick={onClose}><IconX size={16} /></button>
        </div>

        <div style={s.cardWrap} onClick={() => setFlipped((v) => !v)}>
          <div style={{ ...s.card, transform: flipped ? 'rotateY(180deg)' : 'none' }}>
            <div style={{ ...s.cardFace, ...s.cardFront }}>
              <div style={s.cardLabel}>Question</div>
              <div style={s.cardText}>{card.front}</div>
              <div style={s.tapHint}>Tap to flip</div>
            </div>
            <div style={{ ...s.cardFace, ...s.cardBack }}>
              <div style={s.cardLabel}>Answer</div>
              <div style={s.cardText}>{card.back}</div>
              <div style={s.tapHint}>Tap to flip back</div>
            </div>
          </div>
        </div>

        <div style={s.navRow}>
          <button style={s.navBtn} disabled={index === 0} onClick={() => go(-1)}><IconChevronLeft size={16} /></button>
          <div style={s.dots}>
            {cards.map((_, i) => (
              <span key={i} style={{ ...s.dot, background: i === index ? '#a78bfa' : 'rgba(255,255,255,0.15)' }} />
            ))}
          </div>
          <button style={s.navBtn} disabled={index === cards.length - 1} onClick={() => go(1)}><IconChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: 'var(--bg-surface-1, #14141f)', borderRadius: 20, padding: 20, width: 'min(420px, 100%)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' },
  iconBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' },
  cardWrap: { perspective: 1000, cursor: 'pointer', height: 220 },
  card: {
    position: 'relative', width: '100%', height: '100%', transition: 'transform 0.5s',
    transformStyle: 'preserve-3d',
  },
  cardFace: {
    position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 16,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: 24, textAlign: 'center', gap: 10,
  },
  cardFront: {
    background: 'linear-gradient(135deg, rgba(102,126,234,0.18), rgba(118,75,162,0.18))',
    border: '1px solid rgba(167,139,250,0.3)',
  },
  cardBack: {
    background: 'linear-gradient(135deg, rgba(118,75,162,0.22), rgba(240,147,251,0.15))',
    border: '1px solid rgba(240,147,251,0.3)', transform: 'rotateY(180deg)',
  },
  cardLabel: { fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, color: '#c4b5fd', textTransform: 'uppercase' },
  cardText: { fontSize: 15, fontWeight: 600, color: '#f1f0f7', lineHeight: 1.5 },
  tapHint: { fontSize: 10.5, color: 'rgba(255,255,255,0.3)', position: 'absolute', bottom: 12 },
  navRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: {
    width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)',
    color: '#c4b5fd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  dots: { display: 'flex', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: '50%' },
}
