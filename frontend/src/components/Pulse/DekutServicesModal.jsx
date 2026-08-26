// src/components/Pulse/DekutServicesModal.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import { getAllServices, DEFAULT_FEATURED_IDS } from '../../data/dekutServices'
import { timeAgo } from '../../hooks/useDekutUsage'
import { openDekutService } from '../../utils/dekutOpenService'

function matchesQuery(service, query) {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    service.name.toLowerCase().includes(q) ||
    service.description.toLowerCase().includes(q) ||
    (service.categoryLabel || '').toLowerCase().includes(q) ||
    (service.keywords || []).some((k) => k.toLowerCase().includes(q))
  )
}

function ServiceCard({ service, isFavorite, onToggleFavorite, onOpen }) {
  const [hovered, setHovered] = useState(false)
  const active = service.type === 'internal' ? true : service.status === 'active' && service.url

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 8,
        background: 'var(--bg-surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 14,
        cursor: active ? 'pointer' : 'default',
        opacity: active ? 1 : 0.6,
        transform: hovered && active ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered && active ? '0 10px 24px -12px rgba(108,99,255,0.4)' : 'none',
        transition: 'transform 160ms ease, box-shadow 200ms ease',
      }}
      onClick={() => active && onOpen(service)}
      role={active ? 'button' : undefined}
      tabIndex={active ? 0 : -1}
      aria-disabled={!active}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: ICON_GRADIENTS[service.icon],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <DekutIcon type={service.icon} size={18} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(service.id) }}
            aria-label={isFavorite ? `Unfavorite ${service.name}` : `Favorite ${service.name}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            <DekutIcon
              type="star"
              size={16}
              strokeWidth={2}
              color={isFavorite ? '#f59e0b' : 'var(--text-secondary)'}
            />
          </button>
          {active && service.type !== 'internal' && (
            <span style={{ opacity: hovered ? 1 : 0, transition: 'opacity 160ms ease', display: 'flex' }}>
              <DekutIcon type="externalLink" size={14} color="var(--text-secondary)" strokeWidth={2} />
            </span>
          )}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{service.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
          {service.description}
        </div>
      </div>

      {!active && (
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)',
          border: '1px solid var(--border)', borderRadius: 999,
          padding: '2px 8px', alignSelf: 'flex-start',
        }}>
          Link coming soon
        </span>
      )}
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
        <span aria-hidden="true">{icon}</span> {title}
      </div>
      {children}
    </div>
  )
}

function ServiceGrid({ services, favorites, onToggleFavorite, onOpen }) {
  if (services.length === 0) {
    return <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>No services match your search.</div>
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
      {services.map((s) => (
        <ServiceCard
          key={s.id}
          service={s}
          isFavorite={favorites.includes(s.id)}
          onToggleFavorite={onToggleFavorite}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}

// onNavigate: optional (route, service) => void, forwarded to internal
// services (see src/utils/dekutOpenService.js).
export default function DekutServicesModal({ categories, usage, onNavigate, onClose }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const allServices = useMemo(() => getAllServices(categories), [categories])

  useEffect(() => {
    inputRef.current?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return

      const focusable = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const openService = (service) => openDekutService(service, { usage, onNavigate })

  const filtered = useMemo(
    () => allServices.filter((s) => matchesQuery(s, query)),
    [allServices, query]
  )

  const mostUsed = useMemo(() => {
    const withCounts = allServices.map((s) => ({ s, count: usage.counts[s.id] || 0 }))
    const ranked = withCounts.filter((x) => x.count > 0).sort((a, b) => b.count - a.count)
    if (ranked.length >= 3) return ranked.slice(0, 3).map((x) => x.s)
    const fallback = DEFAULT_FEATURED_IDS
      .map((id) => allServices.find((s) => s.id === id))
      .filter(Boolean)
    return fallback
  }, [allServices, usage.counts])

  const favoriteServices = usage.favorites
    .map((id) => allServices.find((s) => s.id === id))
    .filter(Boolean)

  const recentServices = usage.recents
    .map((r) => ({ service: allServices.find((s) => s.id === r.id), at: r.at }))
    .filter((r) => r.service)

  const showSections = query.trim() === ''

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="DeKUT Services"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'dekutFadeIn 160ms ease',
        padding: 16,
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes dekutFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dekutScaleIn { from { opacity: 0; transform: scale(0.97) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1100, height: '85vh', maxHeight: 900,
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.45)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'dekutScaleIn 200ms ease',
        }}
        className="dekut-modal-panel"
      >
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden="true">🎓</span> DeKUT Services
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                Everything you need from DeKUT, organized in one place.
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close DeKUT Services"
              style={{
                background: 'var(--bg-surface-1, rgba(0,0,0,0.06))', border: '1px solid var(--border)',
                borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <DekutIcon type="x" size={16} color="var(--text-primary)" strokeWidth={2.2} />
            </button>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid var(--border)', borderRadius: 12, padding: '9px 12px',
            background: 'var(--bg-surface-1, rgba(0,0,0,0.03))',
          }}>
            <DekutIcon type="search" size={16} color="var(--text-secondary)" strokeWidth={2} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search DeKUT services..."
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 13.5, color: 'var(--text-primary)', width: '100%', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {showSections && (
            <>
              <Section title="Most Used" icon="⭐">
                <ServiceGrid services={mostUsed} favorites={usage.favorites} onToggleFavorite={usage.toggleFavorite} onOpen={openService} />
              </Section>

              {favoriteServices.length > 0 && (
                <Section title="My Favorites" icon="⭐">
                  <ServiceGrid services={favoriteServices} favorites={usage.favorites} onToggleFavorite={usage.toggleFavorite} onOpen={openService} />
                </Section>
              )}

              {recentServices.length > 0 && (
                <Section title="Recently Used" icon="🕘">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {recentServices.map(({ service, at }) => (
                      <div
                        key={service.id}
                        onClick={() => openService(service)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)',
                          cursor: 'pointer', fontSize: 12.5,
                        }}
                      >
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{service.name}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{timeAgo(at)}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {categories.map((cat) => (
                <Section key={cat.id} title={cat.label} icon="">
                  <ServiceGrid
                    services={cat.services.map((s) => ({ ...s, categoryId: cat.id, categoryLabel: cat.label }))}
                    favorites={usage.favorites}
                    onToggleFavorite={usage.toggleFavorite}
                    onOpen={openService}
                  />
                </Section>
              ))}
            </>
          )}

          {!showSections && (
            <Section title={`Results for "${query}"`} icon="🔎">
              <ServiceGrid services={filtered} favorites={usage.favorites} onToggleFavorite={usage.toggleFavorite} onOpen={openService} />
            </Section>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .dekut-modal-panel {
            height: 100vh !important;
            max-height: 100vh !important;
            width: 100vw !important;
            max-width: 100vw !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  )

  return createPortal(content, document.body)
}
