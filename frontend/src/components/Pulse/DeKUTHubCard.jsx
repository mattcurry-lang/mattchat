import React, { useState } from 'react'

// ─────────────────────────────────────────────────────────
// Phase 1: launcher only. No auth, no scraping, no storage
// of DeKUT credentials, no iframes. Each button just opens
// the official DeKUT site in a new tab.
//
// Data-driven so Phase 2 can append more services without
// touching the rendering code below.
// ─────────────────────────────────────────────────────────
const DEKUT_SERVICES = [
  {
    id: 'elearning',
    name: 'eLearning',
    description: 'Access your courses, notes, assignments and online classes.',
    url: 'https://elearning.dkut.ac.ke/',
    icon: 'book',
  },
  {
    id: 'student-portal',
    name: 'Student Portal',
    description: 'Access your student academic and university services.',
    url: 'https://portal.dkut.ac.ke/',
    icon: 'cap',
  },
  {
    id: 'catering',
    name: 'Catering Services',
    description: 'Access DeKUT catering and meal-related services.',
    url: 'https://catering.dkut.ac.ke/',
    icon: 'utensils',
  },
]

function ServiceIcon({ type, size = 20 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'white', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'book') {
    return (
      <svg {...common}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    )
  }
  if (type === 'cap') {
    return (
      <svg {...common}>
        <path d="M22 10 12 5 2 10l10 5 10-5Z" />
        <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
      </svg>
    )
  }
  // utensils
  return (
    <svg {...common}>
      <path d="M7 2v8a2 2 0 0 0 2 2v10" />
      <path d="M7 2v6M11 2v6" />
      <path d="M17 2c-1.7 0-3 2-3 6s1.3 6 3 6v8" />
    </svg>
  )
}

const ICON_GRADIENTS = {
  book: 'linear-gradient(135deg,#a78bfa,#6c63ff)',
  cap: 'linear-gradient(135deg,#facc15,#f59e0b)',
  utensils: 'linear-gradient(135deg,#4ade80,#22c55e)',
}

export default function DeKUTHubCard() {
  const [hovered, setHovered] = useState(null)
  const [pressed, setPressed] = useState(null)

  const openService = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="dekut-hub-card"
      style={{
        position: 'relative',
        borderRadius: 20,
        padding: 16,
        background: 'var(--bg-surface-2)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        overflow: 'hidden',
      }}
    >
      {/* soft ambient glow, purely decorative — doesn't affect text contrast */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: -40, right: -40, width: 140, height: 140,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.22), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2, position: 'relative' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true">🎓</span> DeKUT Hub
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12, position: 'relative' }}>
        Your DeKUT services, one tap away.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
        {DEKUT_SERVICES.map((service) => {
          const isHovered = hovered === service.id
          const isPressed = pressed === service.id
          return (
            <button
              key={service.id}
              onClick={() => openService(service.url)}
              onMouseEnter={() => setHovered(service.id)}
              onMouseLeave={() => { setHovered(null); setPressed(null) }}
              onMouseDown={() => setPressed(service.id)}
              onMouseUp={() => setPressed(null)}
              aria-label={`Open DeKUT ${service.name} in a new tab`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: isHovered ? 'var(--bg-surface-1, rgba(0,0,0,0.04))' : 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '11px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                width: '100%',
                transform: isPressed ? 'scale(0.98) translateY(0px)' : isHovered ? 'translateY(-2px)' : 'translateY(0px)',
                boxShadow: isHovered ? '0 8px 20px -8px rgba(108,99,255,0.35)' : 'none',
                transition: 'transform 160ms ease, box-shadow 200ms ease, background 160ms ease',
              }}
            >
              <div
                style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: ICON_GRADIENTS[service.icon],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isHovered ? '0 0 0 4px rgba(255,255,255,0.08)' : 'none',
                  transform: isHovered ? 'scale(1.06) rotate(-3deg)' : 'scale(1) rotate(0deg)',
                  transition: 'transform 200ms ease, box-shadow 200ms ease',
                }}
              >
                <ServiceIcon type={service.icon} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {service.name}
                </div>
                <div
                  style={{
                    fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {service.description}
                </div>
              </div>

              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                style={{
                  flexShrink: 0,
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? 'translate(0,0)' : 'translate(-3px,3px)',
                  transition: 'opacity 160ms ease, transform 160ms ease',
                }}
                aria-hidden="true"
              >
                <path d="M7 17 17 7M7 7h10v10" />
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}
