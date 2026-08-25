// src/components/Pulse/DekutServiceIcon.jsx
import React from 'react'

const PATHS = {
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  cap: (
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
    </>
  ),
  utensils: (
    <>
      <path d="M7 2v8a2 2 0 0 0 2 2v10" />
      <path d="M7 2v6M11 2v6" />
      <path d="M17 2c-1.7 0-3 2-3 6s1.3 6 3 6v8" />
    </>
  ),
  clipboard: (
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V2.8A1.8 1.8 0 0 1 10.8 1h2.4A1.8 1.8 0 0 1 15 2.8V4" />
      <path d="M9 11h6M9 15h6" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 5-5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  file: (
    <>
      <path d="M6 2h9l5 5v15H6Z" />
      <path d="M15 2v5h5" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 13h4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5-1.3 2-3 2.5-3 1.1-3 2.5 1.3 2.5 3 2.5 3-1.1 3-2.5" />
    </>
  ),
  heart: (
    <>
      <path d="M12 21s-7.5-4.7-10-9C.3 8.6 2 4.5 6 4c2.2-.3 4.2.9 6 3 1.8-2.1 3.8-3.3 6-3 4 .5 5.7 4.6 4 8-2.5 4.3-10 9-10 9Z" />
    </>
  ),
  home: (
    <>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  star: (
    <>
      <path d="M12 3.5 14.6 9l6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.3-4.2 6-.9Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12M18 6 6 18" />
    </>
  ),
  external: (
    <>
      <path d="M7 17 17 7M7 7h10v10" />
    </>
  ),
}

export default function DekutServiceIcon({
  type,
  size = 20,
  stroke = 'white',
  strokeWidth = 1.8,
  filled = false,
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? stroke : 'none'}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[type] || PATHS.file}
    </svg>
  )
}

export const ICON_GRADIENTS = {
  book: 'linear-gradient(135deg,#a78bfa,#6c63ff)',
  cap: 'linear-gradient(135deg,#facc15,#f59e0b)',
  utensils: 'linear-gradient(135deg,#4ade80,#22c55e)',
  clipboard: 'linear-gradient(135deg,#60a5fa,#3b82f6)',
  check: 'linear-gradient(135deg,#34d399,#059669)',
  calendar: 'linear-gradient(135deg,#f472b6,#db2777)',
  file: 'linear-gradient(135deg,#94a3b8,#64748b)',
  archive: 'linear-gradient(135deg,#c084fc,#9333ea)',
  globe: 'linear-gradient(135deg,#38bdf8,#0284c7)',
  card: 'linear-gradient(135deg,#fbbf24,#d97706)',
  coin: 'linear-gradient(135deg,#fde047,#ca8a04)',
  heart: 'linear-gradient(135deg,#fb7185,#e11d48)',
  home: 'linear-gradient(135deg,#2dd4bf,#0d9488)',
}
