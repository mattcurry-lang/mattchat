import React from 'react'

const FRIENDLY_TITLES = {
  comedy: 'Laugh Break',
  sports: "Today's Sports",
  technology: "Today's Tech",
  music: 'Music Break',
  gaming: 'Gaming Right Now',
  food: 'Food Cravings',
  travel: 'Wanderlust',
  art: 'Creative Corner',
  education: 'Learn Something',
  trending: "What's Hot",
}

export default function CollectionsRail({ preferredCategories, onSelect, visible }) {
  if (!preferredCategories || preferredCategories.length === 0) return null
  return (
    <div style={{
      position: 'absolute', top: 100, left: 16, right: 16, zIndex: 5,
      display: 'flex', gap: 8, opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(-6px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease', pointerEvents: visible ? 'auto' : 'none',
    }}>
      {preferredCategories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          style={{
            fontSize: 11.5, fontWeight: 800, color: '#fff', padding: '6px 12px', borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(102,126,234,0.55), rgba(118,75,162,0.55))',
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          ✨ {FRIENDLY_TITLES[cat] || cat}
        </button>
      ))}
    </div>
  )
}
