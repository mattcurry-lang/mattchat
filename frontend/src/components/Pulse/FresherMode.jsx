// src/components/Pulse/FresherMode.jsx
//
// Dedicated landing screen for new students (spec section 7). Two kinds
// of tiles:
//  - real ones, backed by an actual entry in dekutServices.js — tapping
//    opens it via the same openDekutService used everywhere else.
//  - "coming soon" ones, for features the spec wants that don't exist yet
//    (Wi-Fi Finder, email setup guide, campus tour, timetable). These are
//    inert by design — no fabricated links, no placeholder content
//    standing in for real DeKUT info.
//
// Mounted as the target of the 'fresher-mode' internal service.
//
// FIX: hardcoded contrast-safe colors — same dark-overlay text-visibility
// bug as RoomFinder.jsx / SuggestLocationForm.jsx (this always mounts on
// the hardcoded-dark fullscreen wrapper in PulsePage.jsx, but was using
// var(--text-primary)/var(--border), which flip dark in light mode).

import React, { useState } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import { DEKUT_CATEGORIES, getServiceById } from '../../data/dekutServices'
import { useDekutUsage } from '../../hooks/useDekutUsage'
import { openDekutService } from '../../utils/dekutOpenService'

const TEXT_PRIMARY = '#f5f5fa'
const TEXT_SECONDARY = 'rgba(245,245,250,0.6)'
const BORDER = 'rgba(245,245,250,0.16)'
const SURFACE = 'rgba(245,245,250,0.06)'

// Real services this screen surfaces, in display order.
// 'faq' and 'email-setup' added now that both are real pages, not stubs.
const FRESHER_SERVICE_IDS = [
  'room-finder',
  'faq',
  'email-setup',
  'elearning',
  'student-portal',
  'catering',
  'medical',
  'accommodation',
  'fees',
  'contacts',
]

// Features the spec calls for that aren't built yet. Intentionally no
// url/route — rendered disabled, never wired to a guess.
const COMING_SOON_TILES = [
  { id: 'explore-campus', name: 'Explore Campus', description: 'An interactive campus tour.', icon: 'megaphone' },
  { id: 'find-my-class', name: 'Find My Class', description: 'Look up your timetable and classroom.', icon: 'calendar' },
  { id: 'wifi-finder', name: 'Find Wi-Fi', description: 'Campus Wi-Fi hotspots and signal info.', icon: 'cpu' },
]

function FresherTile({ name, description, icon, comingSoon, onOpen }) {
  const [hovered, setHovered] = useState(false)
  const active = !comingSoon

  return (
    <button
      onClick={() => active && onOpen()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={!active}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: 14,
        cursor: active ? 'pointer' : 'default',
        opacity: active ? 1 : 0.55,
        textAlign: 'left',
        fontFamily: 'inherit',
        transform: hovered && active ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered && active ? '0 10px 24px -12px rgba(108,99,255,0.5)' : 'none',
        transition: 'transform 160ms ease, box-shadow 200ms ease',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: ICON_GRADIENTS[icon] || ICON_GRADIENTS.file,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <DekutIcon type={icon} size={18} />
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: TEXT_PRIMARY }}>{name}</div>
        <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, marginTop: 2, lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
      {comingSoon && (
        <span style={{
          fontSize: 10, fontWeight: 700, color: TEXT_SECONDARY,
          border: `1px solid ${BORDER}`, borderRadius: 999,
          padding: '2px 8px', alignSelf: 'flex-start',
        }}>
          Coming soon
        </span>
      )}
    </button>
  )
}

// onNavigate: forwarded to internal services (e.g. tapping "Find a Room"
// here routes the same way it does from DeKUTHubCard).
// onClose: renders a close button when present (mounted full-screen).
export default function FresherMode({ onNavigate, onClose }) {
  const usage = useDekutUsage('dekut')

  const realServices = FRESHER_SERVICE_IDS
    .map((id) => getServiceById(id, DEKUT_CATEGORIES))
    .filter(Boolean)

  const openService = (service) => openDekutService(service, { usage, onNavigate })

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: TEXT_PRIMARY }}>
            👋 Welcome to DeKUT
          </div>
          <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, marginTop: 4, maxWidth: 420 }}>
            Your first days at university can be confusing. Here's where to start.
          </div>
        </div>
        {typeof onClose === 'function' && (
          <button
            onClick={onClose}
            aria-label="Close Fresher Guide"
            style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <DekutIcon type="x" size={16} color={TEXT_PRIMARY} strokeWidth={2.2} />
          </button>
        )}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10,
        marginTop: 18,
      }}>
        {realServices.map((service) => (
          <FresherTile
            key={service.id}
            name={service.name}
            description={service.description}
            icon={service.icon}
            onOpen={() => openService(service)}
          />
        ))}
        {COMING_SOON_TILES.map((tile) => (
          <FresherTile
            key={tile.id}
            name={tile.name}
            description={tile.description}
            icon={tile.icon}
            comingSoon
          />
        ))}
      </div>
    </div>
  )
}
