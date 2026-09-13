// src/components/Pulse/CurryOrb.jsx
//
// Floating "Ask Curry" launcher. Portals to document.body so it floats
// fixed above the viewport no matter where DeKUTHubCard sits in Pulse's
// scroll container — same reasoning as DekutServicesModal's portal use.
//
// hidden: pass true while another DeKUT Hub fullscreen view is already
// open (RoomFinder, FresherMode, etc.) so two fullscreen layers never
// stack. This does NOT affect the orb's own opened AskCurry overlay in
// normal use — see PulsePage's orbHidden calculation.

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import AskCurry from './AskCurry'

export default function CurryOrb({ userId, onNavigate, hidden }) {
  const [open, setOpen] = useState(false)

  if (hidden) return null

  return createPortal(
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask Curry"
          style={{
            position: 'fixed', bottom: 22, right: 20, zIndex: 900,
            width: 58, height: 58, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#a78bfa,#6c63ff)',
            boxShadow: '0 8px 24px -6px rgba(108,99,255,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'curryOrbBreathe 3.2s ease-in-out infinite',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 24, position: 'relative', zIndex: 1 }}>🤖</span>
          <span aria-hidden="true" style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            border: '1.5px solid rgba(167,139,250,0.5)', pointerEvents: 'none',
            animation: 'curryOrbRing 3.2s ease-in-out infinite',
          }} />
          <style>{`
            @keyframes curryOrbBreathe {
              0%, 100% { transform: scale(1); box-shadow: 0 8px 24px -6px rgba(108,99,255,0.55); }
              50% { transform: scale(1.06); box-shadow: 0 10px 30px -4px rgba(108,99,255,0.75); }
            }
            @keyframes curryOrbRing {
              0% { opacity: 0.6; transform: scale(1); }
              100% { opacity: 0; transform: scale(1.35); }
            }
            @media (prefers-reduced-motion: reduce) {
              button[aria-label="Ask Curry"], button[aria-label="Ask Curry"] span { animation: none !important; }
            }
          `}</style>
        </button>
      )}

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 950,
          background: 'var(--bg-surface-1, #0f0f1a)', overflowY: 'auto', padding: 16,
        }}>
          <AskCurry userId={userId} onNavigate={onNavigate} onClose={() => setOpen(false)} />
        </div>
      )}
    </>,
    document.body
  )
}
