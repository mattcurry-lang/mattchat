import { useState, useRef, useEffect } from 'react'

// CurryBubble — a round orb (sphere) button, matching the floating
// Curry FAB style already in the app. Collapsed = just the sphere,
// sitting inline at the top of the chat list (no weather repeated,
// no tall card pushing chats down). Tap it to pop open a small
// overlay panel with everything — greeting, weather, brief stats.
// The panel floats ABOVE the chat list (absolute position) so the
// list never shifts or disappears — tap the orb again, or click
// outside, to close it.
//
// Props: same data as before. Nothing new to fetch.

export default function CurryBubble({
  userName,             // e.g. "Mathew"
  weather,              // { tempC: 18, condition: "Partly cloudy", icon: "☁️" }
  activeConversations,  // number
  sharedWithCurryCount, // number
  onOpenCurry,          // fn — what "Open Curry" button does
}) {
  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef(null)
  const greeting = getGreeting()

  // Close on outside click
  useEffect(() => {
    if (!expanded) return
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [expanded])

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', padding: '10px 16px', display: 'flex' }}
    >
      {/* The sphere itself */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-label="Curry brief"
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          background: 'radial-gradient(circle at 30% 30%, #a78bfa, #7c3aed 60%, #5b21b6)',
          boxShadow: expanded
            ? '0 0 0 4px rgba(139,92,246,0.25), 0 4px 14px rgba(124,58,237,0.5)'
            : '0 4px 14px rgba(124,58,237,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'box-shadow 0.15s ease',
        }}
      >
        ✨
      </button>

      {/* Little inline hint next to the sphere when collapsed */}
      {!expanded && (
        <div
          style={{
            marginLeft: 10,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            color: '#e5e0ff',
            fontSize: 12,
            opacity: 0.8,
            cursor: 'pointer',
          }}
          onClick={() => setExpanded(true)}
        >
          <span style={{ fontWeight: 500 }}>{greeting}, {userName}</span>
          {weather && (
            <span style={{ opacity: 0.7 }}>{weather.icon} {weather.tempC}°C · tap for brief</span>
          )}
        </div>
      )}

      {/* Expanded overlay panel — floats over the chat list, doesn't push it down */}
      {expanded && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 16,
            right: 16,
            marginTop: 8,
            background: '#1e1836',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: 16,
            padding: 16,
            color: '#e5e0ff',
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            zIndex: 30,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              🙂 {greeting}, {userName}!
            </div>
            <button
              onClick={() => setExpanded(false)}
              style={{ background: 'none', border: 'none', color: '#e5e0ff', opacity: 0.6, cursor: 'pointer', fontSize: 16 }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {weather && (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
              {weather.icon} {weather.tempC}°C, {weather.condition}
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, opacity: 0.9 }}>
            💬 {activeConversations} conversation{activeConversations === 1 ? '' : 's'} active today
            <br />
            ✨ {sharedWithCurryCount} chat{sharedWithCurryCount === 1 ? '' : 's'} shared with Curry
          </div>

          <button
            onClick={onOpenCurry}
            style={{
              marginTop: 14,
              background: 'linear-gradient(90deg, #8b5cf6, #6366f1)',
              border: 'none',
              borderRadius: 10,
              padding: '8px 16px',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Open Curry
          </button>
        </div>
      )}
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
