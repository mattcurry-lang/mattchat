 
import React, { useState } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import { DEKUT_CATEGORIES, DEFAULT_FEATURED_IDS, getServiceById } from '../../data/dekutServices'
import { useDekutUsage } from '../../hooks/useDekutUsage'
import { openDekutService } from '../../utils/dekutOpenService'
import DekutServicesModal from './DekutServicesModal'

// onNavigate: optional (route, service) => void, forwarded to internal
// services (see src/utils/dekutOpenService.js). Omit it until an internal
// route actually exists — external services work fine without it.
export default function DeKUTHubCard({ onNavigate } = {}) {
  const [hovered, setHovered] = useState(null)
  const [pressed, setPressed] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const usage = useDekutUsage('dekut')

  const featured = DEFAULT_FEATURED_IDS.map((id) => getServiceById(id, DEKUT_CATEGORIES)).filter(Boolean)

  const openService = (service) => openDekutService(service, { usage, onNavigate })

  return (
    <div
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
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: -40, right: -40, width: 140, height: 140,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.22), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        <span aria-hidden="true">🎓</span> DeKUT Hub
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12, position: 'relative' }}>
        All your DeKUT services, one tap away.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
        {featured.map((service) => {
          const isHovered = hovered === service.id
          const isPressed = pressed === service.id
          return (
            <button
              key={service.id}
              onClick={() => openService(service)}
              onMouseEnter={() => setHovered(service.id)}
              onMouseLeave={() => { setHovered(null); setPressed(null) }}
              onMouseDown={() => setPressed(service.id)}
              onMouseUp={() => setPressed(null)}
              aria-label={`Open DeKUT ${service.name}${service.type === 'external' ? ' in a new tab' : ''}`}
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
                transform: isPressed ? 'scale(0.98)' : isHovered ? 'translateY(-2px)' : 'translateY(0px)',
                boxShadow: isHovered ? '0 8px 20px -8px rgba(108,99,255,0.35)' : 'none',
                transition: 'transform 160ms ease, box-shadow 200ms ease, background 160ms ease',
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: ICON_GRADIENTS[service.icon],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: isHovered ? 'scale(1.06) rotate(-3deg)' : 'scale(1) rotate(0deg)',
                transition: 'transform 200ms ease',
              }}>
                <DekutIcon type={service.icon} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{service.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {service.description}
                </div>
              </div>

              <span style={{ flexShrink: 0, opacity: isHovered ? 1 : 0, transition: 'opacity 160ms ease' }}>
                {service.type === 'external' && (
                  <DekutIcon type="externalLink" size={14} color="var(--text-secondary)" strokeWidth={2} />
                )}
              </span>
            </button>
          )
        })}

        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'transparent',
            border: '1px dashed var(--border)',
            borderRadius: 14,
            padding: '10px 12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 13, fontWeight: 700,
            color: 'var(--text-primary)',
            marginTop: 2,
          }}
        >
          See More <DekutIcon type="chevronRight" size={14} color="var(--text-primary)" strokeWidth={2.2} />
        </button>
      </div>

      {modalOpen && (
        <DekutServicesModal
          categories={DEKUT_CATEGORIES}
          usage={usage}
          onNavigate={onNavigate}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
