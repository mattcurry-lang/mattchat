// src/beyond/BatteryCard.jsx
//
// The battery readout. A drawn battery whose fill animates to the level; a bolt
// while charging. Only a CURRENT reading (reported within 2 minutes) is drawn in
// full colour; older ones are dimmed and labelled "Last reported".

import React from 'react'
import { motion } from 'framer-motion'
import { prefersReducedMotion } from './motion'
import { BatteryState } from './services/batteryStatus'
import { problemText } from './services/dbProblem'

const FILL_MAX = 44

function tone(level, current) {
  if (!current) return '#8e86ad'
  if (level <= 10) return '#f87171'
  if (level <= 20) return '#fbbf24'
  return '#a78bfa'
}

function BatteryGlyph({ level, charging, current }) {
  const color = tone(level, current)
  const w = Math.max(2, (FILL_MAX * level) / 100)
  const instant = prefersReducedMotion()
  return (
    <svg width="64" height="32" viewBox="0 0 64 32" role="img" aria-label={`${level} percent`} style={{ flex: 'none', opacity: current ? 1 : 0.7 }}>
      <rect x="2" y="3.500" width="54" height="25" rx="7.500" fill="none" stroke={color} strokeWidth="2" strokeOpacity="0.75" />
      <rect x="58.500" y="11" width="3.500" height="10" rx="1.750" fill={color} fillOpacity="0.75" />
      <motion.rect
        x="6" y="7.500" height="17" rx="4.500" fill={color}
        initial={{ width: instant ? w : 2 }} animate={{ width: w }}
        transition={instant ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 22 }}
      />
      {charging && (
        <path d="M30 6.500 22.500 17H29l-1.500 8.500L35 15h-6.500Z" fill="#07050d" stroke="#f1eefc" strokeWidth="1" strokeLinejoin="round" />
      )}
    </svg>
  )
}

export default function BatteryCard({ battery, contactName }) {
  if (battery.problem) return <p style={{ ...muted, color: '#fbbf24' }} role="alert">{problemText(battery.problem, 'Battery sharing')}</p>
  if (battery.state === BatteryState.LOADING) return <p style={muted}>Checking battery…</p>

  if (battery.state === BatteryState.NOT_SHARING) {
    return <p style={muted}>{contactName} isn’t sharing their battery</p>
  }
  if (battery.state === BatteryState.NO_READING) {
    return (
      <p style={muted}>
        No battery reading yet. Their phone may not support it, or Mattchat isn’t open on it.
      </p>
    )
  }

  return (
    <div style={row} role="group" aria-label={`${contactName}'s battery`}>
      <BatteryGlyph level={battery.level} charging={battery.charging} current={battery.isCurrent} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: battery.isCurrent ? '#f1eefc' : '#b8b0d6' }}>
          {battery.level}% {battery.isCurrent ? 'battery' : 'when last reported'}
        </div>
        <div style={sub}>{battery.chargingLabel} · {battery.updatedLabel}</div>
        <div style={sub}>{battery.availabilityLabel}</div>
      </div>
    </div>
  )
}

const row = { display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,139,250,0.16)' }
const sub = { fontSize: 12, color: '#b8b0d6', marginTop: 1 }
const muted = { margin: '10px 0 0', fontSize: 12.5, color: '#b8b0d6' }
