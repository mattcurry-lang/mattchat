import React, { useState } from 'react'
// Carefully picked color pairs [background, foreground] that look great on dark UI
const PALETTE = [
  ['#2d1f7a', '#a78bfa'], // indigo
  ['#0f4c35', '#34d399'], // emerald
  ['#4a1d1d', '#f87171'], // rose
  ['#0c2d5c', '#60a5fa'], // blue
  ['#3d2a00', '#fbbf24'], // amber
  ['#2a0f45', '#e879f9'], // fuchsia
  ['#0a3030', '#2dd4bf'], // teal
]

export default function Avatar({ name, size = 38, online = false, photoUrl = null }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showPhoto = photoUrl && !imgFailed

  const dotSize = Math.max(10, Math.round(size * 0.3))

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: showPhoto ? 'transparent' : '#1a1a2e',
        color: '#6b6b83',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.36,
        fontWeight: 700,
        flexShrink: 0,
        position: 'relative',
        letterSpacing: '-0.02em',
        userSelect: 'none',
        overflow: 'hidden',
        boxShadow: `0 0 0 2px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1)`,
        fontFamily: "'Inter', sans-serif",
      }}
      className="avatar"
    >
      {showPhoto ? (
        <img
          src={photoUrl}
          alt={name || 'avatar'}
          onError={() => setImgFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        /* Stealth Silhouette SVG for Blocked / Hidden Profiles */
        <svg 
          width={size * 0.55} 
          height={size * 0.55} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      )}

      {online && (
        <span
          className="status-dot"
          style={{ width: dotSize, height: dotSize }}
        />
      )}
    </div>
  )
}
