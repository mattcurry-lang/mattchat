import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import { DEKUT_CATEGORIES, DEFAULT_FEATURED_IDS, getServiceById } from '../../data/dekutServices'
import { useDekutUsage } from '../../hooks/useDekutUsage'
import DekutServicesModal from './DekutServicesModal'
import { openDekutService } from '../../utils/dekutOpenService'

export default function DeKUTHubCard({ onNavigate, userId, orbHidden }) {
  const [hoveredId, setHoveredId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const usage = useDekutUsage('dekut')

  const featured = DEFAULT_FEATURED_IDS.map((id) => getServiceById(id, DEKUT_CATEGORIES)).filter(Boolean)

  const openService = (service) => openDekutService(service, { usage, onNavigate })

  const navigateAndCloseModal = (route, service) => {
    setModalOpen(false)
    onNavigate?.(route, service)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'relative',
        borderRadius: 24,
        padding: '20px 18px',
        background: 'linear-gradient(145deg, rgba(30, 26, 60, 0.9) 0%, rgba(18, 15, 38, 0.95) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(167,139,250,0.25)',
        boxShadow: '0 15px 35px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient light orb */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: -50, right: -50, width: 150, height: 150,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.25), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Header section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ 
            width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: '0 4px 12px rgba(108,99,255,0.4)'
          }}>
            🎓
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>DeKUT Hub</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>Dedan Kimathi University Portal</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.12)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(167,139,250,0.2)' }}>
          Campus Live
        </div>
      </div>

      {/* Featured Service List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', zIndex: 1 }}>
        {featured.map((service) => {
          const isHovered = hoveredId === service.id
          return (
            <motion.button
              key={service.id}
              onClick={() => openService(service)}
              onMouseEnter={() => setHoveredId(service.id)}
              onMouseLeave={() => setHoveredId(null)}
              whileHover={{ scale: 1.01, translateY: -1 }}
              whileTap={{ scale: 0.98 }}
              aria-label={service.type === 'internal' ? `Open ${service.name}` : `Open DeKUT ${service.name} in a new tab`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: isHovered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                border: isHovered ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '12px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                width: '100%',
                boxShadow: isHovered ? '0 8px 20px -6px rgba(108,99,255,0.3)' : 'none',
                transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: ICON_GRADIENTS[service.icon] || 'linear-gradient(135deg, #6c63ff, #a78bfa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                transform: isHovered ? 'scale(1.05) rotate(-3deg)' : 'scale(1) rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}>
                <DekutIcon type={service.icon} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#f8fafc', marginBottom: 2 }}>{service.name}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {service.description}
                </div>
              </div>

              <div style={{ 
                width: 28, height: 28, borderRadius: '50%', background: isHovered ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                transition: 'background 0.2s ease'
              }}>
                <DekutIcon type={service.type === 'internal' ? 'chevronRight' : 'externalLink'} size={13} color={isHovered ? '#a78bfa' : 'rgba(255,255,255,0.6)'} strokeWidth={2.2} />
              </div>
            </motion.button>
          )
        })}

        {/* See More Button */}
        <motion.button
          onClick={() => setModalOpen(true)}
          whileHover={{ scale: 1.01, backgroundColor: 'rgba(167,139,250,0.15)' }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'rgba(167,139,250,0.08)',
            border: '1px dashed rgba(167,139,250,0.35)',
            borderRadius: 16,
            padding: '11px 14px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 13, fontWeight: 700,
            color: '#c4b5fd',
            marginTop: 4,
            transition: 'background 0.2s ease',
          }}
        >
          <span>Explore All DeKUT Services & Portals</span>
          <DekutIcon type="chevronRight" size={14} color="#c4b5fd" strokeWidth={2.5} />
        </motion.button>
      </div>

      {modalOpen && (
        <DekutServicesModal
          categories={DEKUT_CATEGORIES}
          usage={usage}
          onNavigate={navigateAndCloseModal}
          onClose={() => setModalOpen(false)}
        />
      )}
    </motion.div>
  )
}
