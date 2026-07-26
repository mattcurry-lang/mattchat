import React from 'react'

const CATEGORIES = [
  { key: 'trending', label: '🔥 Trending' },
  { key: 'forYou', label: '✨ For You' },
  { key: 'music', label: '🎵 Music' },
  { key: 'comedy', label: '😂 Comedy' },
  { key: 'sports', label: '⚽ Sports' },
  { key: 'gaming', label: '🎮 Gaming' },
  { key: 'technology', label: '💻 Tech' },
  { key: 'education', label: '📚 Learn' },
  { key: 'food', label: '🍜 Food' },
  { key: 'travel', label: '✈️ Travel' },
  { key: 'art', label: '🎨 Art' },
]

export default function ShortsCategoryBar({ active, onChange, visible }) {
  return (
    <div style={{
      position: 'absolute', top: 58, left: 0, right: 0, zIndex: 5,
      display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 4px',
      WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-8px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease', pointerEvents: visible ? 'auto' : 'none',
    }}>
      {CATEGORIES.map((c) => (
        <button
          key={c.key}
          onClick={() => onChange(c.key)}
          style={{
            flexShrink: 0, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700,
            padding: '7px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.2s',
            background: active === c.key ? 'rgba(255,255,255,0.95)' : 'rgba(20,20,30,0.4)',
            color: active === c.key ? '#0f0f1a' : '#fff',
            border: `1px solid ${active === c.key ? 'transparent' : 'rgba(255,255,255,0.16)'}`,
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            boxShadow: active === c.key ? '0 4px 16px rgba(255,255,255,0.15)' : 'none',
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}
