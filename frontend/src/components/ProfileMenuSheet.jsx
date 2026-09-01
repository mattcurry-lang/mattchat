// ProfileMenuSheet.jsx
// Redesigned profile/account menu — replaces the old flat wrapped grid of
// pill buttons in ChatPage.jsx's `showProfileMenu` block.
//
// DESIGN RESEARCH (2026 mobile settings/profile UX):
//   - Grouped sections with headers + dividers, not a flat button grid —
//     both Android's and iOS's own settings guidelines converge on this
//     as the pattern that scans fastest for users who "need a map just
//     to find the settings" (a specifically named 2026 UX failure mode).
//   - Glassmorphism used "surgically" per Muzli's 2026 trend piece — ONE
//     blurred glass surface (this sheet), flat rows inside it. Blurring
//     every individual row (the old pill-grid effectively did this) reads
//     as dated rather than premium.
//   - A hero header with live stats ("icon, title, stat" — Android
//     settings guidelines, fig. 22) instead of just an avatar + name.
//     Stats here are all real, derived values passed in as props — no
//     fabricated numbers.
//   - Bottom-anchored, thumb-zone-first (kept from the original).
//
// This component is purely presentational + interaction — it takes a
// `sections` config from ChatPage.jsx so every action stays wired to
// the real handlers already living there. New placeholder buttons
// (Storage & Data, Help & Support, Invite Friends, What's New) are
// included with commented "wire this up" spots — swap their onClick
// stubs in ChatPage.jsx whenever you're ready to build those out.

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Avatar from './Avatar'
import { IconX, IconSearch, IconLogOut, IconCamera } from './Icons'

// ---- small self-contained icons for the new placeholder sections ----

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

export const PlaceholderIcons = { IconDatabase, IconLifeBuoy, IconUserPlus, IconGift }

const sheetVariants = {
  hidden: { y: '100%' },
  show: { y: 0, transition: { type: 'spring', damping: 32, stiffness: 300 } },
  exit: { y: '100%', transition: { duration: 0.2 } },
}
const listVariants = { hidden: {}, show: { transition: { staggerChildren: 0.025, delayChildren: 0.08 } } }
const rowVariants = { hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } } }

export default function ProfileMenuSheet({
  isOpen, onClose,
  profile, email,
  stats = {},          // { chatsCount, sharedWithCurryCount, connectedCount }
  sections = [],        // [{ id, label, items: [{ id, icon, label, subtitle, onClick, tone, badge }] }]
  onAvatarClick,         // tap the hero avatar — wired to "change profile picture" in ChatPage
  onSignOut,
}) {
  const [query, setQuery] = useState('')

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections
      .map(s => ({ ...s, items: s.items.filter(it => it.label.toLowerCase().includes(q)) }))
      .filter(s => s.items.length > 0)
  }, [query, sections])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={backdropStyle}
          />
          <motion.div
            variants={sheetVariants} initial="hidden" animate="show" exit="exit"
            style={sheetStyle}
            role="dialog" aria-label="Profile menu"
          >
            <div style={handleStyle} />

            {/* header row */}
            <div style={topRowStyle}>
              <span style={topRowTitleStyle}>Profile</span>
              <button onClick={onClose} style={closeBtnStyle}><IconX size={16} /></button>
            </div>

            {/* hero */}
            <div style={heroStyle}>
              <button onClick={onAvatarClick} style={avatarBtnStyle} title="Change profile picture">
                <div style={avatarRingStyle}>
                  <Avatar name={profile?.username || email} size={64} photoUrl={profile?.avatar_url} />
                </div>
                <span style={avatarCameraBadgeStyle}><IconCamera size={12} /></span>
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={heroNameRowStyle}>
                  <span style={heroNameStyle}>{profile?.username || 'You'}</span>
                  {profile?.is_admin && <span style={adminBadgeStyle}>Admin</span>}
                </div>
                <div style={heroEmailStyle}>{email}</div>
              </div>
            </div>

            {/* live stat chips — real values only */}
            <div style={statRowStyle}>
              <StatChip value={stats.chatsCount ?? 0} label="Chats" />
              <StatChip value={stats.sharedWithCurryCount ?? 0} label="With Curry" accent />
              <StatChip value={stats.connectedCount ?? 0} label="Connected" />
            </div>

            {/* search filter — quick, real interaction affordance */}
            <div style={searchWrapStyle}>
              <IconSearch size={14} style={{ color: 'var(--dark-text-3)', flexShrink: 0 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search settings..."
                style={searchInputStyle}
              />
            </div>

            {/* grouped sections */}
            <div style={scrollAreaStyle}>
              {filteredSections.map((section) => (
                <div key={section.id} style={{ marginBottom: 4 }}>
                  <div style={sectionLabelStyle}>{section.label}</div>
                  <motion.div variants={listVariants} initial="hidden" animate="show" style={sectionCardStyle}>
                    {section.items.map((item, i) => (
                      <motion.button
                        key={item.id}
                        variants={rowVariants}
                        whileTap={{ scale: 0.985, backgroundColor: 'var(--chip-bg-hover)' }}
                        onClick={item.onClick}
                        style={{
                          ...rowStyle,
                          borderBottom: i < section.items.length - 1 ? '1px solid var(--dark-border)' : 'none',
                        }}
                      >
                        <span style={{ ...rowIconStyle, color: item.tone === 'danger' ? '#f87171' : 'var(--brand-light)' }}>
                          {item.icon}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <span style={{ ...rowLabelStyle, color: item.tone === 'danger' ? '#f87171' : 'var(--dark-text)' }}>
                            {item.label}
                          </span>
                          {item.subtitle && <span style={rowSubtitleStyle}>{item.subtitle}</span>}
                        </span>
                        {item.badge && <span style={rowBadgeStyle}>{item.badge}</span>}
                        <IconChevron size={14} style={{ color: 'var(--dark-text-3)', flexShrink: 0 }} />
                      </motion.button>
                    ))}
                  </motion.div>
                </div>
              ))}

              {filteredSections.length === 0 && (
                <div style={emptyStateStyle}>No settings match "{query}"</div>
              )}

              <button onClick={onSignOut} style={signOutBtnStyle}>
                <IconLogOut size={15} /> Sign out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function StatChip({ value, label, accent }) {
  return (
    <div style={{ ...statChipStyle, ...(accent ? statChipAccentStyle : null) }}>
      <div style={statChipValueStyle}>{value}</div>
      <div style={statChipLabelStyle}>{label}</div>
    </div>
  )
}

// ---- styles ----
// Uses the app's existing theme CSS vars (--dark-card, --dark-text, etc.)
// since this menu lives inside the normal themed chrome — those vars
// already flip correctly under [data-theme="light"], unlike the
// always-dark media overlays elsewhere in the app.

const backdropStyle = { position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)' }

const sheetStyle = {
  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 61,
  maxWidth: 460, margin: '0 auto',
  maxHeight: '86vh',
  display: 'flex', flexDirection: 'column',
  background: 'var(--dark-card-2)',
  backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
  borderTopLeftRadius: 24, borderTopRightRadius: 24,
  border: '1px solid var(--dark-border)', borderBottom: 'none',
  boxShadow: '0 -12px 40px rgba(0,0,0,0.35)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
}

const handleStyle = { width: 38, height: 4, borderRadius: 2, background: 'var(--dark-border)', margin: '10px auto 2px', flexShrink: 0 }

const topRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 8px', flexShrink: 0 }
const topRowTitleStyle = { fontSize: 13, fontWeight: 700, color: 'var(--dark-text-2)', textTransform: 'uppercase', letterSpacing: 0.5 }
const closeBtnStyle = { width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--chip-bg)', color: 'var(--dark-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }

const heroStyle = { display: 'flex', alignItems: 'center', gap: 14, padding: '4px 16px 14px', flexShrink: 0 }
const avatarBtnStyle = { position: 'relative', border: 'none', background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }
const avatarRingStyle = { borderRadius: '50%', padding: 2.5, background: 'var(--brand-grad)' }
const avatarCameraBadgeStyle = {
  position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%',
  background: 'var(--brand-grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '2px solid var(--dark-card-2)',
}
const heroNameRowStyle = { display: 'flex', alignItems: 'center', gap: 6 }
const heroNameStyle = { fontSize: 18, fontWeight: 800, color: 'var(--dark-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const adminBadgeStyle = { fontSize: 9.5, fontWeight: 800, color: '#fff', background: 'var(--brand-grad)', borderRadius: 6, padding: '2px 6px', flexShrink: 0, letterSpacing: 0.3 }
const heroEmailStyle = { fontSize: 12.5, color: 'var(--dark-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }

const statRowStyle = { display: 'flex', gap: 8, padding: '0 16px 14px', flexShrink: 0 }
const statChipStyle = { flex: 1, background: 'var(--chip-bg)', borderRadius: 14, padding: '9px 6px', textAlign: 'center', border: '1px solid var(--dark-border)' }
const statChipAccentStyle = { background: 'var(--brand-soft)', border: '1px solid rgba(108,99,255,0.3)' }
const statChipValueStyle = { fontSize: 17, fontWeight: 800, color: 'var(--dark-text)', lineHeight: 1.1 }
const statChipLabelStyle = { fontSize: 10, fontWeight: 600, color: 'var(--dark-text-3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 }

const searchWrapStyle = {
  display: 'flex', alignItems: 'center', gap: 8, margin: '0 16px 12px',
  padding: '9px 12px', borderRadius: 12,
  background: 'var(--dark-card)', border: '1px solid var(--dark-border)', flexShrink: 0,
}
const searchInputStyle = { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: 'var(--dark-text)', fontFamily: 'inherit' }

const scrollAreaStyle = { flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px 20px' }

const sectionLabelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--dark-text-3)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '14px 4px 6px' }
const sectionCardStyle = { background: 'var(--dark-card)', borderRadius: 16, border: '1px solid var(--dark-border)', overflow: 'hidden' }

const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
  padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
}
const rowIconStyle = { width: 30, height: 30, borderRadius: 9, background: 'var(--chip-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const rowLabelStyle = { display: 'block', fontSize: 13.5, fontWeight: 650 }
const rowSubtitleStyle = { display: 'block', fontSize: 11, color: 'var(--dark-text-3)', marginTop: 1 }
const rowBadgeStyle = { fontSize: 10.5, fontWeight: 700, color: 'var(--brand-light)', background: 'var(--brand-soft)', borderRadius: 8, padding: '2px 7px', flexShrink: 0 }

const emptyStateStyle = { textAlign: 'center', color: 'var(--dark-text-3)', fontSize: 13, padding: '30px 0' }

const signOutBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
  marginTop: 16, padding: '13px 0', borderRadius: 14,
  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)',
  color: '#f87171', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}
