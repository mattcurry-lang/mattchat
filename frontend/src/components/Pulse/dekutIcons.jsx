// src/components/Pulse/dekutIcons.jsx
import React from 'react'

const PATHS = {
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  cap: 'M22 10 12 5 2 10l10 5 10-5Z M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5',
  utensils: 'M7 2v8a2 2 0 0 0 2 2v10 M7 2v6M11 2v6 M17 2c-1.7 0-3 2-3 6s1.3 6 3 6v8',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6',
  calendar: 'M8 2v4M16 2v4M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  wallet: 'M21 12V7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  home: 'M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  heart: 'M12 21s-7-4.4-9.7-8.7C.6 9.2 1.7 5.6 5 4.5c2-.7 4 .1 5 1.8C11 4.6 13 3.8 15 4.5c3.3 1.1 4.4 4.7 2.7 7.8C19 16.6 12 21 12 21Z',
  cpu: 'M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2 M6 6h12v12H6z',
  briefcase: 'M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l4 5V6L6 10H4a1 1 0 0 0-1 1Z M14 8a4 4 0 0 1 0 8 M17 5a8 8 0 0 1 0 14',
  star: 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7-5.4-4.7 7.1-.6Z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 6v6l4 2',
  x: 'M18 6 6 18M6 6l12 12',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35',
  externalLink: 'M7 17 17 7M7 7h10v10',
  chevronRight: 'm9 18 6-6-6-6',
}

export function DekutIcon({ type, size = 20, strokeWidth = 1.8, color = 'white' }) {
  const d = PATHS[type] || PATHS.file
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

export const ICON_GRADIENTS = {
  book: 'linear-gradient(135deg,#a78bfa,#6c63ff)',
  cap: 'linear-gradient(135deg,#facc15,#f59e0b)',
  utensils: 'linear-gradient(135deg,#4ade80,#22c55e)',
  file: 'linear-gradient(135deg,#60a5fa,#3b82f6)',
  calendar: 'linear-gradient(135deg,#fb923c,#f97316)',
  wallet: 'linear-gradient(135deg,#34d399,#10b981)',
  home: 'linear-gradient(135deg,#f472b6,#ec4899)',
  heart: 'linear-gradient(135deg,#fb7185,#e11d48)',
  cpu: 'linear-gradient(135deg,#818cf8,#6366f1)',
  briefcase: 'linear-gradient(135deg,#94a3b8,#64748b)',
  megaphone: 'linear-gradient(135deg,#22d3ee,#06b6d4)',
}
