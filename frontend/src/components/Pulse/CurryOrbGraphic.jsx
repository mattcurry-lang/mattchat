// src/components/Pulse/CurryOrbGraphic.jsx
//
// Curry's mark — a locator "beacon": concentric rings pinging around a
// solid core. Deliberately not a soft blob/sphere (the Siri / ChatGPT
// Voice / Gemini Live default) — rings read as "listening for you /
// here I am", which fits an assistant that's spatial as much as
// conversational (campus navigation, room finder).
//
// NOTE: I don't have your original CurryOrbGraphic.jsx in context, so
// this is a full rebuild from the documented spec rather than an edit —
// concentric idle ping, cyan/volume-reactive listening rings, amber
// orbiting arc thinking, coral radial-bar halo speaking. If this drifts
// from your original in ways that matter, send me that file and I'll
// merge properly instead of guessing.
//
// Props: size (px, default 40), state ('idle'|'listening'|'thinking'|'speaking'),
// animate (bool — false gives a fully static mark, e.g. small inline avatars),
// volume (0–1, only read in 'listening' state).

import React, { useMemo } from 'react'

const PALETTE = {
  idle: { core: ['#8B7CFF', '#6C63FF'], ring: '#8B7CFF' },
  listening: { core: ['#67E8F9', '#22D3EE'], ring: '#22D3EE' },
  thinking: { core: ['#FBBF24', '#F59E0B'], ring: '#F59E0B' },
  speaking: { core: ['#FDA4AF', '#FB7185'], ring: '#FB7185' },
}

let orbInstance = 0

export default function CurryOrbGraphic({ size = 40, state = 'idle', animate = true, volume = 0 }) {
  const uid = useMemo(() => `curryOrb-${orbInstance++}`, [])
  const { core, ring } = PALETTE[state] || PALETTE.idle
  const vw = Math.min(1, Math.max(0, volume || 0))
  const cx = 50
  const cy = 50
  const coreR = 16

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0, lineHeight: 0 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', display: 'block' }} aria-hidden="true">
        <defs>
          <radialGradient id={`${uid}-core`} cx="34%" cy="30%" r="72%">
            <stop offset="0%" stopColor={core[0]} />
            <stop offset="100%" stopColor={core[1]} />
          </radialGradient>
          <filter id={`${uid}-glow`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* idle — two staggered pinging rings, centered exactly on the core so
            CSS scale-from-own-center is geometrically identical to scale-from-cx/cy */}
        {state === 'idle' && (
          <>
            {[0, 1].map((i) => (
              <circle
                key={i}
                cx={cx} cy={cy} r={coreR}
                fill="none" stroke={ring} strokeWidth="1.3"
                opacity={animate ? undefined : 0.22}
                className={animate ? `curryOrbPing curryOrbPing${i}` : undefined}
                style={{ transformOrigin: '50% 50%' }}
              />
            ))}
          </>
        )}

        {/* listening — ring radius driven directly by live mic volume, plus a
            gentle continuous base pulse so it never looks frozen between samples */}
        {state === 'listening' && (
          <>
            {[0, 1, 2].map((i) => {
              const scale = 1 + vw * (0.5 + i * 0.22) + (animate ? 0 : 0)
              return (
                <circle
                  key={i}
                  cx={cx} cy={cy} r={coreR}
                  fill="none" stroke={ring}
                  strokeWidth={1.6 - i * 0.35}
                  opacity={0.55 - i * 0.15}
                  className={animate ? 'curryOrbListenPulse' : undefined}
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: '50% 50%',
                    transition: 'transform 90ms ease-out',
                    animationDelay: `${i * 0.12}s`,
                  }}
                />
              )
            })}
          </>
        )}

        {/* thinking — a small arc orbiting the core. Uses SMIL animateTransform
            (not CSS transform-origin) so rotation is anchored exactly at
            (cx,cy) regardless of browser fill-box/view-box quirks */}
        {state === 'thinking' && (
          <circle cx={cx} cy={cy - coreR - 7} r="3.2" fill={ring} filter={`url(#${uid}-glow)`}>
            {animate && (
              <animateTransform
                attributeName="transform" type="rotate"
                from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`}
                dur="1.5s" repeatCount="indefinite"
              />
            )}
          </circle>
        )}

        {/* speaking — radial equalizer bars halo, statically rotated via SVG
            transform (safe across browsers) with only opacity animated */}
        {state === 'speaking' && (
          <g>
            {Array.from({ length: 10 }).map((_, i) => {
              const angle = (i / 10) * 360
              return (
                <rect
                  key={i}
                  x={cx - 1} y={cy - coreR - 13}
                  width="2" height="7" rx="1" fill={ring}
                  transform={`rotate(${angle} ${cx} ${cy})`}
                  className={animate ? `curryOrbBar curryOrbBar${i % 4}` : undefined}
                  opacity={animate ? undefined : 0.55}
                />
              )
            })}
          </g>
        )}

        {/* solid core */}
        <circle cx={cx} cy={cy} r={coreR} fill={`url(#${uid}-core)`} filter={`url(#${uid}-glow)`} />
        <circle cx={cx - 5} cy={cy - 6} r="4.2" fill="rgba(255,255,255,0.38)" />
      </svg>

      <style>{`
        @keyframes curryOrbPingKf {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .curryOrbPing { animation: curryOrbPingKf 2.6s ease-out infinite; }
        .curryOrbPing1 { animation-delay: 1.3s; }

        @keyframes curryOrbListenPulseKf {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.25); }
        }
        .curryOrbListenPulse { animation: curryOrbListenPulseKf 1s ease-in-out infinite; }

        @keyframes curryOrbBarKf {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .curryOrbBar { animation: curryOrbBarKf 0.85s ease-in-out infinite; }
        .curryOrbBar0 { animation-delay: 0s; }
        .curryOrbBar1 { animation-delay: 0.14s; }
        .curryOrbBar2 { animation-delay: 0.28s; }
        .curryOrbBar3 { animation-delay: 0.42s; }

        @media (prefers-reduced-motion: reduce) {
          .curryOrbPing, .curryOrbListenPulse, .curryOrbBar { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
