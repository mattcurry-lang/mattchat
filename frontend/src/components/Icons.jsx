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
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  )
}

export function IconHeart({ size = 18, filled = false, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} fill={filled ? 'currentColor' : 'none'} {...props}>
      <path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.3c2-.4 4 .5 5.4 2.5 1.4-2 3.4-2.9 5.4-2.5C20 4 21.6 7.6 20 11.1c-2.5 4.8-8 9.4-8 9.4Z" />
    </svg>
  )
}

export function IconLightbulb({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
    </svg>
  )
}

// ── Time & activity ───────────────────────────────────────────
export function IconClock({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

export function IconHistory({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4.5H7.5" />
      <path d="M12 8v4.5l3 2" />
    </svg>
  )
}

export function IconInbox({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M3.5 12h4.2l1.4 2.5h5.8L16.3 12h4.2" />
      <path d="M5 5.5h14L21 12v6.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V12L5 5.5Z" />
    </svg>
  )
}

export function IconBell({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  )
}

// ── Metrics & states ──────────────────────────────────────────
export function IconChart({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="6" y="13" width="3.2" height="7" rx="0.6" />
      <rect x="10.4" y="9" width="3.2" height="11" rx="0.6" />
      <rect x="14.8" y="5" width="3.2" height="15" rx="0.6" />
    </svg>
  )
}

export function IconThermometer({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 14.5V5a2 2 0 1 0-4 0v9.5a4 4 0 1 0 4 0Z" />
      <line x1="10" y1="8" x2="12" y2="8" />
    </svg>
  )
}

export function IconDna({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M7 3c0 4 10 3 10 8s-10 4-10 8" />
      <path d="M17 3c0 4-10 3-10 8s10 4 10 8" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="16" x2="16" y2="16" />
    </svg>
  )
}

export function IconSprout({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 21v-8" />
      <path d="M12 13c0-3.5-2.5-5.5-6-5.5C6 11 8.5 13 12 13Z" />
      <path d="M12 10c0-3 2.2-5 5.5-5C17.5 8 15 10 12 10Z" />
    </svg>
  )
}

export function IconCircleDot({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconBan({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" />
    </svg>
  )
}

// ── Objects & actions ─────────────────────────────────────────
export function IconPin({ size = 18, filled = false, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} fill={filled ? 'currentColor' : 'none'} {...props}>
      <path d="M12 21s-6.5-5.8-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.2-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.2" fill={filled ? '#fff' : 'currentColor'} stroke="none" />
    </svg>
  )
}

export function IconFolder({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v8.5A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11Z" />
    </svg>
  )
}

export function IconReply({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M9 8 4 12l5 4" />
      <path d="M4 12h9a6 6 0 0 1 6 6v1" />
    </svg>
  )
}

export function IconForward({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M15 8l5 4-5 4" />
      <path d="M20 12H11a6 6 0 0 0-6 6v1" />
    </svg>
  )
}

export function IconCopy({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  )
}

export function IconWand({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 20 15 9" />
      <path d="M13 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" strokeLinejoin="round" />
      <line x1="19" y1="14" x2="19" y2="17" />
      <line x1="17.5" y1="15.5" x2="20.5" y2="15.5" />
    </svg>
  )
}

export function IconGlobe({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  )
}

export function IconHelpCircle({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9.5a2.8 2.8 0 1 1 4 2.6c-.8.4-1.2 1-1.2 1.9" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.6" />
    </svg>
  )
}

// ── Weather ────────────────────────────────────────────────────
export function IconSun({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="22" y2="12" />
      <line x1="4.9" y1="4.9" x2="6.6" y2="6.6" />
      <line x1="17.4" y1="17.4" x2="19.1" y2="19.1" />
      <line x1="4.9" y1="19.1" x2="6.6" y2="17.4" />
      <line x1="17.4" y1="6.6" x2="19.1" y2="4.9" />
    </svg>
  )
}

export function IconCloud({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M7 18h10.5a3.5 3.5 0 0 0 .5-6.96A5.5 5.5 0 0 0 7.4 9.1 4 4 0 0 0 7 18Z" />
    </svg>
  )
}

export function IconCloudSun({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M5.5 20h11.3a3.2 3.2 0 0 0 .4-6.4A5 5 0 0 0 8 12.3 3.6 3.6 0 0 0 5.5 20Z" />
      <circle cx="9" cy="6.5" r="2.6" />
      <line x1="9" y1="2" x2="9" y2="3" />
      <line x1="4.6" y1="4.1" x2="5.3" y2="4.8" />
      <line x1="13.4" y1="4.1" x2="12.7" y2="4.8" />
    </svg>
  )
}

export function IconCloudRain({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M6.5 16h11.3a3.2 3.2 0 0 0 .4-6.4A5 5 0 0 0 8.8 8.3 3.6 3.6 0 0 0 6.5 16Z" />
      <line x1="8" y1="19" x2="7" y2="22" />
      <line x1="12" y1="19" x2="11" y2="22" />
      <line x1="16" y1="19" x2="15" y2="22" />
    </svg>
  )
}

export function IconCloudSnow({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M6.5 15h11.3a3.2 3.2 0 0 0 .4-6.4A5 5 0 0 0 8.8 7.3 3.6 3.6 0 0 0 6.5 15Z" />
      <line x1="8" y1="19" x2="8" y2="19.01" strokeWidth="2.6" />
      <line x1="12" y1="20" x2="12" y2="20.01" strokeWidth="2.6" />
      <line x1="16" y1="19" x2="16" y2="19.01" strokeWidth="2.6" />
    </svg>
  )
}

export function IconCloudLightning({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M6.5 14h11.3a3.2 3.2 0 0 0 .4-6.4A5 5 0 0 0 8.8 6.3 3.6 3.6 0 0 0 6.5 14Z" />
      <path d="M13 15l-2.5 4h3L11 22" />
    </svg>
  )
}

export function IconCloudFog({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M6.5 12.5h11.3a3.2 3.2 0 0 0 .4-6.4A5 5 0 0 0 8.8 4.8 3.6 3.6 0 0 0 6.5 12.5Z" />
      <line x1="5" y1="17" x2="19" y2="17" />
      <line x1="5" y1="20" x2="19" y2="20" />
    </svg>
  )
}

export function IconUmbrella({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M3 12a9 9 0 0 1 18 0Z" />
      <line x1="12" y1="12" x2="12" y2="20.5" />
      <path d="M12 20.5a1.8 1.8 0 0 1-3.5 0" />
    </svg>
  )
}

// ── Groups / categories ────────────────────────────────────────
export function IconUsers({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c.7-3.4 3-5.3 6.5-5.3s5.8 1.9 6.5 5.3" />
      <path d="M16 8.2a3.2 3.2 0 1 1 0 6.1" />
      <path d="M17.5 14.8c2.3.6 3.7 2.2 4 5.2" />
    </svg>
  )
}

export function IconBriefcase({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="3" y1="13" x2="21" y2="13" />
    </svg>
  )
}

export function IconGraduationCap({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M2 9l10-4.5L22 9l-10 4.5L2 9Z" strokeLinejoin="round" />
      <path d="M6 11v5c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5v-5" />
    </svg>
  )
}

export function IconHomeFamily({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 10.5v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8" />
      <circle cx="12" cy="14.5" r="1.6" />
      <path d="M9.3 19v-1.2c0-1.3 1.2-2.3 2.7-2.3s2.7 1 2.7 2.3V19" />
    </svg>
  )
}

export function IconCheckSquare({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12.5l2.5 2.5L16 9" />
    </svg>
  )
}

export function IconShield({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3Z" />
      <path d="M9.2 12l1.8 1.8 3.8-3.8" />
    </svg>
  )
}

export function IconLogOut({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export function IconLock({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export function IconSend({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <path d="M22 2 15 22l-4-9-9-4Z" strokeLinejoin="round" />
    </svg>
  )
}

export function IconHourglass({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M6 3h12" /><path d="M6 21h12" />
      <path d="M7 3c0 5 5 6.5 5 9s-5 4-5 9" />
      <path d="M17 3c0 5-5 6.5-5 9s5 4 5 9" />
    </svg>
  )
}

export function IconAlertTriangle({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...props}>
      <path d="M12 4 2.5 20h19L12 4Z" strokeLinejoin="round" />
      <line x1="12" y1="10" x2="12" y2="14.5" />
      <line x1="12" y1="17.2" x2="12.01" y2="17.2" strokeWidth="2.6" />
    </svg>
  )
}

export function IconStar({ size = 18, filled = false, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} fill={filled ? 'currentColor' : 'none'} {...props}>
      <path d="M12 3.5l2.6 5.6 6 .7-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.8l6-.7L12 3.5Z" strokeLinejoin="round" />
    </svg>
  )
}
