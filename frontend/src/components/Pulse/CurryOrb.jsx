// Floating "Ask Curry" trigger for the Pulse home screen only. It no
// longer mounts AskCurry itself — PulsePage owns that overlay via
// dekutView === 'faq' — so there's one source of truth and this never
// floats above a functionality's own card.
//
// hidden: pass true whenever ANY DeKUT Hub sub-view is open
// (dekutView !== null in PulsePage).

import React from 'react'
import { createPortal } from 'react-dom'
import CurryOrbGraphic from './CurryOrbGraphic'

export default function CurryOrb({ onNavigate, hidden }) {
  if (hidden) return null

  return createPortal(
    <button
      onClick={() => onNavigate?.('faq')}
      aria-label="Ask Curry"
      style={{
        position: 'fixed', bottom: 22, right: 20, zIndex: 500,
        width: 58, height: 58, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: 'rgba(15,15,26,0.7)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 8px 24px -6px rgba(108,99,255,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <CurryOrbGraphic size={40} state="idle" animate />
    </button>,
    document.body
  )
}
