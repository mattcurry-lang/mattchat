// src/components/Pulse/CurryOrb.jsx
//
// Curry's visual identity: a living gradient orb rather than a static
// icon or emoji. Same component renders three sizes/contexts —
// CurryOrbButton's badge, AskCurry's header avatar, and the big
// voice-mode centerpiece — driven entirely by the `state` prop so they
// always animate in sync with what Curry is actually doing.
//
// States:
//   idle      — slow violet-blue breathing. Curry's resting state.
//   listening — cooler cyan-violet blend, faster pulse, expanding rings
//               (the student is talking).
//   thinking  — a conic-gradient arc sweeps around the orb (Curry is
//               working — RAG lookup, tool call, generation).
//   speaking  — warm coral blended in, with a small kick on every
//               `pulseTick` change (fired on each TTS word boundary —
//               there's no real mic/speaker amplitude available from the
//               Web Speech API, so this is a stylized approximation of
//               "reacting to sound" rather than true amplitude).
//
// All motion respects prefers-reduced-motion: reduce (falls back to a
// static gradient, no animation).

import React, { useEffect, useState } from 'react'

const STATE_GRADIENTS = {
  idle: 'conic-gradient(from 0deg, #a78bfa, #6c63ff, #a78bfa)',
  listening: 'conic-gradient(from 0deg, #67e8f9, #a78bfa, #6c63ff, #67e8f9)',
  thinking: 'conic-gradient(from 0deg, #a78bfa, #6c63ff, #a78bfa)',
  speaking: 'conic-gradient(from 0deg, #fda4af, #a78bfa, #6c63ff, #fda4af)',
}

const STATE_GLOW = {
  idle: 'rgba(167,139,250,0.35)',
  listening: 'rgba(103,232,249,0.45)',
  thinking: 'rgba(167,139,250,0.4)',
  speaking: 'rgba(253,164,175,0.45)',
}

export default function CurryOrb({ state = 'idle', size = 64, pulseTick = 0, style }) {
  const [kick, setKick] = useState(false)

  useEffect(() => {
    if (state !== 'speaking' || pulseTick === 0) return
    setKick(true)
    const t = setTimeout(() => setKick(false), 140)
    return () => clearTimeout(t)
  }, [pulseTick, state])

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative', width: size, height: size, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}
    >
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .curry-orb-core { animation: curryBreathe 4s ease-in-out infinite; }
          .curry-orb-core.is-listening { animation: curryBreatheFast 1.8s ease-in-out infinite; }
          .curry-orb-core.is-thinking { animation: currySpin 2.2s linear infinite; }
          .curry-orb-core.is-speaking { animation: curryBreatheFast 1.6s ease-in-out infinite; }
          .curry-orb-core.is-kicked { transform: scale(1.14) !important; }
          .curry-orb-ring { animation: curryRing 2.4s ease-out infinite; }
        }
        @keyframes curryBreathe { 0%, 100% { transform: scale(0.94); } 50% { transform: scale(1.04); } }
        @keyframes curryBreatheFast { 0%, 100% { transform: scale(0.92); } 50% { transform: scale(1.08); } }
        @keyframes currySpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes curryRing {
          0% { transform: scale(0.85); opacity: 0.5; }
          100% { transform: scale(1.55); opacity: 0; }
        }
      `}</style>

      {state === 'listening' && (
        <span className="curry-orb-ring" style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2px solid ${STATE_GLOW.listening}`, pointerEvents: 'none',
        }} />
      )}

      <div
        className={`curry-orb-core${state !== 'idle' ? ` is-${state}` : ''}${kick ? ' is-kicked' : ''}`}
        style={{
          width: '78%', height: '78%', borderRadius: '50%',
          background: STATE_GRADIENTS[state] || STATE_GRADIENTS.idle,
          boxShadow: `0 0 ${size * 0.4}px ${STATE_GLOW[state] || STATE_GLOW.idle}`,
          transition: 'background 400ms ease, box-shadow 400ms ease, transform 140ms ease',
        }}
      />
    </div>
  )
}
