import React from 'react'
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
export default function Avatar({ name, size = 38, online = false }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'
  const idx = name ? name.charCodeAt(0) % PALETTE.length : 0
  const [bg, fg] = PALETTE[idx]
  // Dot scales with avatar size instead of a fixed px value, so it
  // reads correctly whether it's a 28px chat-row avatar or a 52px
  // story-rail avatar.
  const dotSize = Math.max(10, Math.round(size * 0.3))
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.36,
        fontWeight: 700,
        flexShrink: 0,
        position: 'relative',
        letterSpacing: '-0.02em',
        userSelect: 'none',
        boxShadow: `0 0 0 2px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1)`,
        fontFamily: "'Inter', sans-serif",
      }}
      className="avatar"
    >
      {initials}
      {online && (
        <span
          className="status-dot"
          style={{ width: dotSize, height: dotSize }}
        />
      )}
    </div>
  )
}
