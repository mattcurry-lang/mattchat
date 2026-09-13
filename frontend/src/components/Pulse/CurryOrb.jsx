// src/components/Pulse/CurryOrb.jsx
//
// Floating "Ask Curry" launcher. Portals to document.body so it floats
// fixed above the viewport no matter where DeKUTHubCard sits in Pulse's
// scroll container.
//
// hidden: pass true while another DeKUT Hub fullscreen view is already
// open (RoomFinder, FresherMode, etc.) so two fullscreen layers never
// stack.

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import AskCurry from './AskCurry'
import CurryOrbGraphic from './CurryOrbGraphic'

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
            background: 'rgba(15,15,26,0.7)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 8px 24px -6px rgba(108,99,255,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <CurryOrbGraphic size={40} state="idle" animate />
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
