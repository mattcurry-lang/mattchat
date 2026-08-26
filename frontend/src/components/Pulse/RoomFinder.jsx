// src/components/Pulse/RoomFinder.jsx
//
// "Where are you going?" (spec §4). Backed by the dekut_locations Supabase
// table — verified rows are searchable by everyone; students can suggest
// new ones; admins moderate the queue and place pins on the schematic map.

import React, { useState, useMemo } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import { useDekutLocations } from '../../hooks/useDekutLocations'
import SuggestLocationForm from './SuggestLocationForm'
import DekutCampusMap from './DekutCampusMap'

const CATEGORY_LABELS = {
  lecture: 'Lecture Room', office: 'Office', facility: 'Facility',
  hostel: 'Hostel', dining: 'Dining', other: 'Location',
}

function matchesQuery(loc, q) {
  if (!q) return true
  const s = q.toLowerCase()
  return (
    loc.name.toLowerCase().includes(s) ||
    (loc.building || '').toLowerCase().includes(s) ||
    (loc.room_number || '').toLowerCase().includes(s) ||
    (loc.description || '').toLowerCase().includes(s) ||
    (loc.landmark || '').toLowerCase().includes(s) ||
    (loc.keywords || []).some((k) => k.toLowerCase().includes(s))
  )
}

function LocationCard({ loc }) {
  return (
    <div style={{
      background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{loc.name}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
        {CATEGORY_LABELS[loc.category] || 'Location'}
        {loc.building ? ` · ${loc.building}` : ''}
        {loc.floor ? ` · ${loc.floor}` : ''}
        {loc.room_number ? ` · Room ${loc.room_number}` : ''}
      </div>
      {loc.landmark && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>📍 {loc.landmark}</div>}
      {loc.walking_distance_min && (
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>🚶 ~{loc.walking_distance_min} min walk</div>
      )}
    </div>
  )
}

// onClose: renders a close button when present (mounted full-screen).
export default function RoomFinder({ onClose, userId, isAdmin }) {
  const { locations, pending, loading, submitLocation, approveLocation, rejectLocation, setMapPosition } =
    useDekutLocations({ userId, isAdmin })
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('search') // 'search' | 'map' | 'pending'
  const [showSuggest, setShowSuggest] = useState(false)

  const results = useMemo(() => locations.filter((l) => matchesQuery(l, query)), [locations, query])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden="true">📍</span> Find a Room
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
            Search for a room, office or facility on campus.
          </div>
        </div>
        {typeof onClose === 'function' && (
          <button
            onClick={onClose}
            aria-label="Close Room Finder"
            style={{
              background: 'var(--bg-surface-1, rgba(0,0,0,0.06))', border: '1px solid var(--border)',
              borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <DekutIcon type="x" size={16} color="var(--text-primary)" strokeWidth={2.2} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, margin: '16px 0 14px' }}>
        {[
          { id: 'search', label: 'Search' },
          { id: 'map', label: 'Map' },
          ...(isAdmin ? [{ id: 'pending', label: `Pending${pending.length ? ` (${pending.length})` : ''}` }] : []),
        ].map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                borderRadius: 999, padding: '6px 14px',
                border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
                background: active ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : 'transparent',
                color: active ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'search' && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px',
            background: 'var(--bg-surface-1, rgba(0,0,0,0.03))', marginBottom: 12,
          }}>
            <DekutIcon type="search" size={16} color="var(--text-secondary)" strokeWidth={2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. RC18, library, finance office…"
              autoFocus
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 13.5, color: 'var(--text-primary)', width: '100%', fontFamily: 'inherit',
              }}
            />
          </div>

          {loading && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', padding: '10px 2px' }}>Loading locations…</div>}

          {!loading && results.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', padding: '10px 2px' }}>
              {locations.length === 0 ? "No verified locations yet — be the first to suggest one." : 'No matches. Try a different word.'}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((loc) => <LocationCard key={loc.id} loc={loc} />)}
          </div>

          <button
            onClick={() => setShowSuggest(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', marginTop: 14, background: 'transparent', border: '1px dashed var(--border)',
              borderRadius: 14, padding: '11px 12px', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
            }}
          >
            + Suggest a location
          </button>
        </>
      )}

      {tab === 'map' && (
        <DekutCampusMap
          locations={locations}
          isAdmin={!!isAdmin}
          onSetPosition={setMapPosition}
        />
      )}

      {tab === 'pending' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pending.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', padding: '10px 2px' }}>Nothing to review.</div>
          )}
          {pending.map((loc) => (
            <div key={loc.id} style={{
              background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <LocationCard loc={loc} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => approveLocation(loc.id)}
                  style={{
                    flex: 1, background: 'linear-gradient(135deg,#4ade80,#22c55e)', border: 'none',
                    borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 12, padding: '8px 0',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => rejectLocation(loc.id)}
                  style={{
                    flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 10, color: '#f87171', fontWeight: 700, fontSize: 12, padding: '8px 0',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showSuggest && (
        <SuggestLocationForm onSubmit={submitLocation} onClose={() => setShowSuggest(false)} />
      )}
    </div>
  )
}
