import React, { useMemo, useState } from 'react'

const TEXT_PRIMARY = '#f5f5fa'
const TEXT_SECONDARY = 'rgba(245,245,250,0.6)'
const BORDER = 'rgba(245,245,250,0.16)'
const STEP = 60
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]] // E, S, W, N (clockwise on screen)

function layout(steps) {
  let h = 1 // start heading down the screen
  let x = 0, y = 0
  const pts = [{ x, y }]
  steps.forEach((s) => {
    if (s.turn === 'right') h = (h + 1) % 4
    else if (s.turn === 'left') h = (h + 3) % 4
    else if (s.turn === 'u-turn') h = (h + 2) % 4
    x += DIRS[h][0] * STEP; y += DIRS[h][1] * STEP
    pts.push({ x, y })
  })
  return pts
}

function RouteSketch({ pts, reversed, numbered, fromLabel, toLabel }) {
  const list = reversed ? [...pts].reverse() : pts
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  const pad = 46
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2, h = Math.max(...ys) - Math.min(...ys) + pad * 2
  const d = list.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
  const start = list[0], end = list[list.length - 1]
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} style={{ width: '100%', maxHeight: 340, borderRadius: 12, background: 'rgba(15,15,26,0.7)', border: `1px solid ${BORDER}` }}>
      <defs>
        <pattern id="rsGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(245,245,250,0.05)" strokeWidth="1" />
        </pattern>
        <marker id="rsArrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#22d3ee" />
        </marker>
      </defs>
      <rect x={minX} y={minY} width={w} height={h} fill="url(#rsGrid)" />
      <path d={d} fill="none" stroke="rgba(34,211,238,0.25)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 6" markerEnd="url(#rsArrow)" />
      {list.slice(1, -1).map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="11" fill="#1e1b3a" stroke="#a78bfa" strokeWidth="2" />
          {numbered && <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#f5f5fa">{i + 1}</text>}
        </g>
      ))}
      <circle cx={start.x} cy={start.y} r="12" fill="#34d399" stroke="#fff" strokeWidth="2" />
      <text x={start.x} y={start.y - 18} textAnchor="middle" fontSize="11" fontWeight="800" fill="#6ee7b7">{reversed ? toLabel : fromLabel}</text>
      <circle cx={end.x} cy={end.y} r="12" fill="#a78bfa" stroke="#fff" strokeWidth="2" />
      <text x={end.x} y={end.y + 26} textAnchor="middle" fontSize="11" fontWeight="800" fill="#c4b5fd">{reversed ? fromLabel : toLabel}</text>
    </svg>
  )
}

export default function RouteMapPanel({ steps, reverseSteps, name, startPoint }) {
  const [dir, setDir] = useState('to')
  const pts = useMemo(() => layout(steps || []), [steps])
  const reversed = dir === 'back'
  const list = reversed ? reverseSteps : steps
  const fromLabel = startPoint || 'Start'
  if (!steps?.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {reverseSteps?.length > 0 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {[['to', `To ${name}`], ['back', 'Coming back']].map(([id, label]) => (
            <button key={id} onClick={() => setDir(id)} style={{
              flex: 1, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 10, padding: '6px 0',
              border: `1px solid ${BORDER}`, color: dir === id ? '#fff' : TEXT_SECONDARY,
              background: dir === id ? 'rgba(167,139,250,0.25)' : 'none',
            }}>{label}</button>
          ))}
        </div>
      )}
      <RouteSketch pts={pts} reversed={reversed} numbered={list?.length === steps.length}
        fromLabel={fromLabel} toLabel={name} />
      <div style={{ fontSize: 10.5, color: TEXT_SECONDARY }}>Sketch of the walk, not to scale.</div>
      <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: TEXT_PRIMARY, lineHeight: 1.45 }}>
        {(list || []).map((s, i) => (
          <li key={i}>{s.instruction}{s.landmark ? <span style={{ color: TEXT_SECONDARY }}> ({s.landmark})</span> : null}</li>
        ))}
      </ol>
    </div>
  )
}
