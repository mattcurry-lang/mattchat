import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Avatar from './Avatar'
import AvatarViewer from './AvatarViewer'
import { IconSearch, IconLogOut, IconCamera } from './Icons'

// ---- small self-contained icons ----
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

export const PlaceholderIcons = { IconDatabase, IconLifeBuoy, IconUserPlus, IconGift }

const pageCss = `
.pm-row { transition: background .12s ease; }
.pm-row:hover { background: var(--chip-bg); }
.pm-row:focus-visible { outline: 2px solid #a78bfa; outline-offset: -2px; }
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

export default function ProfileMenuSheet({
  isOpen, onClose,
  profile, email,
  stats = {},          // { chatsCount, sharedWithCurryCount, connectedCount }
  sections = [],       // [{ id, label, items: [{ id, icon, label, subtitle, onClick, tone, badge }] }]
  onAvatarClick,
  onSignOut,
}) {
  const [query, setQuery] = useState('')
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  const wide = useIsWide()
  const pageRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const viewerOpenRef = useRef(false)
  viewerOpenRef.current = photoViewerOpen

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections
      .map((s) => ({ ...s, items: s.items.filter((it) => it.label.toLowerCase().includes(q)) }))
      .filter((s) => s.items.length > 0)
  }, [query, sections])

  useEffect(() => { if (!isOpen) setQuery('') }, [isOpen])

  // Behave like a real page: Back button / swipe-back closes it, Escape closes it.
  useEffect(() => {
    if (!isOpen) return undefined
    window.history.pushState({ mattchatProfilePage: true }, '')

    const onPop = (e) => {
      e.stopImmediatePropagation() // don't let the chat's own back handler react to this one
      onCloseRef.current?.()
    }
    const onKey = (e) => {
      if (e.key === 'Escape' && !viewerOpenRef.current) onCloseRef.current?.()
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
            transition={{ type: 'spring', damping: 34, stiffness: 320 }}
            style={pageStyle}
          >
            {/* sticky page header */}
            <div style={headerStyle}>
              <button onClick={onClose} style={backBtnStyle} aria-label="Back"><IconBack /></button>
              <div style={headerTitleStyle}>Profile</div>
              <div style={{ width: 40 }} />
            </div>

            <div style={contentStyle(wide)}>
              {/* identity card */}
              <aside style={asideStyle(wide)}>
                <div style={{ position: 'relative', width: 104, margin: '0 auto' }}>
                  <button onClick={() => setPhotoViewerOpen(true)} style={avatarBtnStyle} title="View profile photo">
                    <div style={avatarRingStyle}>
                      <Avatar name={profile?.username || email} size={96} photoUrl={profile?.avatar_url} />
                    </div>
                  </button>
                  <button onClick={onAvatarClick} style={avatarCameraBadgeStyle} title="Change profile picture">
                    <IconCamera size={13} />
                  </button>
                </div>

                <div style={heroNameRowStyle}>
                  <span style={heroNameStyle}>{profile?.username || 'You'}</span>
                  {profile?.is_admin && (
                    <span style={adminBadgeStyle} title="Mattchat Team">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </div>
                <div style={heroEmailStyle}>{email}</div>

                <div style={statRowStyle}>
                  <StatChip value={stats.chatsCount ?? 0} label="Chats" />
                  <StatChip value={stats.sharedWithCurryCount ?? 0} label="With Curry" accent />
                  <StatChip value={stats.connectedCount ?? 0} label="Connected" />
                </div>

                <button onClick={onAvatarClick} style={changePhotoBtnStyle}>
                  <IconCamera size={14} /> Change profile picture
                </button>
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
                </div>

                {filteredSections.map((section) => (
                  <div key={section.id} style={{ marginBottom: 4 }}>
                    <div style={sectionLabelStyle}>{section.label}</div>
                    <motion.div variants={listVariants} initial="hidden" animate="show" style={sectionCardStyle}>
                      {section.items.map((item, i) => (
                        <motion.button
                          key={item.id}
                          className="pm-row"
                          variants={rowVariants}
                          whileTap={{ scale: 0.985 }}
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
                            <span style={{ ...rowLabelStyle, color: item.tone === 'danger' ? '#f87171' : 'var(--dark-text)' }}>{item.label}</span>
                            {item.subtitle && <span style={rowSubtitleStyle}>{item.subtitle}</span>}
                          </span>
                          {item.badge && <span style={rowBadgeStyle}>{item.badge}</span>}
                          <IconChevron size={14} />
                        </motion.button>
                      ))}
                    </motion.div>
                  </div>
                ))}

                {filteredSections.length === 0 && <div style={emptyStateStyle}>No settings match "{query}"</div>}

                <button onClick={onSignOut} style={signOutBtnStyle}>
                  <IconLogOut size={15} /> Sign out
                </button>
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isOpen && (
        <AvatarViewer
          isOpen={photoViewerOpen}
          onClose={() => setPhotoViewerOpen(false)}
          photoUrl={profile?.avatar_url}
          name={profile?.username || 'You'}
          subtitle={email}
        />
      )}
    </>,
    document.body
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
  gridTemplateColumns: wide ? '300px minmax(0, 1fr)' : undefined,
  alignItems: 'start',
})
const asideStyle = (wide) => ({
  width: '100%', boxSizing: 'border-box', textAlign: 'center',
  background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 20,
  padding: 20,
  position: wide ? 'sticky' : 'static', top: wide ? 76 : undefined,
})

const avatarBtnStyle = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'block' }
const avatarRingStyle = { borderRadius: '50%', padding: 3, background: 'var(--brand-grad)', display: 'inline-block' }
const avatarCameraBadgeStyle = {
  position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: '50%',
  background: 'var(--brand-grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '3px solid var(--dark-card)', padding: 0, cursor: 'pointer',
}
const heroNameRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }
const heroNameStyle = { fontSize: 20, fontWeight: 800, color: 'var(--dark-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const adminBadgeStyle = { width: 16, height: 16, borderRadius: '50%', background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const heroEmailStyle = { fontSize: 12.5, color: 'var(--dark-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }

const statRowStyle = { display: 'flex', gap: 8, marginTop: 16 }
const statChipStyle = { flex: 1, background: 'var(--chip-bg)', borderRadius: 14, padding: '9px 6px', textAlign: 'center', border: '1px solid var(--dark-border)' }
const statChipAccentStyle = { background: 'var(--brand-soft)', border: '1px solid rgba(108,99,255,0.3)' }
const statChipValueStyle = { fontSize: 17, fontWeight: 800, color: 'var(--dark-text)', lineHeight: 1.1 }
const statChipLabelStyle = { fontSize: 10, fontWeight: 600, color: 'var(--dark-text-3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 }

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

const sectionLabelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--dark-text-3)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '14px 4px 6px' }
const sectionCardStyle = { background: 'var(--dark-card)', borderRadius: 16, border: '1px solid var(--dark-border)', overflow: 'hidden' }

const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--dark-text-3)' }
const rowIconStyle = { width: 32, height: 32, borderRadius: 10, background: 'var(--chip-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const rowLabelStyle = { display: 'block', fontSize: 14, fontWeight: 650 }
const rowSubtitleStyle = { display: 'block', fontSize: 11.5, color: 'var(--dark-text-3)', marginTop: 1 }
const rowBadgeStyle = { fontSize: 10.5, fontWeight: 700, color: 'var(--brand-light)', background: 'var(--brand-soft)', borderRadius: 8, padding: '2px 7px', flexShrink: 0 }

const emptyStateStyle = { textAlign: 'center', color: 'var(--dark-text-3)', fontSize: 13, padding: '30px 0' }

const signOutBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
  marginTop: 18, padding: '13px 0', borderRadius: 14,
  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)',
  color: '#f87171', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}
