import React from 'react'

// A small hand-drawn icon set (64×64) with soft gradients. `animated` makes the sun's rays turn,
// rain fall and the bolt flicker; off by default so lists of icons stay calm.
const CLOUD = 'M18 46h28a11 11 0 0 0 1.6-21.9A15 15 0 0 0 19 27a9.5 9.5 0 0 0-1 19z'

function Defs() {
  return (
    <defs>
      <linearGradient id="wi-sun" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe27a" /><stop offset="1" stopColor="#ff9f1c" /></linearGradient>
      <linearGradient id="wi-moon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f8fafc" /><stop offset="1" stopColor="#b6c3e0" /></linearGradient>
      <linearGradient id="wi-cloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#c9d6e8" /></linearGradient>
      <linearGradient id="wi-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#aab6c8" /><stop offset="1" stopColor="#6f7f96" /></linearGradient>
      <linearGradient id="wi-bolt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3a3" /><stop offset="1" stopColor="#ffb703" /></linearGradient>
    </defs>
  )
}
const Sun = ({ cx = 32, cy = 32, r = 10, rays = true, spin }) => (
  <g>
    {rays && (
      <g className={spin ? 'wx-spin' : undefined} style={{ transformOrigin: `${cx}px ${cy}px` }} stroke="#ffc83d" strokeWidth="3" strokeLinecap="round">
        {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={cx + Math.cos(a) * (r + 5)} y1={cy + Math.sin(a) * (r + 5)} x2={cx + Math.cos(a) * (r + 10)} y2={cy + Math.sin(a) * (r + 10)} /> })}
      </g>
    )}
    <circle cx={cx} cy={cy} r={r} fill="url(#wi-sun)" />
  </g>
)
const Moon = ({ x = 0, y = 0, s = 1 }) => <path transform={`translate(${x} ${y}) scale(${s})`} d="M42 12a20 20 0 1 0 12 34 16 16 0 0 1-12-34z" fill="url(#wi-moon)" />
const Cloud = ({ dark, y = 0, x = 0 }) => <path transform={`translate(${x} ${y})`} d={CLOUD} fill={dark ? 'url(#wi-dark)' : 'url(#wi-cloud)'} />
const Drops = ({ n = 3, y = 50, animated, slant = 0 }) => (
  <g stroke="#6fc3ff" strokeWidth="3" strokeLinecap="round">
    {Array.from({ length: n }, (_, i) => {
      const x = 22 + i * (20 / Math.max(1, n - 1)) * (n > 1 ? 1 : 0) + (n === 1 ? 10 : 0)
      return <line key={i} className={animated ? 'wx-fall' : undefined} style={animated ? { animationDelay: `${i * 0.25}s` } : undefined} x1={x} y1={y} x2={x - 3 + slant} y2={y + 7} />
    })}
  </g>
)
const Flakes = ({ animated }) => (
  <g fill="#fff">
    {[[24, 52], [34, 56], [44, 52]].map(([x, y], i) => <circle key={i} className={animated ? 'wx-fall' : undefined} style={animated ? { animationDelay: `${i * 0.3}s` } : undefined} cx={x} cy={y} r="2.4" />)}
  </g>
)

export default function WeatherIcon({ name = 'cloud', isDay = true, size = 32, animated = false, title }) {
  let body
  switch (name) {
    case 'sun': body = isDay ? <Sun r={11} spin={animated} /> : <Moon x={-2} y={2} s={1.05} />; break
    case 'partly': body = isDay ? <><Sun cx={24} cy={24} r={9} spin={animated} /><Cloud x={4} y={2} /></> : <><Moon x={-14} y={-6} s={0.8} /><Cloud x={4} y={2} /></>; break
    case 'cloud': body = <><Cloud dark y={-2} x={-3} /><Cloud x={5} y={4} /></>; break
    case 'fog': body = <><Cloud y={-8} /><g stroke="#dbe5f2" strokeWidth="3" strokeLinecap="round"><line x1="14" y1="44" x2="50" y2="44" /><line x1="20" y1="51" x2="56" y2="51" /></g></>; break
    case 'drizzle': body = <><Cloud dark y={-6} /><Drops n={3} y={44} animated={animated} /></>; break
    case 'rain': body = <><Cloud dark y={-6} /><Drops n={3} y={45} animated={animated} /></>; break
    case 'heavyrain': body = <><Cloud dark y={-7} /><Drops n={4} y={43} animated={animated} slant={-2} /></>; break
    case 'snow': body = <><Cloud y={-6} /><Flakes animated={animated} /></>; break
    case 'sleet': body = <><Cloud dark y={-6} /><Drops n={2} y={46} animated={animated} /><Flakes animated={animated} /></>; break
    case 'storm': body = <><Cloud dark y={-8} /><polygon className={animated ? 'wx-flicker' : undefined} points="34,36 26,50 33,50 30,60 42,44 35,44 39,36" fill="url(#wi-bolt)" /></>; break
    default: body = <Cloud />
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title || name} className="wx-icon">
      <Defs />
      {body}
    </svg>
  )
}
