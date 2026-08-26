// src/components/Pulse/RoomFinder.jsx
//
// "Where are you going?" — search DeKUT rooms/offices/facilities by name,
// room number or keyword, then see building/floor/room detail. The
// "Take Me There" button calls onStartNavigation if the host app passes
// one in; until real pedestrian navigation (spec section 5) exists, it
// falls back to a disabled state rather than pretending to navigate.
//
// Mounted as the target of the 'room-finder' internal service — see
// dekutOpenService.js and the 'room-finder' entry in dekutServices.js.

import React, { useMemo, useState } from 'react'
import { DekutIcon } from './dekutIcons'
import { DEKUT_LOCATIONS, LOCATION_CATEGORIES, searchLocations } from '../../data/dekutLocations'

function LocationMetaLine({ location }) {
  const parts = [location.building, location.floor, location.roomNumber].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{parts.join(' · ')}</div>
  )
}

function ResultRow({ location, onSelect }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={() => onSelect(location)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', textAlign: 'left', fontFamily: 'inherit',
        background: hovered ? 'var(--bg-surface-1, rgba(0,0,0,0.04))' : 'transparent',
        border: '1px solid var(--border)', borderRadius: 14,
        padding: '11px 12px', cursor: 'pointer',
        transition: 'background 160ms ease',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{location.name}</div>
        <LocationMetaLine location={location} />
      </div>
      <span style={{
        fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)',
        border: '1px solid var(--border)', borderRadius: 999, padding: '2px 8px', flexShrink: 0,
      }}>
        {LOCATION_CATEGORIES[location.category] || 'Location'}
      </span>
    </button>
  )
}

function DetailRow({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12.5 }}>
      <span style={{ color: 'var(--text-secondary)', minWidth: 90, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function LocationDetail({ location, onBack, onStartNavigation }) {
  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14,
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', padding: 0,
        }}
      >
        <span aria-hidden="true">←</span>
        Back to results
      </button>

      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>{location.name}</div>
      <div style={{
        display: 'inline-block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)',
        border: '1px solid var(--border)', borderRadius: 999, padding: '2px 8px', margin: '6px 0 14px',
      }}>
        {LOCATION_CATEGORIES[location.category] || 'Location'}
      </div>

      {location.description && (
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
          {location.description}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <DetailRow label="Building" value={location.building} />
        <DetailRow label="Floor" value={location.floor} />
        <DetailRow label="Room" value={location.roomNumber} />
        <DetailRow label="Hours" value={location.openingHours} />
        <DetailRow label="Distance" value={location.walkingDistance} />
        {location.services && location.services.length > 0 && (
          <DetailRow label="Services" value={location.services.join(', ')} />
        )}
        {location.landmarks && location.landmarks.length > 0 && (
          <DetailRow label="Near" value={location.landmarks.join(', ')} />
        )}
      </div>

      {typeof onStartNavigation === 'function' ? (
        <button
          onClick={() => onStartNavigation(location)}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg, #6C63FF, #A78BFA)', color: '#fff',
            fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
          }}
        >
          Take Me There →
        </button>
      ) : (
        <div style={{
          width: '100%', padding: '12px 16px', borderRadius: 14,
          border: '1px dashed var(--border)', color: 'var(--text-secondary)',
          fontSize: 12.5, textAlign: 'center',
        }}>
          Turn-by-turn navigation isn't available yet.
        </div>
      )}
    </div>
  )
}

// locations: defaults to real DEKUT_LOCATIONS. Pass DEV_SAMPLE_LOCATIONS
// explicitly in a dev harness if you want to see the UI populated.
// onStartNavigation: optional (location) => void, for when campus
// navigation (spec section 5) exists.
export default function RoomFinder({ locations = DEKUT_LOCATIONS, onStartNavigation }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const results = useMemo(() => searchLocations(query, locations), [query, locations])

  return (
    <div
      style={{
        borderRadius: 20, padding: 16,
        background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
        📍 Where are you going?
      </div>

      {!selected && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid var(--border)', borderRadius: 12, padding: '9px 12px',
            background: 'var(--bg-surface-1, rgba(0,0,0,0.03))', marginBottom: 12,
          }}>
            <DekutIcon type="search" size={16} color="var(--text-secondary)" strokeWidth={2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="RC18, Library, Finance Office..."
              autoFocus
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 13.5, color: 'var(--text-primary)', width: '100%', fontFamily: 'inherit',
              }}
            />
          </div>

          {locations.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Room and location data hasn't been loaded yet. Once DeKUT ICT provides campus
              data, you'll be able to search rooms, offices and facilities here.
            </div>
          )}

          {locations.length > 0 && query.trim() === '' && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Start typing a room number, building or office name.
            </div>
          )}

          {locations.length > 0 && query.trim() !== '' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  No matches for "{query}". Try a room code, building or office name.
                </div>
              ) : (
                results.map((loc) => (
                  <ResultRow key={loc.id} location={loc} onSelect={setSelected} />
                ))
              )}
            </div>
          )}
        </>
      )}

      {selected && (
        <LocationDetail
          location={selected}
          onBack={() => setSelected(null)}
          onStartNavigation={onStartNavigation}
        />
      )}
    </div>
  )
}
