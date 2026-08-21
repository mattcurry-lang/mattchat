import React, { useEffect, useState } from 'react'

// Animated circular cycle visualization. progressFraction is 0..1.
// Animates from 0 on mount to the real value for a gentle "filling in"
// effect, per the "subtle animations when the dashboard loads" spec.
export default function CycleRing({ progressFraction = 0, dayLabel, subLabel, size = 220 }) {
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(progressFraction))
    return () => cancelAnimationFrame(raf)
  }, [progressFraction])

  const stroke = 14
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - animated)

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="cycleRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6c63ff" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(167,139,250,0.15)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="url(#cycleRingGrad)" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 4, textAlign: 'center', padding: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd', letterSpacing: 0.3 }}>{dayLabel}</div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--dark-text-2)', lineHeight: 1.4, maxWidth: size - 60 }}>
          {subLabel}
        </div>
      </div>
    </div>
  )
}
