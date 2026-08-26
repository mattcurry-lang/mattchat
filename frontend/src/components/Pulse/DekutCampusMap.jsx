// src/components/Pulse/DekutCampusMap.jsx
//
// A schematic (non-GPS) campus map. Pins only appear where an admin has
// deliberately placed them — nothing here invents real-world coordinates.
// Admins place pins by picking an unplaced location and clicking the
// canvas; everyone else just sees the resulting map.

import React, { useState } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'

export default function DekutCampusMap({ locations, isAdmin, onSetPosition }) {
  const [selected, setSelected] = useState(null) // location id being viewed
  const [placingId, setPlacingId] = useState('') // location id chosen from the "place" dropdown

  const placed = locations.filter((l) => l.map_x != null && l.map_y != null)
  const unplaced = locations.filter((l) => l.map_x == null || l.map_y == null)

  const handleCanvasClick = (e) => {
    if (!isAdmin || !placingId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    onSetPosition(placingId, Math.round(x * 10) / 10, Math.round(y * 10) / 10)
    setPlacingId('')
  }

  const selectedLoc = placed.find((l) => l.id === selected)

  return (
    <div>
      {isAdmin && unplaced.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          background: 'rgba(167,139,250,0.08)', border: '1px dashed rgba(167,139,250,0.35)',
          borderRadius: 12, padding: '9px 12px', fontSize: 12,
        }}>
          <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>Place a pin:</span>
          <select
            value={placingId}
            onChange={(e) => setPlacingId(e.target.value)}
            style={{
              flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px',
              fontSize: 12, background: 'var(--bg-surface-1, #fff)', color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          >
            <option value="">Choose an unplaced location…</option>
            {unplaced.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          {placingId && <span style={{ color: '#a78bfa', fontWeight: 700, flexShrink: 0 }}>Tap the map →</span>}
        </div>
      )}

      <div
        onClick={handleCanvasClick}
        style={{
          position: 'relative', width: '100%', aspectRatio: '4 / 3',
          background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(108,99,255,0.06))',
          border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden',
          cursor: isAdmin && placingId ? 'crosshair' : 'default',
        }}
      >
        {placed.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, textAlign: 'center', fontSize: 12.5, color: 'var(--text-secondary)',
          }}>
            {isAdmin
              ? 'No pins placed yet — pick a location above and tap where it is.'
              : "The campus map isn't set up yet. Try searching for a room instead."}
          </div>
        )}

        {placed.map((loc) => (
          <button
            key={loc.id}
            onClick={(e) => { e.stopPropagation(); setSelected(loc.id) }}
            aria-label={loc.name}
            style={{
              position: 'absolute', left: `${loc.map_x}%`, top: `${loc.map_y}%`,
              transform: 'translate(-50%, -100%)', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
              background: ICON_GRADIENTS[loc.icon] || 'linear-gradient(135deg,#a78bfa,#6c63ff)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
            }}>
              <div style={{ transform: 'rotate(45deg)', color: '#fff', fontSize: 11 }}>📍</div>
            </div>
          </button>
        ))}
      </div>

      {selectedLoc && (
        <div style={{
          marginTop: 10, background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedLoc.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              {[selectedLoc.building, selectedLoc.floor, selectedLoc.room_number && `Room ${selectedLoc.room_number}`].filter(Boolean).join(' · ')}
            </div>
            {selectedLoc.landmark && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>📍 {selectedLoc.landmark}</div>}
          </div>
          <button onClick={() => setSelected(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <DekutIcon type="x" size={14} color="var(--text-secondary)" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}
