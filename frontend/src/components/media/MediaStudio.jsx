// MediaStudio.jsx
// Full-height "media studio" sheet — replaces the old short bottom-sheet
// attachment menu. Opens MediaPicker/CameraCapture/FilePicker etc.
// depending on what the user taps. Does not itself upload anything.
//
// v2 REDESIGN NOTES (design research: Muzli "Mobile App Design Trends 2026",
// bentogrids.com, Apple's bento-style marketing pages, Spotify's Library
// redesign):
//   - Sheet now covers the full screen down to the chat header instead of
//     a short ~40% sheet — matches the "Apple Maps search sheet" pattern
//     of pulling the whole interaction surface into one full panel.
//   - Options are laid out as a BENTO GRID (varying tile sizes: hero /
//     wide / normal) instead of a plain icon row list — this is the
//     single biggest "wow" lever per the research above.
//   - Sticky search bar + horizontally-scrollable category chip row
//     under the header, mirroring Spotify's "Your Library" filter-chip
//     pattern — lets the grid itself scroll under a fixed control layer.
//   - Deliberately did NOT put backdrop-filter blur on every tile.
//     Multiple sources warn glass-blur-per-card causes real frame drops
//     on low-end Android — blur is used once, on the sticky header only.
//   - Tiles use flat hardcoded gradient/text colors, not theme vars —
//     consistent with the DeKUT overlay fix pattern (a var falling back
//     to a light-mode color on this always-dark surface goes invisible).
//   - Framer Motion stagger on the grid for the "reveal" moment; spring
//     tap scale on each tile for the haptic-feel micro-interaction the
//     2026 trend pieces call out.
//
// TO WIRE UP: this file assumes a CSS var `--chat-header-height` exists
// on your token system (falls back to 60px if not). Set it to your real
// chat header height so the sheet's top edge lines up exactly with the
// bottom of the header instead of guessing.

import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  IconCamera, IconImagePlus, IconFilm, IconFolder, IconMusic,
  IconPin, IconUser, IconSparkle, IconMaximize,
} from '../Icons'

// ---- small self-contained icons (not in the shared Icons file) ----

const IconClose = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
)

const IconSearch = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth={2} />
    <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
)

// ---- option data: bento size + category + a distinct gradient each ----
// size: 'hero' (2 cols x 2 rows), 'wide' (2 cols x 1 row), 'normal' (1x1)

const OPTIONS = [
  {
    id: 'camera', label: 'Camera', sub: 'Snap something new', Icon: IconCamera,
    size: 'hero', category: 'capture',
    gradient: 'linear-gradient(135deg, #FF5F6D 0%, #FFC371 100%)',
  },
  {
    id: 'moment', label: 'Create Moment', sub: 'AI-assisted, powered by Curry', Icon: IconSparkle,
    size: 'hero', category: 'ai',
    gradient: 'linear-gradient(135deg, #7F5FFF 0%, #C86DD7 100%)',
  },
  {
    id: 'photos', label: 'Photos', sub: null, Icon: IconImagePlus,
    size: 'wide', category: 'media',
    gradient: 'linear-gradient(135deg, #38A3F5 0%, #6C63FF 100%)',
  },
  {
    id: 'videos', label: 'Videos', sub: null, Icon: IconFilm,
    size: 'normal', category: 'media',
    gradient: 'linear-gradient(135deg, #FF8A5B 0%, #FF3D77 100%)',
  },
  {
    id: 'audio', label: 'Audio', sub: null, Icon: IconMusic,
    size: 'normal', category: 'media',
    gradient: 'linear-gradient(135deg, #34D1BF 0%, #2A9D8F 100%)',
  },
  {
    id: 'documents', label: 'Documents', sub: null, Icon: IconFolder,
    size: 'normal', category: 'files',
    gradient: 'linear-gradient(135deg, #9BA4B5 0%, #5C6478 100%)',
  },
  {
    id: 'screenshot', label: 'Screenshot', sub: null, Icon: IconMaximize,
    size: 'normal', category: 'capture',
    gradient: 'linear-gradient(135deg, #FFB84D 0%, #FF7A45 100%)',
  },
  {
    id: 'location', label: 'Location', sub: null, Icon: IconPin,
    size: 'normal', category: 'connect',
    gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)',
  },
  {
    id: 'contact', label: 'Contact', sub: null, Icon: IconUser,
    size: 'normal', category: 'connect',
    gradient: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)',
  },
]

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'capture', label: 'Capture' },
  { id: 'media', label: 'Media' },
  { id: 'files', label: 'Files' },
  { id: 'connect', label: 'Connect' },
  { id: 'ai', label: 'AI' },
]

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
}

const tileVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.94 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 30 } },
}

export default function MediaStudio({ isOpen, onClose, onSelectOption, recentOptionIds = [] }) {
  const sheetRef = useRef(null)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // reset transient UI state each time the sheet opens
  useEffect(() => {
    if (isOpen) { setQuery(''); setActiveCategory('all') }
  }, [isOpen])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return OPTIONS.filter((opt) => {
      const matchesCategory = activeCategory === 'all' || opt.category === activeCategory
      const matchesQuery = !q || opt.label.toLowerCase().includes(q)
      return matchesCategory && matchesQuery
    })
  }, [query, activeCategory])

  const recentOptions = useMemo(
    () => recentOptionIds.map((id) => OPTIONS.find((o) => o.id === id)).filter(Boolean),
    [recentOptionIds]
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="media-studio-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              background: 'rgba(0,0,0,0.55)',
            }}
          />
          <motion.div
            ref={sheetRef}
            className="media-studio-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 300 }}
            style={sheetStyle}
            role="dialog"
            aria-label="Media Studio"
          >
            {/* sticky header: handle, title, close, search, category chips */}
            <div style={stickyHeaderStyle}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)', margin: '10px auto 2px' }} />

              <div style={headerRowStyle}>
                <h3 style={titleStyle}>Share something</h3>
                <button onClick={onClose} aria-label="Close" style={closeBtnStyle}>
                  <IconClose size={18} />
                </button>
              </div>

              <div style={searchWrapStyle}>
                <IconSearch size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search attachments..."
                  style={searchInputStyle}
                />
              </div>

              <div style={chipRowStyle}>
                {CATEGORIES.map((cat) => {
                  const active = activeCategory === cat.id
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      style={active ? chipActiveStyle : chipStyle}
                    >
                      {cat.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* scrollable content */}
            <div style={scrollAreaStyle}>
              {recentOptions.length > 0 && activeCategory === 'all' && !query && (
                <div style={{ padding: '4px 16px 0' }}>
                  <div style={sectionLabelStyle}>Recent</div>
                  <div style={recentRowStyle}>
                    {recentOptions.map(({ id, label, Icon, gradient }) => (
                      <button
                        key={id}
                        onClick={() => { onSelectOption(id); onClose() }}
                        style={recentPillStyle}
                      >
                        <span style={{ ...recentIconStyle, background: gradient }}>
                          <Icon size={15} style={{ color: '#fff' }} />
                        </span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <motion.div
                variants={gridVariants}
                initial="hidden"
                animate="show"
                style={bentoGridStyle}
              >
                {filtered.map(({ id, label, sub, Icon, size, gradient }) => (
                  <motion.button
                    key={id}
                    variants={tileVariants}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => { onSelectOption(id); onClose() }}
                    style={{ ...tileBaseStyle, ...tileSizeStyle[size] }}
                  >
                    <span style={{ ...tileIconBadgeStyle, background: gradient }}>
                      <Icon size={size === 'hero' ? 26 : 20} style={{ color: '#fff' }} />
                    </span>
                    <span style={tileLabelStyle}>{label}</span>
                    {sub && <span style={tileSubLabelStyle}>{sub}</span>}
                  </motion.button>
                ))}

                {filtered.length === 0 && (
                  <div style={emptyStateStyle}>No matches for "{query}"</div>
                )}
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ---- styles ----
// Text/background colors on this sheet are hardcoded constants, not
// theme vars — the sheet is always a fixed dark surface regardless of
// app theme, so a var that resolves to a light-mode color here would
// go invisible (same bug class as the DeKUT overlay sweep).

const sheetStyle = {
  position: 'fixed',
  left: 0, right: 0, bottom: 0,
  top: 'var(--chat-header-height, 60px)',
  zIndex: 61,
  maxWidth: 480,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(180deg, #1c1830 0%, #14111f 100%)',
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  boxShadow: '0 -8px 40px rgba(0,0,0,0.45)',
  border: '1px solid rgba(148,120,255,0.18)',
  borderBottom: 'none',
  overflow: 'hidden',
}

const stickyHeaderStyle = {
  flexShrink: 0,
  position: 'sticky',
  top: 0,
  zIndex: 2,
  background: 'rgba(20,17,31,0.85)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  borderBottom: '1px solid rgba(148,120,255,0.12)',
  paddingBottom: 10,
}

const headerRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 16px 10px',
}

const titleStyle = {
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
  color: '#f4f2f8',
}

const closeBtnStyle = {
  width: 32, height: 32,
  borderRadius: 10,
  border: 'none',
  background: 'rgba(255,255,255,0.08)',
  color: '#e4e0f0',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
}

const searchWrapStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  margin: '0 16px 10px',
  padding: '9px 12px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(148,120,255,0.16)',
  color: '#a9a4bd',
}

const searchInputStyle = {
  flex: 1,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: 14,
  color: '#f4f2f8',
}

const chipRowStyle = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto',
  padding: '0 16px',
  scrollbarWidth: 'none',
}

const chipStyle = {
  flexShrink: 0,
  padding: '6px 14px',
  borderRadius: 999,
  border: '1px solid rgba(148,120,255,0.18)',
  background: 'rgba(255,255,255,0.05)',
  color: '#c9c5d6',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const chipActiveStyle = {
  ...chipStyle,
  background: 'linear-gradient(135deg, #7F5FFF 0%, #C86DD7 100%)',
  border: '1px solid transparent',
  color: '#fff',
}

const scrollAreaStyle = {
  flex: 1,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
}

const sectionLabelStyle = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: '#8b8798',
  margin: '10px 0 8px',
}

const recentRowStyle = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto',
  paddingBottom: 4,
  scrollbarWidth: 'none',
}

const recentPillStyle = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px 6px 6px',
  borderRadius: 999,
  border: '1px solid rgba(148,120,255,0.18)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e4e0f0',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const recentIconStyle = {
  width: 24, height: 24,
  borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}

const bentoGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gridAutoRows: '84px',
  gap: 10,
  padding: '14px 16px 8px',
}

const tileSizeStyle = {
  hero: { gridColumn: 'span 2', gridRow: 'span 2' },
  wide: { gridColumn: 'span 2', gridRow: 'span 1' },
  normal: { gridColumn: 'span 1', gridRow: 'span 1' },
}

const tileBaseStyle = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  alignItems: 'flex-start',
  gap: 6,
  padding: 12,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.045)',
  cursor: 'pointer',
  overflow: 'hidden',
  textAlign: 'left',
}

const tileIconBadgeStyle = {
  width: 36, height: 36,
  borderRadius: 11,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
}

const tileLabelStyle = {
  fontSize: 13.5,
  fontWeight: 700,
  color: '#f4f2f8',
  lineHeight: 1.15,
}

const tileSubLabelStyle = {
  fontSize: 11,
  fontWeight: 500,
  color: 'rgba(244,242,248,0.65)',
  lineHeight: 1.2,
}

const emptyStateStyle = {
  gridColumn: 'span 4',
  textAlign: 'center',
  padding: '32px 16px',
  color: '#8b8798',
  fontSize: 13.5,
}
