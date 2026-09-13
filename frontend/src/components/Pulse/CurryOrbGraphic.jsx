// src/components/Pulse/CurryOrbGraphic.jsx
//
// Curry's mark: a campus "beacon" — concentric locator rings pinging
// around a solid core — rather than the amorphous blob Siri, ChatGPT
// Voice, and Gemini Live have all converged on. It's meant to echo what
// Curry actually does (find you a way to something on campus), not
// mimic a mouth or a liquid blob. Pure SVG, no emoji.
//
// state: 'idle' | 'listening' | 'thinking' | 'speaking'
// volume: 0–1 real mic amplitude — only used while state === 'listening',
//   so the ring is driven by the student's actual voice, not a loop.
// animate: false renders a calm, static mark (used for the chat header
//   avatar, where motion would be noise, not signal).

import React, { useId } from 'react'

const STATE_COLORS = {
  idle: ['#a78bfa', '#6c63ff'],
  listening: ['#22d3ee', '#0891b2'],
  thinking: ['#fbbf24', '#f59e0b'],
  speaking: ['#fb923c', '#f97316'],
}

const BAR_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

export default function CurryOrbGraphic({ size = 60, state = 'idle', volume = 0, animate = true }) {
  const gradId = useId()
  const [from, to] = STATE_COLORS[state] || STATE_COLORS.idle
  const cx = size / 2
  const cy = size / 2
  const coreR = size * 0.28
  const pingMaxR = size * 0.48 * (1 + Math.min(volume, 1) * 0.5)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible', display: 'block' }} aria-hidden="true">
      <defs>
        <radialGradient id={`curry-core-${gradId}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </radialGradient>
      </defs>

      {/* idle: two slow, staggered pings — a resting beacon */}
      {animate && state === 'idle' && (
        <>
          <circle cx={cx} cy={cy} r={coreR} fill="none" stroke={from} strokeWidth={1.5}
            style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'curryBeaconPing 3s ease-out infinite' }} />
          <circle cx={cx} cy={cy} r={coreR} fill="none" stroke={from} strokeWidth={1.5}
            style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'curryBeaconPing 3s ease-out 1.5s infinite' }} />
        </>
      )}

      {/* listening: ring size tracks real mic volume every frame, not a loop */}
      {state === 'listening' && (
        <circle cx={cx} cy={cy} r={pingMaxR} fill="none" stroke={from} strokeWidth={1.5} opacity={0.4}
          style={{ transition: 'r 60ms linear' }} />
      )}

      {/* thinking: a short arc orbiting the core, like a compass needle
          searching — not a generic full spinner */}
      {animate && state === 'thinking' && (
        <circle cx={cx} cy={cy} r={size * 0.42} fill="none" stroke={from} strokeWidth={2} strokeLinecap="round"
          strokeDasharray={`${size * 0.42 * 0.55} ${size * 0.42 * 2 * Math.PI}`}
          style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'curryBeaconSpin 1.1s linear infinite' }} />
      )}

      {/* speaking: a radial halo of bars — a "voice signature" reading
          outward from the core, not a pulsing blob */}
      {animate && state === 'speaking' && BAR_ANGLES.map((angle, i) => (
        <g key={angle} transform={`rotate(${angle} ${cx} ${cy})`}>
          <rect
            x={cx - 1.5} y={cy - size * 0.48} width={3} height={size * 0.12} rx={1.5} fill={from}
            style={{
              transformOrigin: `${cx}px ${cy - size * 0.42}px`,
              animation: `curryBeaconBar 0.9s ease-in-out ${i * 0.07}s infinite`,
            }}
          />
        </g>
      ))}

      <circle cx={cx} cy={cy} r={coreR} fill={`url(#curry-core-${gradId})`} />

      <style>{`
        @keyframes curryBeaconPing {
          0% { r: ${coreR}; opacity: 0.55; }
          100% { r: ${size * 0.48}; opacity: 0; }
        }
        @keyframes curryBeaconSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes curryBeaconBar {
          0%, 100% { opacity: 0.35; transform: scaleY(0.55); }
          50% { opacity: 1; transform: scaleY(1.3); }
        }
        @media (prefers-reduced-motion: reduce) {
          circle, rect { animation: none !important; }
        }
      `}</style>
    </svg>
  )
}
