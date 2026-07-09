import { useState } from 'react'

// Floating glowing AI orb — sits bottom-right, above BottomNav. Tap
// opens Curry's voice mode directly (skips the chat list + typing).
// This is deliberately a SEPARATE control from BottomNav's existing
// "+" (which still does new-chat/new-call) — the orb's whole job is
// "get me to Curry, fast, hands-free", not "create something new".
//
// Usage: render once at the top level of ChatPage (sibling to
// BottomNav), pass onActivate to jump into CurryAIChat + voice mode.
export default function FloatingCurryOrb({ onActivate, hidden }) {
  const [pressed, setPressed] = useState(false)

  if (hidden) return null

  return (
    <button
      onClick={onActivate}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      title="Talk to Curry"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 84, // sits just above the bottom nav bar
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        backgroundSize: '200% 200%',
        boxShadow: '0 4px 20px rgba(102,126,234,0.5), 0 0 40px rgba(118,75,162,0.3)',
        transform: pressed ? 'scale(0.92)' : 'scale(1)',
        transition: 'transform 0.15s ease',
        animation: 'orbFloatPulse 3s ease-in-out infinite',
      }}
    >
      <span style={{ fontSize: 22, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }}>✨</span>
      <div style={ring1} />
      <div style={ring2} />
    </button>
  )
}

const ring1 = {
  position: 'absolute', inset: -6, borderRadius: '50%',
  border: '1.5px solid rgba(167,139,250,0.4)',
  animation: 'orbRingExpand 2.5s ease-out infinite',
  pointerEvents: 'none',
}
const ring2 = {
  position: 'absolute', inset: -6, borderRadius: '50%',
  border: '1.5px solid rgba(240,147,251,0.3)',
  animation: 'orbRingExpand 2.5s ease-out 1.2s infinite',
  pointerEvents: 'none',
}

if (typeof document !== 'undefined' && !document.getElementById('floating-orb-styles')) {
  const el = document.createElement('style')
  el.id = 'floating-orb-styles'
  el.textContent = `
    @keyframes orbFloatPulse {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
    @keyframes orbRingExpand {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  `
  document.head.appendChild(el)
}
