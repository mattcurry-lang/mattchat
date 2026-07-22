import React from 'react'
import { motion } from 'framer-motion'

// Simple, distinctive glyphs per app — deliberately NOT exact
// reproductions of official trademarked logos (that's Meta's, Google's,
// Slack's, etc. IP). Each is a colored rounded-square badge with a
// small abstract mark, enough to be instantly recognizable in context
// without copying a protected mark pixel-for-pixel.
//
// This pass focuses on making the badges feel premium and consistent:
// - a soft inner highlight + outer shadow so every badge reads with
//   the same "depth" regardless of its base color
// - a hairline border so badges don't blur into dark surfaces
// - a gentle spring hover/tap response wherever a badge sits inside
//   something clickable (harmless no-op where it doesn't)
// - centralized sizing math so icon-to-badge ratio never drifts

function Badge({ color, children, size = 40 }) {
  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        boxShadow: `
          0 1px 2px rgba(0,0,0,0.18),
          0 4px 10px rgba(0,0,0,0.14),
          inset 0 1px 0 rgba(255,255,255,0.18)
        `,
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* soft top-light sheen for a glassier, less flat look */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 45%)',
          pointerEvents: 'none',
        }}
      />
      {children}
    </motion.div>
  )
}

const stroke = { stroke: 'white', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }

export const AppIcon = {
  mattchat: ({ size = 40 }) => (
    <Badge color="linear-gradient(135deg,#667eea,#764ba2)" size={size}>
      <svg width="55%" height="55%" viewBox="0 0 24 24"><path {...stroke} d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-4-1L3 20l1.5-5.5A8.38 8.38 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" /></svg>
    </Badge>
  ),
  gmail: ({ size = 40 }) => (
    <Badge color="linear-gradient(135deg,#ff6f5e,#ea4335)" size={size}>
      <svg width="60%" height="60%" viewBox="0 0 24 24"><path {...stroke} d="M4 6h16v12H4z" /><path {...stroke} d="M4 6l8 7 8-7" /></svg>
    </Badge>
  ),
  instagram: ({ size = 40 }) => (
    <Badge color="linear-gradient(135deg,#f58529,#dd2a7b,#8134af,#515bd4)" size={size}>
      <svg width="60%" height="60%" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" {...stroke} /><circle cx="12" cy="12" r="4" {...stroke} /><circle cx="17.5" cy="6.5" r="1" fill="white" /></svg>
    </Badge>
  ),
  slack: ({ size = 40 }) => (
    <Badge color="linear-gradient(135deg,#6b1d6d,#4a154b)" size={size}>
      <svg width="55%" height="55%" viewBox="0 0 24 24"><rect x="9" y="3" width="3" height="8" rx="1.5" {...stroke} /><rect x="12" y="13" width="3" height="8" rx="1.5" {...stroke} /><rect x="13" y="9" width="8" height="3" rx="1.5" {...stroke} /><rect x="3" y="12" width="8" height="3" rx="1.5" {...stroke} /></svg>
    </Badge>
  ),
  teams: ({ size = 40 }) => (
    <Badge color="linear-gradient(135deg,#6a72e0,#5059c9)" size={size}>
      <svg width="55%" height="55%" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" {...stroke} /><path {...stroke} d="M3 20c0-4 3-6 6-6s6 2 6 6" /><circle cx="17" cy="7" r="2" {...stroke} /></svg>
    </Badge>
  ),
  whatsapp: ({ size = 40 }) => (
    <Badge color="linear-gradient(135deg,#3ddc7c,#25d366)" size={size}>
      <svg width="60%" height="60%" viewBox="0 0 24 24"><path {...stroke} d="M4 20l1.4-4.2A8 8 0 1 1 9 19l-5 1z" /></svg>
    </Badge>
  ),
  messenger: ({ size = 40 }) => (
    <Badge color="linear-gradient(135deg,#00c6ff,#0072ff)" size={size}>
      <svg width="60%" height="60%" viewBox="0 0 24 24"><path {...stroke} d="M12 3C6.5 3 3 6.9 3 12c0 2.8 1.4 5.2 3.6 6.8V21l3.3-1.8c.7.2 1.4.3 2.1.3 5.5 0 9-3.9 9-9S17.5 3 12 3z" /></svg>
    </Badge>
  ),
  telegram: ({ size = 40 }) => (
    <Badge color="linear-gradient(135deg,#4fc3f7,#26a5e4)" size={size}>
      <svg width="60%" height="60%" viewBox="0 0 24 24"><path {...stroke} d="M21 4L3 11l6 2m12-9l-4 16-6-6m10-10L9 13" /></svg>
    </Badge>
  ),
  discord: ({ size = 40 }) => (
    <Badge color="linear-gradient(135deg,#707bf5,#5865f2)" size={size}>
      <svg width="60%" height="60%" viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="11" rx="4" {...stroke} /><circle cx="9" cy="12.5" r="1" fill="white" /><circle cx="15" cy="12.5" r="1" fill="white" /></svg>
    </Badge>
  ),
  tiktok: ({ size = 40 }) => (
    <Badge color="linear-gradient(135deg,#2a2a2a,#000)" size={size}>
      <svg width="55%" height="55%" viewBox="0 0 24 24"><path {...stroke} d="M9 9v8a3 3 0 1 1-3-3" /><path {...stroke} d="M9 3v6a5 5 0 0 0 5 5" /></svg>
    </Badge>
  ),
  linkedin: ({ size = 40 }) => (
    <Badge color="linear-gradient(135deg,#1583e0,#0a66c2)" size={size}>
      <svg width="55%" height="55%" viewBox="0 0 24 24"><rect x="4" y="4" width="4" height="4" rx="1" {...stroke} /><line x1="6" y1="10" x2="6" y2="20" {...stroke} /><path {...stroke} d="M11 20v-6a3 3 0 0 1 6 0v6" /><line x1="11" y1="20" x2="11" y2="10" {...stroke} /></svg>
    </Badge>
  ),
  x: ({ size = 40 }) => (
    <Badge color="linear-gradient(135deg,#2a2a2a,#000)" size={size}>
      <svg width="50%" height="50%" viewBox="0 0 24 24"><path {...stroke} d="M4 4l16 16M20 4L4 20" /></svg>
    </Badge>
  ),
  signal: ({ size = 40 }) => (
    <Badge color="linear-gradient(135deg,#5b8def,#3a76f0)" size={size}>
      <svg width="60%" height="60%" viewBox="0 0 24 24"><path {...stroke} d="M4 20l1.4-4.2A8 8 0 1 1 9 19l-5 1z" /><circle cx="12" cy="12" r="2" fill="white" /></svg>
    </Badge>
  ),
}

export const PLATFORM_META = {
  mattchat:  { label: 'Mattchat',  supportLevel: 'internal' },
  gmail:     { label: 'Gmail',     supportLevel: 'oauth' },
  instagram: { label: 'Instagram', supportLevel: 'oauth' },
  slack:     { label: 'Slack',     supportLevel: 'oauth_planned' },
  teams:     { label: 'Microsoft Teams', supportLevel: 'oauth_planned' },
  whatsapp:  { label: 'WhatsApp',  supportLevel: 'native_only' },
  messenger: { label: 'Messenger', supportLevel: 'native_only' },
  telegram:  { label: 'Telegram',  supportLevel: 'native_only' },
  discord:   { label: 'Discord',   supportLevel: 'native_only' },
  tiktok:    { label: 'TikTok',    supportLevel: 'native_only' },
  linkedin:  { label: 'LinkedIn',  supportLevel: 'native_only' },
  x:         { label: 'X',         supportLevel: 'native_only' },
  signal:    { label: 'Signal',    supportLevel: 'native_only' },
}
