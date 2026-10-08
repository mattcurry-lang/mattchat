import { useEffect, useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// mood: 'entrance' | 'idle' | 'curious' | 'leaving'
// onDone fires when 'entrance' or 'leaving' finishes (immediately if reduced motion).
const pivot = (origin) => ({ transformBox: 'fill-box', transformOrigin: origin })

const bodyV = {
  entrance: { x: [0, -9, 9, -7, 0], y: [0, -7, 0, -4, 0], rotate: [0, -4, 4, -3, 0], opacity: 1, scale: 1, scaleY: 1,
    transition: { duration: 1.6, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] } },
  idle: { x: 0, rotate: 0, opacity: 1, scale: 1, y: [0, -3, 0], scaleY: [1, 1.018, 1],
    transition: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } },
  curious: { x: 0, opacity: 1, scale: 1, scaleY: 1, y: [0, -2, 0], rotate: [0, -5, 0, 5, 0],
    transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' } },
  leaving: { x: 0, rotate: 0, scaleY: 1, y: [0, -4, 0, 12], scale: [1, 1, 1, 0.85], opacity: [1, 1, 1, 0],
    transition: { duration: 1.3, times: [0, 0.3, 0.6, 1], ease: 'easeInOut' } },
}
const armLV = {
  entrance: { rotate: [0, 18, -8, 14, 0], transition: { duration: 1.6, ease: 'easeInOut' } },
  idle: { rotate: [0, 2, 0], transition: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } },
  curious: { rotate: 0 },
  leaving: { rotate: 0 },
}
const armRV = {
  entrance: { rotate: [0, -18, 8, -14, 0], transition: { duration: 1.6, ease: 'easeInOut' } },
  idle: { rotate: [0, -2, 0], transition: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } },
  curious: { rotate: 0 },
  leaving: { rotate: [0, -125, -145, -125, -145, -125, 0], transition: { duration: 1.2, ease: 'easeInOut' } },
}
const eyesV = {
  entrance: { scaleY: 1 },
  idle: { scaleY: [1, 1, 0.1, 1, 1], transition: { duration: 4, repeat: Infinity, times: [0, 0.9, 0.94, 0.98, 1] } },
  curious: { scaleY: 1, x: [0, 2, 0, -2, 0], transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' } },
  leaving: { scaleY: 1 },
}
const fingerV = {
  entrance: { opacity: [0, 0, 0, 0, 1, 1], transition: { duration: 1.6 } },
  idle: { opacity: 0, transition: { duration: 0.3 } },
  curious: { opacity: 0 },
  leaving: { opacity: [0, 1, 1, 1], transition: { duration: 0.5 } },
}

export default function ShushhhMascot({ size = 140, mood = 'idle', onDone }) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/:/g, '')

  useEffect(() => {
    if (reduce && (mood === 'entrance' || mood === 'leaving')) onDone?.(mood)
  }, [reduce, mood]) // eslint-disable-line react-hooks/exhaustive-deps

  const animate = reduce ? undefined : mood

  return (
    <svg width={size} height={size * 1.19} viewBox="0 0 160 190" role="img" aria-label="Shushhh mascot" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`b${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
        <radialGradient id={`g${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.28" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="80" cy="95" rx="78" ry="82" fill={`url(#g${uid})`} />
      <ellipse cx="80" cy="172" rx="34" ry="5" fill="rgba(139,92,246,0.25)" />

      <motion.g
        variants={bodyV}
        initial={false}
        animate={animate}
        style={pivot('50% 100%')}
        onAnimationComplete={(d) => { if (d === 'entrance' || d === 'leaving') onDone?.(d) }}
      >
        {/* legs */}
        <rect x="55" y="128" width="18" height="30" rx="9" fill="#5b21b6" />
        <rect x="87" y="128" width="18" height="30" rx="9" fill="#5b21b6" />
        {/* arms */}
        <motion.rect variants={armLV} x="20" y="80" width="14" height="38" rx="7" fill="#7c3aed" style={pivot('50% 10%')} />
        <motion.rect variants={armRV} x="126" y="80" width="14" height="38" rx="7" fill="#7c3aed" style={pivot('50% 10%')} />
        {/* body */}
        <rect x="30" y="28" width="100" height="108" rx="46" fill={`url(#b${uid})`} />
        <rect x="42" y="36" width="52" height="14" rx="7" fill="#fff" opacity="0.12" />
        {/* eyes */}
        <motion.g variants={eyesV} style={pivot('50% 50%')}>
          <ellipse cx="62" cy="76" rx="6.5" ry="8.5" fill="#1a1033" />
          <ellipse cx="98" cy="76" rx="6.5" ry="8.5" fill="#1a1033" />
          <circle cx="64" cy="72.5" r="2" fill="#fff" opacity="0.9" />
          <circle cx="100" cy="72.5" r="2" fill="#fff" opacity="0.9" />
        </motion.g>
        {/* mouth */}
        <path d="M73 101 Q80 106 87 101" stroke="#1a1033" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        {/* shush finger */}
        <motion.rect variants={fingerV} style={{ opacity: 0 }} x="76.5" y="88" width="7" height="26" rx="3.5" fill="#ddd6fe" />
      </motion.g>
    </svg>
  )
}
