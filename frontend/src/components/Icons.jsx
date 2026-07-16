import React from 'react'

/**
 * Small hand-built icon set — no external dependency, so it drops
 * straight into the existing project. Every icon inherits color via
 * `currentColor`, so it automatically matches whatever color the
 * surrounding button already has (including hover/active states).
 */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconSearch({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function IconHome({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

export function IconPhone({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8Z" />
    </svg>
  )
}

export function IconPhoneOff({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M10.7 7.5c0 1.1.2 2.2.5 3.2M13.9 15.8c1 .3 2 .5 3.1.5.6 0 1 .4 1 1V20c0 .6-.4 1-1 1a17 17 0 0 1-8.4-2.7M6.1 6.1C4.9 5 4 3.6 4 3.6" />
      <path d="M4 4c0 6 4 12.5 9.6 15.4" strokeOpacity="0" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

export function IconVideo({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <rect x="2" y="6" width="14" height="12" rx="2.5" />
      <path d="M16 10.3 22 7v10l-6-3.3Z" strokeLinejoin="round" />
    </svg>
  )
}

export function IconCamera({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 8a2 2 0 0 1 2-2h1.3l.9-1.5h7.6L16.7 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="13" r="3.3" />
    </svg>
  )
}

export function IconUser({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.2-3.6 4-5.6 7.5-5.6s6.3 2 7.5 5.6" />
    </svg>
  )
}

export function IconSparkle({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
      <path d="M12 2c.6 2.6 1.3 4.4 2.3 5.6 1.1 1.2 3 1.9 5.7 2.4-2.7.5-4.6 1.2-5.7 2.4-1 1.2-1.7 3-2.3 5.6-.6-2.6-1.3-4.4-2.3-5.6-1.1-1.2-3-1.9-5.7-2.4 2.7-.5 4.6-1.2 5.7-2.4C10.7 6.4 11.4 4.6 12 2Z" />
      <path d="M19 14.5c.3 1.3.7 2.2 1.2 2.8.5.6 1.4 1 2.8 1.2-1.4.3-2.3.6-2.8 1.2-.5.6-.9 1.5-1.2 2.8-.3-1.3-.7-2.2-1.2-2.8-.5-.6-1.4-1-2.8-1.2 1.4-.3 2.3-.6 2.8-1.2.5-.6.9-1.5 1.2-2.8Z" />
    </svg>
  )
}

export function IconMoreVertical({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  )
}

export function IconSmile({ size = 20, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.3 14.3c1 1.2 2.3 1.9 3.7 1.9s2.7-.7 3.7-1.9" />
      <line x1="8.3" y1="10" x2="8.31" y2="10" strokeWidth="2.6" />
      <line x1="15.7" y1="10" x2="15.71" y2="10" strokeWidth="2.6" />
    </svg>
  )
}

export function IconMic({ size = 20, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8.5" y1="22" x2="15.5" y2="22" />
    </svg>
  )
}

export function IconStatus({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="9" strokeDasharray="3.2 3.2" />
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconPlus({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function IconX({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  )
}

export function IconTrash({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 7h16" />
      <path d="M10 7V4h4v3" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </svg>
  )
}

export function IconBluetooth({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M8 7.5 16 15l-4 3.5V5L16 8.5 8 16" />
    </svg>
  )
}

export function IconPause({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

export function IconUserPlus({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-4 3-7 7-7s7 3 7 7" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  )
}

export function IconKeypad({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="6" cy="6" r="1.6" /><circle cx="12" cy="6" r="1.6" /><circle cx="18" cy="6" r="1.6" />
      <circle cx="6" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="12" r="1.6" />
      <circle cx="6" cy="18" r="1.6" /><circle cx="12" cy="18" r="1.6" /><circle cx="18" cy="18" r="1.6" />
    </svg>
  )
}
// ── Communication & content ──────────────────────────────────
export function IconMail({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  )
}

export function IconMessageSquare({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4.5 4V16H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" />
    </svg>
  )
}

export function IconFilm({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="8.5" y1="4" x2="8.5" y2="9" />
      <line x1="8.5" y1="15" x2="8.5" y2="20" />
      <line x1="15.5" y1="4" x2="15.5" y2="9" />
      <line x1="15.5" y1="15" x2="15.5" y2="20" />
    </svg>
  )
}

export function IconBook({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 0 2.5-2.5v-13Z" />
    </svg>
  )
}

export function IconMusic({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0
