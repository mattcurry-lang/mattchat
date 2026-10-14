import React from 'react'

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

export function IconDisc({ size = 18, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /><path d="M12 2a10 10 0 0 1 8 4" opacity=".5" />
    </svg>
  )
}
export function IconSquareArt({ size = 18, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <rect x="3" y="3" width="18" height="18" rx="3" /><path d="m3 16 5-5 4 4 3-3 6 6" />
    </svg>
  )
}
export function IconMoon({ size = 18, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}
export function IconVolumeX({ size = 18, ...p }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...p}>
      <path d="M11 5 6 9H2v6h4l5 4V5z" /><line x1="22" y1="9" x2="16" y2="15" /><line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  )
}
