// src/components/Pulse/RoomFinder.jsx
//
// "Where are you going?" (spec §4). Backed by the dekut_locations Supabase
// table — verified rows are searchable by everyone; students can suggest
// new ones and attach walkthrough videos; admins moderate both queues and
// place pins on the schematic map.
//
// FIX: this component is always mounted inside a hardcoded-dark fullscreen
// overlay (see PulsePage.jsx — background: var(--bg-surface-1, #0f0f1a)),
// but it was using var(--text-primary)/var(--text-secondary) for its own
// text. Those variables flip to dark colors in light mode, so on a
// permanently-dark background you got dark text on a dark box — invisible.
// Same root cause as the DekutServicesModal search-box bug. Fixed here by
// hardcoding light, guaranteed-contrast colors for every piece of text and
// icon in this file instead of trusting theme variables.

import React, { useState, useMemo } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import { useDekutLocations } from '../../hooks/useDekutLocations'
import SuggestLocationForm from './SuggestLocationForm'
import AddVideoModal from './AddVideoModal'
import DekutCampusMap from './DekutCampusMap'

const TEXT_PRIMARY = '#f5f5fa'
const TEXT_SECONDARY = 'rgba(245,245,250,0.6)'
const BORDER = 'rgba(245,245,250,0.14)'
const SURFACE = 'rgba(245,245,250,0.06)'

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

// Renders an approved video — an <iframe> for known embeddable link hosts,
// a native <video> tag for uploads, or a plain "watch" link as a fallback
// for link hosts we don't specifically handle (never guesses at embed
// syntax for a site that doesn't support it).
function LocationVideo({ videoType, videoUrl }) {
  if (!videoUrl) return null

  if (videoType === 'upload') {
    return (
      <video
        src={videoUrl}
        controls
        playsInline
        style={{ width: '100%', borderRadius: 10, marginTop: 8, background: '#000', maxHeight: 220 }}
      />
    )
  }

  const ytMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/)
  if (ytMatch) {
    return (
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', marginTop: 8 }}>
        <iframe
          src={`https://www.youtube.com/embed/${ytMatch[1]}`}
          title="Location walkthrough video"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <a
      href={videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8,
        fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', textDecoration: 'none',
      }}
    >
      🎥 Watch walkthrough video <DekutIcon type="externalLink" size={12} color="#c4b5fd" strokeWidth={2} />
    </a>
  )
}

function LocationCard({ loc, onAddVideo, onDelete }) {
  const hasApprovedVideo = loc.is_video_verified && loc.video_type !== 'none' && loc.video_url

  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`,
      borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: TEXT_PRIMARY }}>{loc.name}</div>
        {hasApprovedVideo && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.4)',
            borderRadius: 999, padding: '2px 8px', flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            🎥 Has video
          </span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>
        {CATEGORY_LABELS[loc.category] || 'Location'}
        {loc.building ? ` · ${loc.building}` : ''}
        {loc.floor ? ` · ${loc.floor}` : ''}
        {loc.room_number ? ` · Room ${loc.room_number}` : ''}
      </div>
      {loc.landmark && <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>📍 {loc.landmark}</div>}
      {loc.walking_distance_min && (
        <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>🚶 ~{loc.walking_distance_min} min walk</div>
      )}

  {hasApprovedVideo && <LocationVideo videoType={loc.video_type} videoUrl={loc.video_url} />}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {onAddVideo && (
          <button
            onClick={() => onAddVideo(loc)}
            style={{
              alignSelf: 'flex-start', background: 'none', border: `1px dashed ${BORDER}`,
              borderRadius: 999, padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11, fontWeight: 700, color: TEXT_PRIMARY,
            }}
          >
            {hasApprovedVideo ? '+ Add another video' : '🎥 Add a video'}
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(loc)}
            style={{
              alignSelf: 'flex-start', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 999, padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11, fontWeight: 700, color: '#f87171',
            }}
          >
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  )
}

// onClose: renders a close button when present (mounted full-screen).
export default function RoomFinder({ onClose, userId, isAdmin }) {
  const {
    locations, pending, pendingVideos, loading,
    submitLocation, approveLocation, rejectLocation, setMapPosition,
    uploadLocationVideo, attachVideo, approveVideo, rejectVideo,
    deleteLocation, 
  } = useDekutLocations({ userId, isAdmin })
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('search') // 'search' | 'map' | 'pending'
  const [showSuggest, setShowSuggest] = useState(false)
  const [videoTarget, setVideoTarget] = useState(null) // location object | null

  const results = useMemo(() => locations.filter((l) => matchesQuery(l, query)), [locations, query])
  const pendingCount = pending.length + pendingVideos.length

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: TEXT_PRIMARY, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden="true">📍</span> Find a Room
          </div>
          <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, marginTop: 4 }}>
            Search for a room, office or facility on campus.
          </div>
        </div>
        {typeof onClose === 'function' && (
          <button
            onClick={onClose}
            aria-label="Close Room Finder"
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, margin: '16px 0 14px' }}>
        {[
          { id: 'search', label: 'Search' },
          { id: 'map', label: 'Map' },
          ...(isAdmin ? [{ id: 'pending', label: `Pending${pendingCount ? ` (${pendingCount})` : ''}` }] : []),
        ].map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                borderRadius: 999, padding: '6px 14px',
                border: `1px solid ${active ? 'transparent' : BORDER}`,
                background: active ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : 'transparent',
                color: active ? '#fff' : TEXT_SECONDARY,
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
            border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px',
            background: SURFACE, marginBottom: 12,
          }}>
            <DekutIcon type="search" size={16} color={TEXT_SECONDARY} strokeWidth={2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. RC18, library, finance office…"
              autoFocus
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 13.5, color: TEXT_PRIMARY, width: '100%', fontFamily: 'inherit',
              }}
            />
          </div>

          {loading && <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, padding: '10px 2px' }}>Loading locations…</div>}

          {!loading && results.length === 0 && (
            <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, padding: '10px 2px' }}>
              {locations.length === 0 ? "No verified locations yet — be the first to suggest one." : 'No matches. Try a different word.'}
            </div>
          )}

                   <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((loc) => (
              <LocationCard
                key={loc.id}
                loc={loc}
                onAddVideo={userId ? setVideoTarget : null}
                onDelete={isAdmin ? (l) => {
                  if (window.confirm(`Delete "${l.name}"? This can't be undone.`)) deleteLocation(l.id)
                } : null}
              />
            ))}
          </div>

          <button
            onClick={() => setShowSuggest(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', marginTop: 14, background: 'transparent', border: `1px dashed ${BORDER}`,
              borderRadius: 14, padding: '11px 12px', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 8 }}>
              New locations
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.length === 0 && (
                <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, padding: '4px 2px' }}>Nothing to review.</div>
              )}
              {pending.map((loc) => (
                <div key={loc.id} style={{
                  background: SURFACE, border: `1px solid ${BORDER}`,
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
                        flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
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
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 8 }}>
              Videos awaiting review
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingVideos.length === 0 && (
                <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, padding: '4px 2px' }}>Nothing to review.</div>
              )}
              {pendingVideos.map((loc) => (
                <div key={loc.id} style={{
                  background: SURFACE, border: `1px solid ${BORDER}`,
                  borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: TEXT_PRIMARY }}>{loc.name}</div>
                  <LocationVideo videoType={loc.video_type} videoUrl={loc.video_url} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => approveVideo(loc.id)}
                      style={{
                        flex: 1, background: 'linear-gradient(135deg,#4ade80,#22c55e)', border: 'none',
                        borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 12, padding: '8px 0',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectVideo(loc.id)}
                      style={{
                        flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
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
          </div>
        </div>
      )}

      {showSuggest && (
        <SuggestLocationForm onSubmit={submitLocation} onClose={() => setShowSuggest(false)} />
      )}

      {videoTarget && (
        <AddVideoModal
          location={videoTarget}
          onUpload={uploadLocationVideo}
          onAttach={attachVideo}
          onClose={() => setVideoTarget(null)}
        />
      )}
    </div>
  )
}
