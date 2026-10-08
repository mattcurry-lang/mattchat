import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Avatar from './Avatar'
import AvatarViewer from './AvatarViewer'
import { IconSearch, IconLogOut, IconCamera } from './Icons'
import { shushhhBusy } from './Shushhh/useShushhhRoom'
import ShushhhExperience from './Shushhh/ShushhhExperience'

/*
 * ProfileMenuSheet — hybrid profile page (UI-first, wire later)
 *
 * Borrowed ideas:
 *  WhatsApp  : About, last seen / photo privacy, read receipts, chat lock, disappearing timer,
 *              starred messages, linked devices, chat backup, QR code
 *  Telegram  : profile theme colors, Saved messages, @username, emoji status, sessions
 *  Discord   : presence (online / idle / busy / invisible), custom status with expiry, badges, who can add you
 *  Instagram : 24h notes, account switching
 *  Signal    : screen security, protect IP in calls, disappearing messages
 *  Snapchat  : streaks
 *  iOS/Slack : focus modes, quiet hours
 *
 * Wiring contract (all optional):
 *  features         initial values for any key in DEFAULTS (e.g. { twoStep: true, theme: 'ocean' })
 *  onFeatureChange  (key, value) => void   — fires for every toggle / picker / status edit
 *  onAction         (id, item) => void     — fires for every "nav" row and quick action
 *                                            (if omitted, a "not wired yet" toast shows instead)
 *  shareUrl         string                 — profile link used by QR / share / copy
 *  badges           [{ id, emoji, label, desc, earned }] — overrides the computed badges
 *  stats            { chatsCount, sharedWithCurryCount, connectedCount, streakDays, devicesCount,
 *                     storage: { total, parts: [{ label, gb, color }] } }
 */

// ---- icons ----
const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`
const mk = (...paths) =>
  function Icon({ size = 16 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {paths.map((d, i) => (
          <path key={i} d={d} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
    )
  }

const IconEye = mk('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', circ(12, 12, 3))
const IconEyeOff = mk('M3 3l18 18', 'M10.6 6.2A9.8 9.8 0 0112 6c6.4 0 10 6 10 6a17 17 0 01-3.2 3.9', 'M6.6 7.6A16 16 0 002 12s3.6 6 10 6c1.5 0 2.8-.3 4-.8')
const IconImage = mk('M3 5h18v14H3z', 'M3 16l5-5 4 4 3-3 6 6')
const IconLock = mk('M7 11V8a5 5 0 0110 0v3', 'M5 11h14v10H5z')
const IconShield = mk('M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z', 'M9 12l2 2 4-4')
const IconGlobe = mk(circ(12, 12, 9), 'M3 12h18', 'M12 3c3 3 3 15 0 18', 'M12 3c-3 3-3 15 0 18')
const IconDevices = mk('M2 6h14v9H2z', 'M6 19h6', 'M18 9h4v10h-4z')
const IconTimer = mk(circ(12, 13, 8), 'M12 9v4l2 2', 'M9 2h6')
const IconBookmark = mk('M6 3h12v18l-6-4-6 4V3z')
const IconStar = mk('M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z')
const IconArchive = mk('M3 5h18v4H3z', 'M5 9v10h14V9', 'M10 13h4')
const IconEnter = mk('M20 5v7a2 2 0 01-2 2H5', 'M9 10l-4 4 4 4')
const IconPalette = mk('M12 3a9 9 0 100 18c1.4 0 2-1 1.5-2-.6-1.2.2-2.5 1.6-2.5H17a4 4 0 004-4c0-5-4-9.5-9-9.5z')
const IconBubble = mk('M4 5h16v11H9l-5 4V5z')
const IconType = mk('M5 6V4h14v2', 'M12 4v16', 'M9 20h6')
const IconPlay = mk('M8 5v14l11-7z')
const IconSmile = mk(circ(12, 12, 9), 'M8.5 14a4.5 4.5 0 007 0', 'M9 9.5h.01', 'M15 9.5h.01')
const IconBell = mk('M6 16v-5a6 6 0 0112 0v5l2 2H4l2-2z', 'M10 21h4')
const IconMoon = mk('M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z')
const IconFocus = mk(circ(12, 12, 9), circ(12, 12, 5), 'M12 12h.01')
const IconAt = mk(circ(12, 12, 4), 'M16 12v1.5a2.5 2.5 0 005 0V12a9 9 0 10-3.5 7.1')
const IconVolume = mk('M4 9v6h4l5 4V5L8 9H4z', 'M17 9a4 4 0 010 6')
const IconWifi = mk('M2 9a15 15 0 0120 0', 'M5 12.5a10 10 0 0114 0', 'M8.5 16a5 5 0 017 0', 'M12 19.5h.01')
const IconDownload = mk('M12 4v11', 'M7 11l5 5 5-5', 'M5 20h14')
const IconCloud = mk('M7 18a4 4 0 010-8 5.5 5.5 0 0110.5 1.5A3.3 3.3 0 0117 18H7z')
const IconSwap = mk('M7 7h13l-3-3', 'M17 17H4l3 3')
const IconZap = mk('M13 3L5 14h6l-1 7 8-11h-6l1-7z')
const IconExport = mk('M12 16V4', 'M8 8l4-4 4 4', 'M5 14v6h14v-6')
const IconTrash = mk('M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13')
const IconBan = mk(circ(12, 12, 9), 'M5.6 5.6l12.8 12.8')
const IconQr = mk('M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h2v2h-2z', 'M18 14h2v6h-4', 'M14 18h2v2h-2z')
const IconShare = mk('M12 15V4', 'M8 8l4-4 4 4', 'M5 13v6h14v-6')
const IconEdit = mk('M4 20l4-1 11-11-3-3L5 16l-1 4z', 'M14 6l3 3')
const IconCopy = mk('M9 9h11v11H9z', 'M5 15V4h11')
const IconPlus = mk('M12 5v14', 'M5 12h14')
const IconCheck = mk('M5 12l5 5 9-10')
const IconFlame = mk('M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z')

const IconDatabase = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <ellipse cx="12" cy="5" rx="8" ry="3" stroke="currentColor" strokeWidth={1.8} />
    <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconLifeBuoy = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.8} />
    <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth={1.8} />
    <path d="M6.3 6.3l3.3 3.3M17.7 6.3l-3.3 3.3M6.3 17.7l3.3-3.3M17.7 17.7l-3.3-3.3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
  </svg>
)
const IconUserPlus = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="9" cy="8" r="3.4" stroke="currentColor" strokeWidth={1.8} />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    <path d="M18.5 8v6M15.5 11h6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
  </svg>
)
const IconGift = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="8" width="18" height="13" rx="1.5" stroke="currentColor" strokeWidth={1.8} />
    <path d="M3 12h18M12 8v13" stroke="currentColor" strokeWidth={1.8} />
    <path d="M12 8c-2-4-7-4-7-1 0 2 3 1 7 1zM12 8c2-4 7-4 7-1 0 2-3 1-7 1z"
      stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
  </svg>
)
const IconChevron = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconBack = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconShushhh = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="4" y="3" width="16" height="15" rx="7" stroke="currentColor" strokeWidth={1.8} />
    <circle cx="9" cy="10" r="1.2" fill="currentColor" /><circle cx="15" cy="10" r="1.2" fill="currentColor" />
    <path d="M12 12.5v4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    <path d="M8.5 21v-3M15.5 21v-3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
  </svg>
)

export const PlaceholderIcons = { IconDatabase, IconLifeBuoy, IconUserPlus, IconGift }

// ---- feature data ----
const THEMES = [
  { id: 'violet', label: 'Violet', a: '#6c63ff', b: '#a78bfa' },
  { id: 'ocean', label: 'Ocean', a: '#0ea5e9', b: '#22d3ee' },
  { id: 'aurora', label: 'Aurora', a: '#06b6d4', b: '#8b5cf6' },
  { id: 'sunset', label: 'Sunset', a: '#f97316', b: '#ec4899' },
  { id: 'forest', label: 'Forest', a: '#16a34a', b: '#84cc16' },
  { id: 'gold', label: 'Gold', a: '#d97706', b: '#fbbf24' },
  { id: 'rose', label: 'Rose', a: '#e11d48', b: '#fb7185' },
  { id: 'graphite', label: 'Graphite', a: '#334155', b: '#64748b' },
]
const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0]
const themeGradient = (t) => `linear-gradient(135deg, ${t.a}, ${t.b})`

const DEFAULTS = {
  // identity
  presence: 'online', theme: 'violet', statusEmoji: '', statusText: '', statusClear: 'never', note: '', bio: '',
  // privacy
  lastSeen: 'contacts', photoVis: 'everyone', showOnline: true, readReceipts: true, typing: true, whoCanAdd: 'everyone',
  // security
  chatLock: false, twoStep: false, blockScreenshots: false, hideIp: false,
  // messages
  disappearing: 'off', keepArchived: true, enterToSend: false,
  // appearance
  chatTheme: 'default', bubbleStyle: 'soft', fontSize: 'medium', autoplayMotion: true,
  // notifications
  dnd: false, quietHours: 'off', previews: true, mentionsOnly: false,
  // data
  dataSaver: false, autoDownload: 'wifi',
  // account
  language: 'en', reduceMotion: false,
}

const PICKERS = {
  presence: {
    title: 'Set your presence',
    options: [
      { value: 'online', label: 'Online', desc: 'Friends can see you’re around', color: '#22c55e' },
      { value: 'idle', label: 'Idle', desc: 'Stepped away for a bit', color: '#f59e0b' },
      { value: 'busy', label: 'Busy', desc: 'Quiet notifications, still reachable', color: '#ef4444' },
      { value: 'invisible', label: 'Invisible', desc: 'Appear offline while you keep chatting', color: '#94a3b8' },
    ],
  },
  lastSeen: { title: 'Who can see your last seen', options: [{ value: 'everyone', label: 'Everyone' }, { value: 'contacts', label: 'My contacts' }, { value: 'nobody', label: 'Nobody' }] },
  photoVis: { title: 'Who can see your profile photo', options: [{ value: 'everyone', label: 'Everyone' }, { value: 'contacts', label: 'My contacts' }, { value: 'nobody', label: 'Nobody' }] },
  whoCanAdd: { title: 'Who can add you', options: [{ value: 'everyone', label: 'Everyone' }, { value: 'mutuals', label: 'Friends of friends' }, { value: 'nobody', label: 'Nobody', desc: 'Only people you add yourself' }] },
  disappearing: {
    title: 'Default disappearing timer',
    options: [{ value: 'off', label: 'Off' }, { value: '24h', label: '24 hours' }, { value: '7d', label: '7 days' }, { value: '90d', label: '90 days' }],
  },
  chatTheme: { title: 'Chat theme', options: [{ value: 'default', label: 'Default' }, { value: 'midnight', label: 'Midnight' }, { value: 'aurora', label: 'Aurora' }, { value: 'sunset', label: 'Sunset' }, { value: 'forest', label: 'Forest' }] },
  bubbleStyle: { title: 'Bubble style', options: [{ value: 'soft', label: 'Soft', desc: 'Rounded and friendly' }, { value: 'classic', label: 'Classic' }, { value: 'sharp', label: 'Sharp', desc: 'Squared corners' }] },
  fontSize: { title: 'Text size', options: [{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }] },
  quietHours: { title: 'Quiet hours', options: [{ value: 'off', label: 'Off' }, { value: 'night', label: '10 pm to 7 am', desc: 'Sleep' }, { value: 'class', label: '8 am to 5 pm', desc: 'Class hours' }] },
  autoDownload: { title: 'Auto-download media', options: [{ value: 'wifi', label: 'Wi-Fi only' }, { value: 'both', label: 'Wi-Fi and mobile data' }, { value: 'never', label: 'Never' }] },
  language: { title: 'App language', options: [{ value: 'en', label: 'English' }, { value: 'sw', label: 'Kiswahili' }, { value: 'fr', label: 'Français' }] },
}
const optionLabel = (key, value) => PICKERS[key]?.options.find((o) => o.value === value)?.label ?? ''

const STATUS_PRESETS = [
  { emoji: '📚', text: 'Studying' },
  { emoji: '💻', text: 'Building something' },
  { emoji: '🎧', text: 'Focus time' },
  { emoji: '🍽️', text: 'At lunch' },
  { emoji: '😴', text: 'Sleeping' },
]
const STATUS_EMOJIS = ['📚', '💻', '☕', '🎧', '😴', '🏃', '🍔', '✈️', '🎮', '🙏']
const CLEAR_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: 'today', label: 'Today' },
]

const DEFAULT_STORAGE = {
  total: 5,
  parts: [
    { label: 'Media', gb: 0.8, color: '#8b7dff' },
    { label: 'Documents', gb: 0.25, color: '#22d3ee' },
    { label: 'Voice notes', gb: 0.15, color: '#f59e0b' },
  ],
}

// row builders
const sel = (key, icon, label, subtitle) => ({ id: key, type: 'select', key, icon, label, subtitle })
const tog = (key, icon, label, subtitle) => ({ id: key, type: 'toggle', key, icon, label, subtitle })
const nav = (id, icon, label, subtitle, extra) => ({ id, type: 'nav', icon, label, subtitle, ...extra })

const HYBRID_SECTIONS = [
  {
    id: 'privacy', label: 'Privacy',
    items: [
      sel('lastSeen', <IconEye />, 'Last seen', 'Who can see when you were last active'),
      sel('photoVis', <IconCamera size={16} />, 'Profile photo', 'Who can see your picture'),
      sel('whoCanAdd', <IconUserPlus />, 'Who can add you', 'Control friend requests'),
      tog('showOnline', <IconGlobe />, 'Show when I’m online', 'Turn off to appear offline everywhere'),
      tog('readReceipts', <IconCheck />, 'Read receipts', 'Show when you’ve read a message'),
      tog('typing', <IconBubble />, 'Typing indicator', 'Let people see when you’re typing'),
      nav('blocked', <IconBan />, 'Blocked people', 'Manage who can’t reach you'),
    ],
  },
  {
    id: 'security', label: 'Security',
    items: [
      tog('chatLock', <IconLock />, 'Lock chats with biometrics', 'Fingerprint or face to open private chats'),
      tog('twoStep', <IconShield />, 'Two-step verification', 'Extra PIN when you sign in on a new device'),
      tog('blockScreenshots', <IconEyeOff />, 'Screen security', 'Block screenshots in private chats'),
      tog('hideIp', <IconGlobe />, 'Protect my IP in calls', 'Route calls through Mattchat servers'),
      nav('devices', <IconDevices />, 'Linked devices', 'Phones, tablets and web sessions'),
    ],
  },
  {
    id: 'messages', label: 'Messages',
    items: [
      sel('disappearing', <IconTimer />, 'Disappearing messages', 'Default timer for new chats'),
      nav('saved', <IconBookmark />, 'Saved messages', 'Notes to yourself, synced everywhere'),
      nav('starred', <IconStar />, 'Starred messages', 'Quick access to what matters'),
      nav('archived', <IconArchive />, 'Archived chats', 'Chats you’ve tucked away'),
      tog('keepArchived', <IconArchive />, 'Keep chats archived', 'Stay archived when new messages arrive'),
      tog('enterToSend', <IconEnter />, 'Enter sends message', 'Off lets Enter add a new line'),
    ],
  },
  {
    id: 'appearance', label: 'Chat appearance',
    items: [
      sel('chatTheme', <IconPalette />, 'Chat theme', 'Colors for your conversations'),
      nav('wallpaper', <IconImage />, 'Chat wallpaper', 'Pick or upload a background'),
      sel('bubbleStyle', <IconBubble />, 'Bubble style', 'Shape of message bubbles'),
      sel('fontSize', <IconType />, 'Text size', 'Make messages easier to read'),
      tog('autoplayMotion', <IconPlay />, 'Auto-play GIFs and stickers', 'Pause them to save battery and data'),
      nav('stickers', <IconSmile />, 'Stickers and emoji', 'Packs, favorites and recents'),
    ],
  },
  {
    id: 'notifications', label: 'Notifications and focus',
    items: [
      tog('dnd', <IconBell />, 'Do not disturb', 'Pause all alerts until you turn it off'),
      sel('quietHours', <IconMoon />, 'Quiet hours', 'Mute alerts on a schedule'),
      nav('focus', <IconFocus />, 'Focus modes', 'Study, Sleep, Work — each with its own allowed people'),
      tog('previews', <IconBubble />, 'Message previews', 'Show message text in notifications'),
      tog('mentionsOnly', <IconAt />, 'Mentions only in groups', 'Only alert me when someone @mentions me'),
      nav('sounds', <IconVolume />, 'Sounds and vibration', 'Tones for messages and calls'),
    ],
  },
  {
    id: 'data', label: 'Storage and data',
    items: [
      { id: 'storage', type: 'storage', icon: <IconDatabase />, label: 'Storage', subtitle: 'What Mattchat is using on this device' },
      tog('dataSaver', <IconWifi />, 'Data saver', 'Smaller photos and no auto-play on mobile data'),
      sel('autoDownload', <IconDownload />, 'Auto-download media', 'When photos and files download on their own'),
      nav('manageStorage', <IconTrash />, 'Manage storage', 'Clear large files and old media'),
      nav('backup', <IconCloud />, 'Chat backup', 'Back up and restore your chats'),
    ],
  },
  {
    id: 'account', label: 'Account',
    items: [
      nav('switchAccount', <IconSwap />, 'Add or switch account', 'Use more than one profile'),
      sel('language', <IconGlobe />, 'Language', 'App language'),
      tog('reduceMotion', <IconZap />, 'Reduce motion', 'Fewer animations across the app'),
      nav('export', <IconExport />, 'Export my data', 'Get a copy of your chats and profile'),
      nav('delete', <IconTrash />, 'Delete account', 'Permanently remove your account and data', { tone: 'danger' }),
    ],
  },
]

const pageCss = `
.pm-row { transition: background .12s ease; }
.pm-row:hover { background: var(--chip-bg); }
.pm-btn:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }
.pm-row:focus-visible { outline-offset: -2px; }
.pm-strip { scrollbar-width: none; }
.pm-strip::-webkit-scrollbar { display: none; }
.pm-sw, .pm-sw i { transition: background .18s ease, transform .18s ease; }
.pm-field:focus { border-color: #a78bfa !important; }
@media (prefers-reduced-motion: reduce) {
  .pm-row, .pm-sw, .pm-sw i { transition: none !important; }
}
`

const listVariants = { hidden: {}, show: { transition: { staggerChildren: 0.025, delayChildren: 0.08 } } }
const rowVariants = { hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } } }

function useIsWide(min = 900) {
  const query = `(min-width: ${min}px)`
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = (e) => setWide(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return wide
}

// deterministic placeholder QR (swap for a real QR library when wiring)
function qrPath(seed, n = 25) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  h = h || 1
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296 }
  const finders = [[0, 0], [n - 7, 0], [0, n - 7]]
  let d = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      let on
      let inFinder = false
      for (const [fr, fc] of finders) {
        const dr = r - fr, dc = c - fc
        if (dr >= -1 && dr <= 7 && dc >= -1 && dc <= 7) {
          inFinder = true
          on = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
            (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4))
        }
      }
      if (!inFinder) on = rnd() > 0.52
      if (on) d += `M${c} ${r}h1v1h-1z`
    }
  }
  return d
}

export default function ProfileMenuSheet({
  isOpen, onClose,
  profile, email,
  stats = {},          // { chatsCount, sharedWithCurryCount, connectedCount, streakDays, devicesCount, storage }
  sections = [],       // [{ id, label, items: [{ id, icon, label, subtitle, onClick, tone, badge }] }]
  features,            // initial overrides for DEFAULTS
  onFeatureChange,     // (key, value) => void
  onAction,            // (id, item) => void
  shareUrl,
  badges: badgesProp,
  onAvatarClick,
  onSignOut,
}) {
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  const [shushhhOpen, setShushhhOpen] = useState(false)
  const [sheet, setSheet] = useState(null) // { type: 'picker', key } | { type: 'status' } | { type: 'qr' } | { type: 'theme' }
  const [toast, setToast] = useState(null)
  const [vals, setVals] = useState(() => ({ ...DEFAULTS, bio: profile?.bio || '', ...features }))
  const wide = useIsWide()
  const pageRef = useRef(null)
  const toastTimer = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const viewerOpenRef = useRef(false)
  viewerOpenRef.current = photoViewerOpen
  const sheetRef = useRef(null)
  sheetRef.current = sheet

  useEffect(() => { if (profile?.bio != null) setVals((v) => ({ ...v, bio: profile.bio })) }, [profile?.bio])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }, [])

  const setVal = useCallback((key, value) => {
    setVals((v) => ({ ...v, [key]: value }))
    onFeatureChange?.(key, value)
  }, [onFeatureChange])

  const go = useCallback((id, item) => {
    if (onAction) onAction(id, item)
    else showToast(`${item?.label || 'This'} isn’t wired up yet`)
  }, [onAction, showToast])

  const copy = useCallback(async (text, msg) => {
    try { await navigator.clipboard.writeText(text); showToast(msg) }
    catch { showToast('Couldn’t copy. Select the text and copy it manually.') }
  }, [showToast])

  const name = profile?.username || 'You'
  const handle = profile?.handle || (profile?.username ? profile.username.toLowerCase().replace(/[^a-z0-9_]/g, '') : '') || 'you'
  const link = () => shareUrl || `${window.location.origin}/u/${handle}`

  const share = async () => {
    const url = link()
    try {
      if (navigator.share) { await navigator.share({ title: `${name} on Mattchat`, text: 'Chat with me on Mattchat', url }); return }
    } catch (e) { if (e?.name === 'AbortError') return }
    copy(url, 'Profile link copied')
  }

  const theme = themeById(vals.theme)
  const shownPresence = vals.showOnline ? vals.presence : 'invisible'

  // ---- profile completeness ----
  const tasks = [
    { id: 'photo', label: 'Add a photo', done: !!profile?.avatar_url, run: () => onAvatarClick?.() },
    { id: 'bio', label: 'Write a bio', done: !!vals.bio.trim(), run: () => setSheet({ type: 'status' }) },
    { id: 'status', label: 'Share a status or note', done: !!(vals.statusText || vals.note), run: () => setSheet({ type: 'status' }) },
    { id: 'theme', label: 'Pick a theme', done: vals.theme !== 'violet', run: () => setSheet({ type: 'theme' }) },
    { id: 'secure', label: 'Turn on a lock', done: vals.twoStep || vals.chatLock, run: () => setQuery('Two-step') },
  ]
  const doneCount = tasks.filter((t) => t.done).length
  const pending = tasks.filter((t) => !t.done)

  // ---- badges ----
  const badges = useMemo(() => {
    if (badgesProp) return badgesProp
    const list = [
      { id: 'early', emoji: '🌱', label: 'Early adopter', desc: 'You joined during the first wave of Mattchat.', earned: stats.earlyAdopter ?? true },
      { id: 'curry', emoji: '🍛', label: 'Curry fan', desc: 'Share a chat with Curry to earn this.', earned: (stats.sharedWithCurryCount ?? 0) > 0 },
      { id: 'chatty', emoji: '💬', label: 'Chatterbox', desc: 'Start 10 chats to earn this.', earned: (stats.chatsCount ?? 0) >= 10 },
      { id: 'social', emoji: '🤝', label: 'Connector', desc: 'Connect with 5 people to earn this.', earned: (stats.connectedCount ?? 0) >= 5 },
      { id: 'streak', emoji: '🔥', label: 'On a roll', desc: 'Chat 7 days in a row to earn this.', earned: (stats.streakDays ?? 0) >= 7 },
      { id: 'locked', emoji: '🛡️', label: 'Locked in', desc: 'Turn on two-step verification to earn this.', earned: vals.twoStep },
    ]
    if (profile?.is_admin) list.push({ id: 'team', emoji: '✅', label: 'Mattchat team', desc: 'You’re part of the team.', earned: true })
    return [...list.filter((b) => b.earned), ...list.filter((b) => !b.earned)]
  }, [badgesProp, stats.earlyAdopter, stats.sharedWithCurryCount, stats.chatsCount, stats.connectedCount, stats.streakDays, vals.twoStep, profile?.is_admin])

  // Shushhh gets its own "Hidden" section, appended after everything else.
  const allSections = useMemo(() => [
    ...sections,
    ...HYBRID_SECTIONS,
    {
      id: 'hidden', label: 'Hidden',
      items: [{
        id: 'shushhh', icon: <IconShushhh />, label: 'Shushhh 🤫',
        subtitle: 'A temporary room. Not saved to chat history.', badge: 'New',
        onClick: () => setShushhhOpen(true),
      }],
    },
  ], [sections])

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allSections
    return allSections
      .map((s) => ({
        ...s,
        items: s.items.filter((it) =>
          it.label.toLowerCase().includes(q) || (typeof it.subtitle === 'string' && it.subtitle.toLowerCase().includes(q))),
      }))
      .filter((s) => s.items.length > 0)
  }, [query, allSections])

  useEffect(() => { if (!isOpen) { setQuery(''); setSheet(null) } }, [isOpen])

  // Behave like a real page: Back button / swipe-back closes it, Escape closes it.
  // An open bottom sheet gets Back / Escape first.
  useEffect(() => {
    if (!isOpen) return undefined
    window.history.pushState({ mattchatProfilePage: true }, '')

    const onPop = (e) => {
      if (shushhhBusy.current) return // Shushhh owns Back right now
      e.stopImmediatePropagation() // don't let the chat's own back handler react to this one
      if (sheetRef.current) {
        setSheet(null)
        window.history.pushState({ mattchatProfilePage: true }, '') // keep the page's history entry
        return
      }
      onCloseRef.current?.()
    }
    const onKey = (e) => {
      if (e.key !== 'Escape' || viewerOpenRef.current || shushhhBusy.current) return
      if (sheetRef.current) setSheet(null)
      else onCloseRef.current?.()
    }
    window.addEventListener('popstate', onPop, true)
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => pageRef.current?.focus({ preventScroll: true }))

    return () => {
      window.removeEventListener('popstate', onPop, true)
      window.removeEventListener('keydown', onKey)
      // closed from the screen (not the Back button): remove the extra history entry we added
      if (window.history.state?.mattchatProfilePage) {
        const swallow = (ev) => { ev.stopImmediatePropagation(); window.removeEventListener('popstate', swallow, true) }
        window.addEventListener('popstate', swallow, true)
        window.history.back()
      }
    }
  }, [isOpen])

  if (typeof document === 'undefined') return null

  const storage = stats.storage || DEFAULT_STORAGE
  const pageTransition = reduce ? { duration: 0 } : { type: 'spring', damping: 34, stiffness: 320 }

  const saveStatus = (next) => {
    Object.entries(next).forEach(([k, v]) => { if (vals[k] !== v) setVal(k, v) })
    setSheet(null)
    showToast('Profile updated')
  }

  return createPortal(
    <>
      <style>{pageCss}</style>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="profile-page"
            ref={pageRef}
            tabIndex={-1}
            role="dialog" aria-modal="true" aria-label="Profile"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={pageTransition}
            style={pageStyle}
          >
            {/* sticky page header */}
            <div style={headerStyle}>
              <button className="pm-btn" onClick={onClose} style={backBtnStyle} aria-label="Back"><IconBack /></button>
              <div style={headerTitleStyle}>Profile</div>
              <div style={{ width: 40 }} />
            </div>

            <div style={contentStyle(wide)}>
              {/* identity card */}
              <aside style={asideStyle(wide)}>
                {/* themed banner with note bubble */}
                <div style={bannerStyle(theme)}>
                  <button className="pm-btn" onClick={() => setSheet({ type: 'theme' })} style={bannerBtnStyle} aria-label="Change profile theme" title="Profile theme">
                    <IconPalette size={15} />
                  </button>
                  <button
                    className="pm-btn"
                    onClick={() => setSheet({ type: 'status' })}
                    style={noteBubbleStyle(!!vals.note)}
                    aria-label={vals.note ? 'Edit your note' : 'Add a note'}
                  >
                    {vals.note
                      ? <span style={noteTextStyle}>{vals.note}</span>
                      : <><IconPlus size={13} /><span>Add a note</span></>}
                    {vals.note && <span style={noteTailStyle} />}
                  </button>
                </div>

                <div style={asideBodyStyle}>
                  <div style={{ position: 'relative', width: 104, margin: '-52px auto 0' }}>
                    <button className="pm-btn" onClick={() => setPhotoViewerOpen(true)} style={avatarBtnStyle} title="View profile photo">
                      <div style={avatarRingStyle(theme)}>
                        <Avatar name={profile?.username || email} size={96} photoUrl={profile?.avatar_url} />
                      </div>
                    </button>
                    <span style={presenceDotStyle(shownPresence)} title={optionLabel('presence', shownPresence)} />
                    <button className="pm-btn" onClick={onAvatarClick} style={avatarCameraBadgeStyle(theme)} title="Change profile picture" aria-label="Change profile picture">
                      <IconCamera size={13} />
                    </button>
                  </div>

                  <div style={heroNameRowStyle}>
                    <span style={heroNameStyle}>{name}</span>
                    {profile?.is_admin && (
                      <span style={adminBadgeStyle(theme)} title="Mattchat Team">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </div>

                  <button className="pm-btn" onClick={() => copy(`@${handle}`, 'Username copied')} style={handleBtnStyle} title="Copy username">
                    <span>@{handle}</span><IconCopy size={12} />
                  </button>
                  <div style={heroEmailStyle}>{email}</div>

                  {/* presence + custom status */}
                  <div style={chipRowStyle}>
                    <button className="pm-btn" onClick={() => setSheet({ type: 'picker', key: 'presence' })} style={pillBtnStyle}>
                      <span style={miniDotStyle(shownPresence)} />
                      {optionLabel('presence', shownPresence)}
                      <span style={{ display: 'flex', transform: 'rotate(90deg)', opacity: 0.7 }}><IconChevron size={11} /></span>
                    </button>
                    <button className="pm-btn" onClick={() => setSheet({ type: 'status' })} style={pillBtnStyle}>
                      {vals.statusText || vals.statusEmoji
                        ? <><span>{vals.statusEmoji || '💭'}</span><span style={pillTextStyle}>{vals.statusText || 'Status'}</span></>
                        : <><IconSmile size={14} /><span>Set a status</span></>}
                    </button>
                  </div>

                  {vals.bio.trim() ? (
                    <button className="pm-btn" onClick={() => setSheet({ type: 'status' })} style={bioStyle}>{vals.bio}</button>
                  ) : null}

                  <div style={statRowStyle}>
                    <StatChip value={stats.chatsCount ?? 0} label="Chats" />
                    <StatChip value={stats.sharedWithCurryCount ?? 0} label="With Curry" accent />
                    <StatChip value={stats.connectedCount ?? 0} label="Connected" />
                    {(stats.streakDays ?? 0) > 0 && <StatChip value={stats.streakDays} label="Day streak" flame />}
                  </div>

                  {/* quick actions */}
                  <div style={quickGridStyle}>
                    <QuickAction icon={<IconQr size={18} />} label="My QR" onClick={() => setSheet({ type: 'qr' })} />
                    <QuickAction icon={<IconShare size={18} />} label="Share" onClick={share} />
                    <QuickAction icon={<IconEdit size={18} />} label="Edit" onClick={() => setSheet({ type: 'status' })} />
                    <QuickAction icon={<IconUserPlus size={18} />} label="Invite" onClick={() => go('invite', { label: 'Invite friends' })} />
                  </div>

                  {/* completeness */}
                  {pending.length > 0 && (
                    <div style={completeCardStyle}>
                      <div style={completeHeadStyle}>
                        <span style={{ fontWeight: 750, color: 'var(--dark-text)' }}>Finish your profile</span>
                        <span style={{ color: 'var(--dark-text-3)' }}>{doneCount} of {tasks.length}</span>
                      </div>
                      <div style={progressTrackStyle}>
                        <motion.div
                          style={progressFillStyle(theme)}
                          initial={false}
                          animate={{ width: `${(doneCount / tasks.length) * 100}%` }}
                          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 26 }}
                        />
                      </div>
                      <div style={taskWrapStyle}>
                        {pending.map((t) => (
                          <button key={t.id} className="pm-btn" onClick={t.run} style={taskChipStyle}>
                            <IconPlus size={11} />{t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* badges */}
                  <div style={badgeHeadStyle}>Badges</div>
                  <div className="pm-strip" style={badgeStripStyle}>
                    {badges.map((b) => (
                      <button
                        key={b.id}
                        className="pm-btn"
                        onClick={() => showToast(b.earned ? `${b.label}: ${b.desc}` : b.desc)}
                        style={badgeStyle(b.earned)}
                        title={b.desc}
                        aria-label={`${b.label}${b.earned ? '' : ' (locked)'}`}
                      >
                        <span style={{ fontSize: 22, filter: b.earned ? 'none' : 'grayscale(1)' }}>{b.emoji}</span>
                        <span style={badgeLabelStyle}>{b.label}</span>
                      </button>
                    ))}
                  </div>

                  <button className="pm-btn" onClick={onAvatarClick} style={changePhotoBtnStyle}>
                    <IconCamera size={14} /> Change profile picture
                  </button>
                </div>
              </aside>

              {/* settings */}
              <main style={{ minWidth: 0 }}>
                <div style={searchWrapStyle}>
                  <IconSearch size={14} style={{ color: 'var(--dark-text-3)', flexShrink: 0 }} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search settings..."
                    aria-label="Search settings"
                    style={searchInputStyle}
                  />
                  {query && (
                    <button className="pm-btn" onClick={() => setQuery('')} style={clearSearchStyle} aria-label="Clear search">×</button>
                  )}
                </div>

                {filteredSections.map((section) => (
                  <div key={section.id} style={{ marginBottom: 4 }}>
                    <div style={sectionLabelStyle}>{section.label}</div>
                    <motion.div variants={listVariants} initial={reduce ? false : 'hidden'} animate="show" style={sectionCardStyle}>
                      {section.items.map((item, i) => (
                        <Row
                          key={item.id}
                          item={item}
                          last={i === section.items.length - 1}
                          vals={vals}
                          storage={storage}
                          reduce={reduce}
                          onPick={(key) => setSheet({ type: 'picker', key })}
                          onToggle={(key) => setVal(key, !vals[key])}
                          onNav={(it) => (it.onClick ? it.onClick() : go(it.id, it))}
                        />
                      ))}
                    </motion.div>
                  </div>
                ))}

                {filteredSections.length === 0 && <div style={emptyStateStyle}>No settings match "{query}"</div>}

                <button className="pm-btn" onClick={onSignOut} style={signOutBtnStyle}>
                  <IconLogOut size={15} /> Sign out
                </button>
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- bottom sheets ---- */}
      <BottomSheet
        open={isOpen && sheet?.type === 'picker'}
        title={sheet?.type === 'picker' ? PICKERS[sheet.key]?.title : ''}
        onClose={() => setSheet(null)}
        reduce={reduce}
      >
        {sheet?.type === 'picker' && (
          <div style={pickerListStyle}>
            {PICKERS[sheet.key].options.map((o) => {
              const selected = vals[sheet.key] === o.value
              return (
                <button
                  key={o.value}
                  className="pm-btn pm-row"
                  onClick={() => { setVal(sheet.key, o.value); setSheet(null) }}
                  style={pickerRowStyle}
                  role="radio" aria-checked={selected}
                >
                  {o.color && <span style={{ ...miniDotStyle(o.value), width: 12, height: 12 }} />}
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <span style={pickerLabelStyle}>{o.label}</span>
                    {o.desc && <span style={rowSubtitleStyle}>{o.desc}</span>}
                  </span>
                  {selected && <span style={{ color: 'var(--brand-light)', display: 'flex' }}><IconCheck size={18} /></span>}
                </button>
              )
            })}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={isOpen && sheet?.type === 'theme'} title="Profile theme" onClose={() => setSheet(null)} reduce={reduce}>
        <div style={themeGridStyle}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              className="pm-btn"
              onClick={() => { setVal('theme', t.id); setSheet(null) }}
              style={themeSwatchStyle(t, vals.theme === t.id)}
              aria-label={t.label}
              aria-pressed={vals.theme === t.id}
            >
              {vals.theme === t.id && <IconCheck size={20} />}
              <span style={themeNameStyle}>{t.label}</span>
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={isOpen && sheet?.type === 'qr'} title="My QR code" onClose={() => setSheet(null)} reduce={reduce}>
        {sheet?.type === 'qr' && (
          <div style={{ textAlign: 'center' }}>
            <div style={qrCardStyle(theme)}>
              <svg viewBox="0 0 25 25" width="100%" height="100%" shapeRendering="crispEdges" role="img" aria-label="Your profile QR code">
                <path d={qrPath(`${handle}|${link()}`)} fill="#111827" />
              </svg>
            </div>
            <div style={{ ...heroNameStyle, marginTop: 14 }}>{name}</div>
            <div style={{ ...heroEmailStyle, marginBottom: 16 }}>@{handle}</div>
            <div style={qrBtnRowStyle}>
              <button className="pm-btn" onClick={share} style={primaryBtnStyle(theme)}><IconShare size={15} /> Share link</button>
              <button className="pm-btn" onClick={() => copy(link(), 'Profile link copied')} style={secondaryBtnStyle}><IconCopy size={15} /> Copy link</button>
            </div>
            <button className="pm-btn" onClick={() => go('scanQr', { label: 'Scan a code' })} style={{ ...secondaryBtnStyle, width: '100%', marginTop: 8 }}>
              <IconQr size={15} /> Scan a code
            </button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={isOpen && sheet?.type === 'status'} title="Edit your status" onClose={() => setSheet(null)} reduce={reduce}>
        {sheet?.type === 'status' && <StatusForm vals={vals} theme={theme} onSave={saveStatus} />}
      </BottomSheet>

      {/* toast */}
      <AnimatePresence>
        {isOpen && toast && (
          <motion.div
            key={toast}
            role="status"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            style={{ ...toastStyle, x: '-50%' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {isOpen && (
        <AvatarViewer
          isOpen={photoViewerOpen}
          onClose={() => setPhotoViewerOpen(false)}
          photoUrl={profile?.avatar_url}
          name={name}
          subtitle={email}
        />
      )}

      {/* Mounted only while open => fresh topic + empty state every time */}
      {shushhhOpen && profile?.id && (
        <ShushhhExperience me={profile.id} onClose={() => setShushhhOpen(false)} />
      )}
    </>,
    document.body
  )
}

// ---- pieces ----
function StatChip({ value, label, accent, flame }) {
  return (
    <div style={{ ...statChipStyle, ...(accent ? statChipAccentStyle : null), ...(flame ? statChipFlameStyle : null) }}>
      <div style={statChipValueStyle}>
        {flame && <span style={{ color: '#f97316', display: 'inline-flex', marginRight: 2, verticalAlign: '-2px' }}><IconFlame size={14} /></span>}
        {value}
      </div>
      <div style={statChipLabelStyle}>{label}</div>
    </div>
  )
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button className="pm-btn pm-row" onClick={onClick} style={quickBtnStyle}>
      <span style={quickIconStyle}>{icon}</span>
      <span style={quickLabelStyle}>{label}</span>
    </button>
  )
}

function Switch({ on }) {
  return (
    <span className="pm-sw" style={switchTrackStyle(on)} aria-hidden="true">
      <i style={switchThumbStyle(on)} />
    </span>
  )
}

function StorageMeter({ storage }) {
  const total = storage.total || 5
  const used = storage.used ?? storage.parts.reduce((s, p) => s + p.gb, 0)
  return (
    <div style={{ padding: '4px 0 2px' }}>
      <div style={storageBarStyle} role="img" aria-label={`${used.toFixed(1)} GB of ${total} GB used`}>
        {storage.parts.map((p) => (
          <span key={p.label} style={{ width: `${Math.min(100, (p.gb / total) * 100)}%`, background: p.color, height: '100%' }} />
        ))}
      </div>
      <div style={storageLegendStyle}>
        {storage.parts.map((p) => (
          <span key={p.label} style={storageLegendItemStyle}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
            {p.label} {p.gb.toFixed(2).replace(/0$/, '')} GB
          </span>
        ))}
      </div>
    </div>
  )
}

function Row({ item, last, vals, storage, reduce, onPick, onToggle, onNav }) {
  const type = item.type || 'nav'
  const danger = item.tone === 'danger'
  const border = last ? 'none' : '1px solid var(--dark-border)'
  const iconEl = (
    <span style={{ ...rowIconStyle, color: danger ? '#f87171' : 'var(--brand-light)' }}>{item.icon}</span>
  )

  if (type === 'storage') {
    return (
      <motion.div variants={rowVariants} style={{ ...rowStyle, borderBottom: border, cursor: 'default', alignItems: 'flex-start' }}>
        {iconEl}
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <span style={{ ...rowLabelStyle, color: 'var(--dark-text)' }}>
            {item.label}
            <span style={storageTotalStyle}>
              {(storage.used ?? storage.parts.reduce((s, p) => s + p.gb, 0)).toFixed(1)} of {storage.total} GB
            </span>
          </span>
          <StorageMeter storage={storage} />
        </span>
      </motion.div>
    )
  }

  const onClick = type === 'toggle' ? () => onToggle(item.key) : type === 'select' ? () => onPick(item.key) : () => onNav(item)

  return (
    <motion.button
      className="pm-row pm-btn"
      variants={rowVariants}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      onClick={onClick}
      role={type === 'toggle' ? 'switch' : undefined}
      aria-checked={type === 'toggle' ? !!vals[item.key] : undefined}
      style={{ ...rowStyle, borderBottom: border }}
    >
      {iconEl}
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={{ ...rowLabelStyle, color: danger ? '#f87171' : 'var(--dark-text)' }}>{item.label}</span>
        {item.subtitle && <span style={rowSubtitleStyle}>{item.subtitle}</span>}
      </span>
      {item.badge && <span style={rowBadgeStyle}>{item.badge}</span>}
      {type === 'toggle' && <Switch on={!!vals[item.key]} />}
      {type === 'select' && <span style={rowValueStyle}>{optionLabel(item.key, vals[item.key])}</span>}
      {type !== 'toggle' && <IconChevron size={14} />}
    </motion.button>
  )
}

function BottomSheet({ open, title, onClose, reduce, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet-root"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
          onClick={onClose}
          style={sheetRootStyle}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={reduce ? { duration: 0 } : { type: 'spring', damping: 34, stiffness: 380 }}
            onClick={(e) => e.stopPropagation()}
            style={sheetStyle}
          >
            <div style={grabberStyle} />
            <div style={sheetTitleStyle}>{title}</div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function StatusForm({ vals, theme, onSave }) {
  const [emoji, setEmoji] = useState(vals.statusEmoji)
  const [text, setText] = useState(vals.statusText)
  const [clear, setClear] = useState(vals.statusClear)
  const [note, setNote] = useState(vals.note)
  const [bio, setBio] = useState(vals.bio)

  const hasAny = emoji || text || note || bio
  const wipe = () => { setEmoji(''); setText(''); setNote(''); setClear('never') }

  return (
    <div>
      <div style={fieldLabelStyle}>Status</div>
      <div style={statusInputRowStyle}>
        <span style={statusEmojiBoxStyle}>{emoji || '💭'}</span>
        <input
          className="pm-field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={40}
          placeholder="What are you up to?"
          aria-label="Status text"
          style={fieldStyle}
        />
      </div>
      <div className="pm-strip" style={emojiStripStyle}>
        {STATUS_EMOJIS.map((em) => (
          <button
            key={em} className="pm-btn"
            onClick={() => setEmoji(emoji === em ? '' : em)}
            style={emojiBtnStyle(emoji === em)}
            aria-pressed={emoji === em}
            aria-label={`Use ${em}`}
          >{em}</button>
        ))}
      </div>
      <div style={taskWrapStyle}>
        {STATUS_PRESETS.map((p) => (
          <button key={p.text} className="pm-btn" onClick={() => { setEmoji(p.emoji); setText(p.text) }} style={taskChipStyle}>
            {p.emoji} {p.text}
          </button>
        ))}
      </div>

      <div style={fieldLabelStyle}>Clear status after</div>
      <div style={segmentStyle} role="radiogroup" aria-label="Clear status after">
        {CLEAR_OPTIONS.map((o) => (
          <button
            key={o.value} className="pm-btn" role="radio" aria-checked={clear === o.value}
            onClick={() => setClear(o.value)} style={segmentBtnStyle(clear === o.value, theme)}
          >{o.label}</button>
        ))}
      </div>

      <div style={fieldLabelStyle}>
        Note <span style={fieldHintStyle}>Friends see it for 24 hours</span>
      </div>
      <input
        className="pm-field"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={60}
        placeholder="Share a thought"
        aria-label="Note"
        style={fieldStyle}
      />

      <div style={fieldLabelStyle}>
        Bio <span style={fieldHintStyle}>{bio.length}/120</span>
      </div>
      <textarea
        className="pm-field"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={120}
        rows={3}
        placeholder="Tell people a little about you"
        aria-label="Bio"
        style={{ ...fieldStyle, resize: 'none', lineHeight: 1.4 }}
      />

      <div style={qrBtnRowStyle}>
        {hasAny && <button className="pm-btn" onClick={wipe} style={secondaryBtnStyle}>Clear status and note</button>}
        <button
          className="pm-btn"
          onClick={() => onSave({ statusEmoji: emoji, statusText: text.trim(), statusClear: clear, note: note.trim(), bio: bio.trim() })}
          style={primaryBtnStyle(theme)}
        >Save changes</button>
      </div>
    </div>
  )
}

// ---- styles ----
const presenceColors = { online: '#22c55e', idle: '#f59e0b', busy: '#ef4444', invisible: '#94a3b8' }

const pageStyle = {
  position: 'fixed', inset: 0, zIndex: 61,
  overflowY: 'auto', overscrollBehavior: 'contain',
  background: 'var(--bg-surface-1, #0f0f1a)', outline: 'none',
}

const headerStyle = {
  position: 'sticky', top: 0, zIndex: 2,
  display: 'flex', alignItems: 'center', gap: 8,
  padding: 'max(10px, env(safe-area-inset-top, 0px)) 12px 10px',
  background: 'var(--dark-card-2)', borderBottom: '1px solid var(--dark-border)',
  backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
}
const backBtnStyle = { width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--chip-bg)', color: 'var(--dark-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }
const headerTitleStyle = { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--dark-text)' }

const contentStyle = (wide) => ({
  maxWidth: 980, margin: '0 auto',
  padding: wide ? '24px 24px 60px' : '14px 14px calc(40px + env(safe-area-inset-bottom, 0px))',
  display: wide ? 'grid' : 'flex',
  flexDirection: 'column', gap: wide ? 24 : 14,
  gridTemplateColumns: wide ? '320px minmax(0, 1fr)' : undefined,
  alignItems: 'start',
})
const asideStyle = (wide) => ({
  width: '100%', boxSizing: 'border-box', textAlign: 'center',
  background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 20,
  overflow: wide ? 'auto' : 'hidden',
  position: wide ? 'sticky' : 'static', top: wide ? 76 : undefined,
  maxHeight: wide ? 'calc(100vh - 100px)' : undefined,
})
const asideBodyStyle = { padding: '0 18px 18px' }

const bannerStyle = (t) => ({
  position: 'relative', height: 92,
  backgroundImage: `radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1.6px), ${themeGradient(t)}`,
  backgroundSize: '14px 14px, auto',
})
const bannerBtnStyle = {
  position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.28)', color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
  backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
}
const noteBubbleStyle = (filled) => ({
  position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
  maxWidth: 'calc(100% - 110px)', display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 12px', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 650,
  ...(filled
    ? { background: 'var(--dark-card)', color: 'var(--dark-text)', border: '1px solid var(--dark-border)', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }
    : { background: 'rgba(0,0,0,0.22)', color: '#fff', border: '1px dashed rgba(255,255,255,0.6)' }),
})
const noteTextStyle = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const noteTailStyle = {
  position: 'absolute', bottom: -5, left: '50%', width: 10, height: 10, marginLeft: -5,
  background: 'var(--dark-card)', borderRight: '1px solid var(--dark-border)', borderBottom: '1px solid var(--dark-border)',
  transform: 'rotate(45deg)',
}

const avatarBtnStyle = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'block', borderRadius: '50%' }
const avatarRingStyle = (t) => ({ borderRadius: '50%', padding: 3, background: themeGradient(t), display: 'inline-block', boxShadow: '0 0 0 4px var(--dark-card)' })
const avatarCameraBadgeStyle = (t) => ({
  position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: '50%',
  background: themeGradient(t), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '3px solid var(--dark-card)', padding: 0, cursor: 'pointer',
})
const presenceDotStyle = (kind) => ({
  position: 'absolute', bottom: 6, left: 6, width: 20, height: 20, borderRadius: '50%', boxSizing: 'border-box',
  border: '4px solid var(--dark-card)',
  background: kind === 'invisible' ? 'var(--dark-card)' : presenceColors[kind],
  boxShadow: kind === 'invisible' ? `inset 0 0 0 2px ${presenceColors.invisible}` : 'none',
})
const miniDotStyle = (kind) => ({
  width: 9, height: 9, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
  background: kind === 'invisible' ? 'transparent' : presenceColors[kind],
  border: kind === 'invisible' ? `2px solid ${presenceColors.invisible}` : 'none',
})

const heroNameRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }
const heroNameStyle = { fontSize: 20, fontWeight: 800, color: 'var(--dark-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const adminBadgeStyle = (t) => ({ width: 16, height: 16, borderRadius: '50%', background: themeGradient(t), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 })
const handleBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: 'var(--brand-light)', fontSize: 13.5, fontWeight: 650, cursor: 'pointer', fontFamily: 'inherit', padding: '2px 6px', marginTop: 2, borderRadius: 8 }
const heroEmailStyle = { fontSize: 12.5, color: 'var(--dark-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }

const chipRowStyle = { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 }
const pillBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', padding: '6px 11px', borderRadius: 999, border: '1px solid var(--dark-border)', background: 'var(--chip-bg)', color: 'var(--dark-text)', fontSize: 12.5, fontWeight: 650, cursor: 'pointer', fontFamily: 'inherit' }
const pillTextStyle = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }
const bioStyle = { display: 'block', width: '100%', marginTop: 12, padding: '4px 6px', border: 'none', background: 'none', color: 'var(--dark-text-2)', fontSize: 13.5, lineHeight: 1.45, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', borderRadius: 8 }

const statRowStyle = { display: 'flex', gap: 8, marginTop: 16 }
const statChipStyle = { flex: 1, minWidth: 0, background: 'var(--chip-bg)', borderRadius: 14, padding: '9px 6px', textAlign: 'center', border: '1px solid var(--dark-border)' }
const statChipAccentStyle = { background: 'var(--brand-soft)', border: '1px solid rgba(108,99,255,0.3)' }
const statChipFlameStyle = { background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)' }
const statChipValueStyle = { fontSize: 17, fontWeight: 800, color: 'var(--dark-text)', lineHeight: 1.1 }
const statChipLabelStyle = { fontSize: 10.5, fontWeight: 600, color: 'var(--dark-text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

const quickGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 14 }
const quickBtnStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 4px', borderRadius: 14, border: '1px solid var(--dark-border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--dark-text)' }
const quickIconStyle = { color: 'var(--brand-light)', display: 'flex' }
const quickLabelStyle = { fontSize: 11.5, fontWeight: 650 }

const completeCardStyle = { marginTop: 14, padding: 12, borderRadius: 14, background: 'var(--chip-bg)', border: '1px solid var(--dark-border)', textAlign: 'left' }
const completeHeadStyle = { display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }
const progressTrackStyle = { height: 6, borderRadius: 999, background: 'var(--dark-border)', marginTop: 8, overflow: 'hidden' }
const progressFillStyle = (t) => ({ height: '100%', borderRadius: 999, background: themeGradient(t) })
const taskWrapStyle = { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }
const taskChipStyle = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, border: '1px solid var(--dark-border)', background: 'var(--dark-card)', color: 'var(--dark-text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }

const badgeHeadStyle = { textAlign: 'left', fontSize: 12.5, fontWeight: 700, color: 'var(--dark-text-2)', margin: '16px 2px 8px' }
const badgeStripStyle = { display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -18px', padding: '2px 18px 4px' }
const badgeStyle = (earned) => ({
  flexShrink: 0, width: 78, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 6px',
  borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
  border: earned ? '1px solid rgba(108,99,255,0.35)' : '1px dashed var(--dark-border)',
  background: earned ? 'var(--brand-soft)' : 'transparent', opacity: earned ? 1 : 0.55,
})
const badgeLabelStyle = { fontSize: 10.5, fontWeight: 650, color: 'var(--dark-text)', lineHeight: 1.15, textAlign: 'center' }

const changePhotoBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 14,
  padding: '10px 0', borderRadius: 12, border: '1px solid var(--dark-border)', background: 'var(--chip-bg)',
  color: 'var(--dark-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

const searchWrapStyle = {
  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
  padding: '10px 12px', borderRadius: 12,
  background: 'var(--dark-card)', border: '1px solid var(--dark-border)',
}
const searchInputStyle = { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--dark-text)', fontFamily: 'inherit' }
const clearSearchStyle = { border: 'none', background: 'var(--chip-bg)', color: 'var(--dark-text-2)', width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }

const sectionLabelStyle = { fontSize: 12.5, fontWeight: 700, color: 'var(--dark-text-3)', margin: '16px 4px 6px' }
const sectionCardStyle = { background: 'var(--dark-card)', borderRadius: 16, border: '1px solid var(--dark-border)', overflow: 'hidden' }

const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box', padding: '13px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--dark-text-3)' }
const rowIconStyle = { width: 32, height: 32, borderRadius: 10, background: 'var(--chip-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const rowLabelStyle = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, fontSize: 14, fontWeight: 650 }
const rowSubtitleStyle = { display: 'block', fontSize: 11.5, color: 'var(--dark-text-3)', marginTop: 1 }
const rowBadgeStyle = { fontSize: 10.5, fontWeight: 700, color: 'var(--brand-light)', background: 'var(--brand-soft)', borderRadius: 8, padding: '2px 7px', flexShrink: 0 }
const rowValueStyle = { fontSize: 12.5, fontWeight: 600, color: 'var(--dark-text-2)', flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const switchTrackStyle = (on) => ({
  position: 'relative', width: 40, height: 24, borderRadius: 999, flexShrink: 0, display: 'block',
  background: on ? 'var(--brand-grad)' : 'var(--chip-bg)',
  border: on ? '1px solid transparent' : '1px solid var(--dark-border)', boxSizing: 'border-box',
})
const switchThumbStyle = (on) => ({
  position: 'absolute', top: 2, left: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.35)', transform: on ? 'translateX(16px)' : 'translateX(0)',
})

const storageTotalStyle = { fontSize: 12, fontWeight: 600, color: 'var(--dark-text-2)' }
const storageBarStyle = { display: 'flex', height: 8, borderRadius: 999, background: 'var(--dark-border)', overflow: 'hidden', gap: 2, marginTop: 8 }
const storageLegendStyle = { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }
const storageLegendItemStyle = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--dark-text-3)' }

const emptyStateStyle = { textAlign: 'center', color: 'var(--dark-text-3)', fontSize: 13, padding: '30px 0' }

const signOutBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
  marginTop: 18, padding: '13px 0', borderRadius: 14,
  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)',
  color: '#f87171', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

// sheets
const sheetRootStyle = { position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
const sheetStyle = {
  width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', overscrollBehavior: 'contain', boxSizing: 'border-box',
  background: 'var(--dark-card-2, var(--dark-card))', borderTop: '1px solid var(--dark-border)',
  borderRadius: '22px 22px 0 0', padding: '8px 18px calc(20px + env(safe-area-inset-bottom, 0px))',
}
const grabberStyle = { width: 38, height: 4, borderRadius: 999, background: 'var(--dark-border)', margin: '4px auto 12px' }
const sheetTitleStyle = { fontSize: 16, fontWeight: 800, color: 'var(--dark-text)', marginBottom: 12, textAlign: 'center' }

const pickerListStyle = { background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 16, overflow: 'hidden' }
const pickerRowStyle = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box', padding: '14px', border: 'none', borderBottom: '1px solid var(--dark-border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--dark-text-3)' }
const pickerLabelStyle = { display: 'block', fontSize: 14.5, fontWeight: 650, color: 'var(--dark-text)' }

const themeGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }
const themeSwatchStyle = (t, selected) => ({
  position: 'relative', aspectRatio: '1', borderRadius: 16, cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  background: themeGradient(t),
  border: selected ? '3px solid var(--dark-text)' : '3px solid transparent',
})
const themeNameStyle = { position: 'absolute', bottom: 6, left: 0, right: 0, fontSize: 10.5, fontWeight: 700, textAlign: 'center', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }

const qrCardStyle = (t) => ({
  width: 200, height: 200, margin: '4px auto 0', padding: 14, boxSizing: 'border-box',
  background: '#fff', borderRadius: 20, boxShadow: `0 0 0 5px ${t.a}`,
})
const qrBtnRowStyle = { display: 'flex', gap: 8, marginTop: 18 }
const primaryBtnStyle = (t) => ({ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRadius: 12, border: 'none', background: themeGradient(t), color: '#fff', fontSize: 13.5, fontWeight: 750, cursor: 'pointer', fontFamily: 'inherit' })
const secondaryBtnStyle = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--dark-border)', background: 'var(--chip-bg)', color: 'var(--dark-text)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

const fieldLabelStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12.5, fontWeight: 700, color: 'var(--dark-text-2)', margin: '16px 2px 6px' }
const fieldHintStyle = { fontSize: 11.5, fontWeight: 500, color: 'var(--dark-text-3)' }
const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--dark-border)', background: 'var(--dark-card)', color: 'var(--dark-text)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
const statusInputRowStyle = { display: 'flex', gap: 8, alignItems: 'center' }
const statusEmojiBoxStyle = { width: 44, height: 44, borderRadius: 12, background: 'var(--chip-bg)', border: '1px solid var(--dark-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }
const emojiStripStyle = { display: 'flex', gap: 6, overflowX: 'auto', margin: '10px 0 0', padding: '2px 0' }
const emojiBtnStyle = (on) => ({ flexShrink: 0, width: 38, height: 38, borderRadius: 10, fontSize: 19, cursor: 'pointer', background: on ? 'var(--brand-soft)' : 'transparent', border: on ? '1px solid rgba(108,99,255,0.5)' : '1px solid var(--dark-border)', padding: 0 })
const segmentStyle = { display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--chip-bg)', border: '1px solid var(--dark-border)' }
const segmentBtnStyle = (on, t) => ({ flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: on ? themeGradient(t) : 'transparent', color: on ? '#fff' : 'var(--dark-text-2)' })

const toastStyle = {
  position: 'fixed', left: '50%', bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))', zIndex: 80,
  maxWidth: 'calc(100vw - 32px)', padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: 650, textAlign: 'center',
  background: 'var(--dark-text)', color: 'var(--bg-surface-1, #0f0f1a)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
}
