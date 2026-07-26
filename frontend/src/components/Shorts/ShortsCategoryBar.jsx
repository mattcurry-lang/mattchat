import React from 'react'

const CATEGORIES = [
  { key: 'trending', label: '🔥 Trending' },
  { key: 'forYou', label: '✨ For You' },
  { key: 'music', label: '🎵 Music' },
  { key: 'comedy', label: '😂 Comedy' },
  { key: 'sports', label: '⚽ Sports' },
  { key: 'gaming', label: '🎮 Gaming' },
  { key: 'technology', label: '💻 Technology' },
  { key: 'education', label: '📚 Education' },
  { key: 'food', label: '🍜 Food' },
  { key: 'travel', label: '✈️ Travel' },
  { key: 'art', label: '🎨 Art' },
]

export default function ShortsCategoryBar({ active, onChange }) {
  return (
    <div style={{
      position: 'absolute', top: 12, left: 0, right: 0, zIndex: 5,
      display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px',
      WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
    }}>
      {CATEGORIES.map((c) => (
        <button
          key={c.key}
          onClick={() => onChange(c.key)}
          style={{
            flexShrink: 0, whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 700,
            padding: '7px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
            background: active === c.key ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.35)',
            color: active === c.key ? '#0f0f1a' : '#fff',
            border: `1px solid ${active === c.key ? 'transparent' : 'rgba(255,255,255,0.25)'}`,
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}
