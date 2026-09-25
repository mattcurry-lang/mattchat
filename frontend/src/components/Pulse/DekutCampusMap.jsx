// src/components/Pulse/DekutCampusMap.jsx
//
// A schematic (non-GPS) campus map. Pins only appear where an admin has
// deliberately placed them, and paths (edges) only exist where an admin
// has deliberately drawn them — nothing here invents real-world
// coordinates or distances.
//
// Phase 3: adds the walking-path graph (edges between pins) and route
// highlighting. The map gets a subtle perspective tilt for visual depth
// when idle, but goes flat during any admin editing (placing a pin,
// drawing a path) — a 3D CSS transform skews the coordinate math a
// click needs, so precision wins over style while actually editing.
//
// No literal 3D campus (real buildings, GPS): that would mean either
// fabricating architectural data that doesn't exist, or acquiring real
// data this project doesn't have — a data problem, not a styling one.
// Edge "weight" is a relative admin-set value, not a real distance, so
// this deliberately never prints an invented walking-time estimate.

import React, { useMemo, useState,useEffect } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import { findShortestPath } from '../../utils/routeGraph'

const TEXT_PRIMARY = '#f5f5fa'
const TEXT_SECONDARY = 'rgba(245,245,250,0.6)'
const BORDER = 'rgba(245,245,250,0.16)'
const SURFACE = 'rgba(245,245,250,0.06)'

// originLocationId/destinationLocationId: optional — when both are
// given, this is how Curry's SHOW_ROUTE action (dekut-curry's
// calculate_route tool) hands a route off to this map.
export default function DekutCampusMap({ locations, edges = [], isAdmin, onSetPosition, onConnect, onDisconnect, originLocationId, destinationLocationId }) {
  const [selected, setSelected] = useState(null) // location id being viewed
  const [placingId, setPlacingId] = useState('') // location id chosen from the "place" dropdown
  const [connectMode, setConnectMode] = useState(false)
  const [connectFirstId, setConnectFirstId] = useState(null)
  const [selected, setSelected] = useState(destinationLocationId ?? null)

  useEffect(() => {
  if (destinationLocationId) setSelected(destinationLocationId)
}, [destinationLocationId])
  const placed = locations.filter((l) => l.map_x != null && l.map_y != null)
  const unplaced = locations.filter((l) => l.map_x == null || l.map_y == null)
  const byId = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations])

  const route = useMemo(() => {
    if (!originLocationId || !destinationLocationId) return null
    return findShortestPath(edges, originLocationId, destinationLocationId) // null if no connecting path exists yet
  }, [edges, originLocationId, destinationLocationId])

  const routeEdgeKeys = useMemo(() => {
    if (!route) return new Set()
    const keys = new Set()
    for (let i = 0; i < route.path.length - 1; i++) {
      keys.add([route.path[i], route.path[i + 1]].sort().join('|'))
    }
    return keys
  }, [route])

  const isEditing = isAdmin && (!!placingId || connectMode)

  const handleCanvasClick = (e) => {
    if (!isAdmin || !placingId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    onSetPosition(placingId, Math.round(x * 10) / 10, Math.round(y * 10) / 10)
    setPlacingId('')
  }

  const handlePinClick = (e, loc) => {
    e.stopPropagation()
    if (connectMode) {
      if (!connectFirstId) {
        setConnectFirstId(loc.id)
      } else if (connectFirstId === loc.id) {
        setConnectFirstId(null) // tapped the same pin again — deselect
      } else {
        onConnect?.(connectFirstId, loc.id)
        setConnectFirstId(null)
      }
      return
    }
    setSelected(loc.id)
  }

  const selectedLoc = placed.find((l) => l.id === selected)

  return (
    <div>
      {isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {unplaced.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(167,139,250,0.1)', border: '1px dashed rgba(167,139,250,0.4)',
              borderRadius: 12, padding: '9px 12px', fontSize: 12,
            }}>
              <span style={{ color: TEXT_SECONDARY, flexShrink: 0 }}>Place a pin:</span>
              <select
                value={placingId}
                onChange={(e) => { setPlacingId(e.target.value); setConnectMode(false); setConnectFirstId(null) }}
                style={{
                  flex: 1, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '5px 8px',
                  fontSize: 12, background: SURFACE, color: TEXT_PRIMARY, fontFamily: 'inherit',
                }}
              >
                <option value="" style={{ background: '#14141f', color: TEXT_PRIMARY }}>Choose an unplaced location…</option>
                {unplaced.map((l) => <option key={l.id} value={l.id} style={{ background: '#14141f', color: TEXT_PRIMARY }}>{l.name}</option>)}
              </select>
              {placingId && <span style={{ color: '#c4b5fd', fontWeight: 700, flexShrink: 0 }}>Tap the map →</span>}
            </div>
          )}

          {placed.length >= 2 && (
            <button
              onClick={() => { setConnectMode((v) => !v); setConnectFirstId(null); setPlacingId('') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
                background: connectMode ? 'rgba(52,211,153,0.14)' : SURFACE,
                border: `1px solid ${connectMode ? 'rgba(52,211,153,0.4)' : BORDER}`,
                borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                color: connectMode ? '#6ee7b7' : TEXT_SECONDARY, fontFamily: 'inherit',
              }}
            >
              {connectMode
                ? (connectFirstId ? `Tap the destination pin for ${byId.get(connectFirstId)?.name ?? 'this path'}…` : 'Tap two pins to connect them')
                : 'Draw a walking path'}
            </button>
          )}
        </div>
      )}

      <div
        onClick={handleCanvasClick}
        style={{
          position: 'relative', width: '100%', aspectRatio: '4 / 3',
          background: 'linear-gradient(135deg, rgba(167,139,250,0.1), rgba(108,99,255,0.1))',
          border: `1px solid ${BORDER}`, borderRadius: 18, overflow: 'hidden',
          cursor: isAdmin && placingId ? 'crosshair' : 'default',
          transform: isEditing ? 'none' : 'perspective(900px) rotateX(6deg)',
          transformOrigin: 'center top',
          transition: 'transform 300ms ease',
        }}
      >
        {placed.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, textAlign: 'center', fontSize: 12.5, color: TEXT_SECONDARY,
          }}>
            {isAdmin
              ? 'No pins placed yet — pick a location above and tap where it is.'
              : "The campus map isn't set up yet. Try searching for a room instead."}
          </div>
        )}

        {/* Edges — drawn first, under the pins. viewBox 0-100 matches the
            pins' percentage-based positioning directly. */}
        {placed.length >= 2 && (
          <svg
            viewBox="0 0 100 100" preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            {edges.map((edge) => {
              const a = byId.get(edge.location_a_id)
              const b = byId.get(edge.location_b_id)
              if (!a || a.map_x == null || !b || b.map_x == null) return null
              const onRoute = routeEdgeKeys.has([edge.location_a_id, edge.location_b_id].sort().join('|'))
              return (
                <line
                  key={edge.id}
                  x1={a.map_x} y1={a.map_y} x2={b.map_x} y2={b.map_y}
                  stroke={onRoute ? '#22d3ee' : 'rgba(245,245,250,0.22)'}
                  strokeWidth={onRoute ? 1.4 : 0.6}
                  strokeDasharray={onRoute ? undefined : '2 2'}
                  vectorEffect="non-scaling-stroke"
                  style={onRoute ? { filter: 'drop-shadow(0 0 3px rgba(34,211,238,0.7))' } : undefined}
                />
              )
            })}

            {/* Traveling dot along the highlighted route */}
            {route && route.path.length > 1 && (
              <circle r="1.3" fill="#22d3ee" style={{ filter: 'drop-shadow(0 0 3px rgba(34,211,238,0.9))' }}>
                <animateMotion
                  dur="2.5s"
                  repeatCount="indefinite"
                  path={`M ${route.path.map((id) => { const l = byId.get(id); return `${l?.map_x ?? 0} ${l?.map_y ?? 0}` }).join(' L ')}`}
                />
              </circle>
            )}
          </svg>
        )}

        {placed.map((loc) => {
          const isConnectSelected = connectFirstId === loc.id
          const onRoute = route?.path.includes(loc.id)
          return (
            <button
              key={loc.id}
              onClick={(e) => handlePinClick(e, loc)}
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
                boxShadow: isConnectSelected
                  ? '0 0 0 3px rgba(110,231,183,0.6), 0 4px 10px rgba(0,0,0,0.4)'
                  : onRoute
                    ? '0 0 0 3px rgba(34,211,238,0.5), 0 4px 10px rgba(0,0,0,0.4)'
                    : '0 4px 10px rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
              }}>
                <div style={{ transform: 'rotate(45deg)', color: '#fff', fontSize: 11 }} aria-hidden="true">
                  <DekutIcon type={loc.icon || 'file'} size={12} color="#fff" strokeWidth={2.4} />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {route === null && originLocationId && destinationLocationId && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: TEXT_SECONDARY }}>
          No walking path has been drawn between these two locations yet — an admin can add one.
        </div>
      )}

      {selectedLoc && (
        <div style={{
          marginTop: 10, background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: TEXT_PRIMARY }}>{selectedLoc.name}</div>
            <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, marginTop: 2 }}>
              {[selectedLoc.building, selectedLoc.floor, selectedLoc.room_number && `Room ${selectedLoc.room_number}`].filter(Boolean).join(' · ')}
            </div>
            {selectedLoc.landmark && <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, marginTop: 4 }}>{selectedLoc.landmark}</div>}
          </div>
          {isAdmin && (
            <button
              onClick={() => { setConnectMode(true); setConnectFirstId(selectedLoc.id); setSelected(null) }}
              title="Draw a path from here"
              style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 4 }}
            >
              <DekutIcon type="chevronRight" size={14} color={TEXT_SECONDARY} strokeWidth={2} />
            </button>
          )}
          <button onClick={() => setSelected(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <DekutIcon type="x" size={14} color={TEXT_SECONDARY} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}
