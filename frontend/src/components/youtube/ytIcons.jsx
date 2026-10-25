// src/components/youtube/ytIcons.jsx
// Small, consistent line icons (one set, so nothing depends on each device's emoji font).
import React from 'react'

const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const PlayIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z" /></svg>
)
export const SparkIcon = ({ size = 15 }) => (
  <svg {...base} width={size} height={size}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>
)
export const UsersIcon = ({ size = 15 }) => (
  <svg {...base} width={size} height={size}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.4c1.8.8 3 2.6 3 4.6" /></svg>
)
export const ExternalIcon = ({ size = 13 }) => (
  <svg {...base} width={size} height={size}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></svg>
)
export const SearchIcon = ({ size = 18 }) => (
  <svg {...base} width={size} height={size}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
)
export const CloseIcon = ({ size = 14 }) => (
  <svg {...base} width={size} height={size}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const ClockIcon = ({ size = 15 }) => (
  <svg {...base} width={size} height={size}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
)
export const BackIcon = ({ size = 20 }) => (
  <svg {...base} width={size} height={size} strokeWidth={2.2}><path d="M15 5l-7 7 7 7" /></svg>
)
export const MinimizeIcon = ({ size = 15 }) => (
  <svg {...base} width={size} height={size}><rect x="3" y="4" width="18" height="16" rx="3" /><rect x="12" y="12" width="7" height="5" rx="1.4" fill="currentColor" stroke="none" /></svg>
)
export const ExpandIcon = ({ size = 15 }) => (
  <svg {...base} width={size} height={size}><path d="M14 4h6v6M20 4l-7 7" /><path d="M10 20H4v-6M4 20l7-7" /></svg>
)
export const FilmIcon = ({ size = 26 }) => (
  <svg {...base} width={size} height={size} strokeWidth={1.8}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9.5v5l4.2-2.5z" fill="currentColor" stroke="none" /></svg>
)
