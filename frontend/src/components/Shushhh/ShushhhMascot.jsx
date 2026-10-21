import { useEffect, useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// mood: 'entrance' (the Afrobeats groove dance-in, see ShushhhChoreo.js) | 'idle' | 'curious' | 'leaving'
// onDone fires when 'entrance' or 'leaving' finishes (immediately if reduced motion).
const pivot = (origin) => ({ transformBox: 'fill-box', transformOrigin: origin })

import { ENTRANCE, NORMAL, FRAMES } from './ShushhhChoreo'

const {
  wrapX, bodyX, bodyY, bodyRot, bodySkew, bodySX, bodySY,
  shoulderL, shoulderR, armL, armR, legL, legR,
  eyeX, eyeSY, faceO, mouthD, fingerO, fxO, starO, starS, shadowS, ringS, ringO,
} = FRAMES

const lin = { duration: ENTRANCE, ease: 'linear' }
const loop = (d) => ({ duration: d, repeat: Infinity, ease: 'easeInOut' })

const wrapV = {
  entrance: { x: wrapX, opacity: 1, transition: lin },
  idle: { x: '0vw', opacity: 1 },
  curious: { x: '0vw', opacity: 1 },
  leaving: { x: '0vw', opacity: [1, 1, 1, 0], transition: { duration: 1.3, times: [0, 0.3, 0.6, 1], ease: 'easeInOut' } },
}
const bodyV = {
  entrance: { x: bodyX, y: bodyY, rotate: bodyRot, skewX: bodySkew, scaleX: bodySX, scaleY: bodySY, transition: lin },
  idle: { x: 0, skewX: 0, rotate: 0, scaleX: 1, y: [0, -3, 0], scaleY: [1, 1.018, 1], transition: loop(3.4) },
  curious: { x: 0, skewX: 0, scaleX: 1, scaleY: 1, y: [0, -2, 0], rotate: [0, -5, 0, 5, 0], transition: loop(4.2) },
  leaving: { x: 0, skewX: 0, rotate: 0, scaleX: 1, scaleY: 1, y: [0, -4, 0, 12], scale: [1, 1, 1, 0.85], transition: { duration: 1.3, times: [0, 0.3, 0.6, 1], ease: 'easeInOut' } },
}
const shoulderLV = { entrance: { y: shoulderL, transition: lin }, idle: { y: 0 }, curious: { y: 0 }, leaving: { y: 0 } }
const shoulderRV = { entrance: { y: shoulderR, transition: lin }, idle: { y: 0 }, curious: { y: 0 }, leaving: { y: 0 } }
const armLV = { entrance: { rotate: armL, transition: lin }, idle: { rotate: [0, 2, 0], transition: loop(3.4) }, curious: { rotate: 0 }, leaving: { rotate: 0 } }
const armRV = {
  entrance: { rotate: armR, transition: lin },
  idle: { rotate: [0, -2, 0], transition: loop(3.4) },
  curious: { rotate: 0 },
  leaving: { rotate: [0, -125, -145, -125, -145, -125, 0], transition: { duration: 1.2, ease: 'easeInOut' } },
}
const legLV = { entrance: { y: legL, transition: lin }, idle: { y: 0 }, curious: { y: 0 }, leaving: { y: 0 } }
const legRV = { entrance: { y: legR, transition: lin }, idle: { y: 0 }, curious: { y: 0 }, leaving: { y: 0 } }
const eyesV = {
  entrance: { x: eyeX, scaleY: eyeSY, opacity: faceO, transition: lin },
  idle: { x: 0, opacity: 1, scaleY: [1, 1, 0.1, 1, 1], transition: { duration: 4, repeat: Infinity, times: [0, 0.9, 0.94, 0.98, 1] } },
  curious: { scaleY: 1, x: [0, 2, 0, -2, 0], transition: loop(4.2) },
  leaving: { x: 0, scaleY: 1 },
}
const mouthV = { entrance: { d: mouthD, opacity: faceO, transition: lin }, idle: { d: NORMAL, opacity: 1 }, curious: { d: NORMAL, opacity: 1 }, leaving: { d: NORMAL, opacity: 1 } }
const shadowV = { entrance: { scaleX: shadowS, transition: lin }, idle: { scaleX: 1 }, curious: { scaleX: 1 }, leaving: { scaleX: 1 } }
const ringV = { entrance: { scale: ringS, opacity: ringO, transition: lin }, idle: { opacity: 0 }, curious: { opacity: 0 }, leaving: { opacity: 0 } }
const fxV = { entrance: { opacity: fxO, transition: lin }, idle: { opacity: 0 }, curious: { opacity: 0 }, leaving: { opacity: 0 } }
const starsV = { entrance: { opacity: starO, scale: starS, transition: lin }, idle: { opacity: 0 }, curious: { opacity: 0 }, leaving: { opacity: 0 } }
const fingerV = {
  entrance: { opacity: fingerO, transition: lin },
  idle: { opacity: 0, transition: { duration: 0.3 } },
  curious: { opacity: 0 },
  leaving: { opacity: [0, 1, 1, 1], transition: { duration: 0.5 } },
}

export const MASCOT_ENTRANCE_SECONDS = ENTRANCE

const STAR = 'M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2Z'

export default function ShushhhMascot({ size = 140, mood = 'idle', onDone }) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/:/g, '')

  useEffect(() => {
    if (reduce && (mood === 'entrance' || mood === 'leaving')) onDone?.(mood)
  }, [reduce, mood])  

  const animate = reduce ? undefined : mood

  return (
    <motion.div
      variants={wrapV}
      initial={!reduce && mood === 'entrance' ? { x: '-60vw' } : undefined}
      animate={animate}
      onAnimationComplete={(d) => { if (d === 'entrance' || d === 'leaving') onDone?.(d) }}
      style={{ display: 'inline-block', lineHeight: 0 }}
    >
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
        {/* a ripple on the floor with every beat of the dance */}
        <motion.ellipse variants={ringV} cx="80" cy="172" rx="34" ry="6" fill="none" stroke="#c4b5fd" strokeWidth="2" style={{ ...pivot('50% 50%'), opacity: 0 }} />
        <motion.ellipse variants={shadowV} cx="80" cy="172" rx="34" ry="5" fill="rgba(139,92,246,0.25)" style={pivot('50% 50%')} />

        {/* sparkles on each "hit" */}
        <g transform="translate(22 30)"><motion.path d={STAR} variants={starsV} style={{ ...pivot('50% 50%'), opacity: 0 }} fill="#ddd6fe" /></g>
        <g transform="translate(140 24)"><motion.path d={STAR} variants={starsV} style={{ ...pivot('50% 50%'), opacity: 0 }} fill="#c4b5fd" /></g>
        <g transform="translate(80 8)"><motion.path d={STAR} variants={starsV} style={{ ...pivot('50% 50%'), opacity: 0 }} fill="#ede9fe" /></g>

        <motion.g variants={bodyV} style={pivot('50% 100%')}>
          {/* legs */}
          <motion.rect variants={legLV} x="55" y="128" width="18" height="30" rx="9" fill="#5b21b6" />
          <motion.rect variants={legRV} x="87" y="128" width="18" height="30" rx="9" fill="#5b21b6" />

          {/* shoulders + arms (shoulders bob in opposite directions = the shimmy) */}
          <motion.g variants={shoulderLV}>
            <motion.rect variants={armLV} x="20" y="80" width="14" height="38" rx="7" fill="#7c3aed" style={pivot('50% 10%')} />
            <circle cx="28" cy="87" r="8.5" fill="#8b5cf6" />
          </motion.g>
          <motion.g variants={shoulderRV}>
            <motion.rect variants={armRV} x="126" y="80" width="14" height="38" rx="7" fill="#7c3aed" style={pivot('50% 10%')} />
            <circle cx="132" cy="87" r="8.5" fill="#8b5cf6" />
          </motion.g>

          {/* body */}
          <rect x="30" y="28" width="100" height="108" rx="46" fill={`url(#b${uid})`} />
          <rect x="42" y="36" width="52" height="14" rx="7" fill="#fff" opacity="0.12" />

          {/* vibration marks beside the shoulders while shimmying */}
          <motion.g variants={fxV} style={{ opacity: 0 }} stroke="#c4b5fd" strokeWidth="2.4" strokeLinecap="round" fill="none">
            <path d="M12 74 q-6 9 0 18" /><path d="M5 68 q-9 15 0 30" />
            <path d="M148 74 q6 9 0 18" /><path d="M155 68 q9 15 0 30" />
          </motion.g>

          {/* face */}
          <motion.g variants={eyesV} style={pivot('50% 50%')}>
            <ellipse cx="62" cy="76" rx="6.5" ry="8.5" fill="#1a1033" />
            <ellipse cx="98" cy="76" rx="6.5" ry="8.5" fill="#1a1033" />
            <circle cx="64" cy="72.5" r="2" fill="#fff" opacity="0.9" />
            <circle cx="100" cy="72.5" r="2" fill="#fff" opacity="0.9" />
          </motion.g>
          <motion.path variants={mouthV} d={NORMAL} stroke="#1a1033" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <motion.rect variants={fingerV} style={{ opacity: 0 }} x="76.5" y="88" width="7" height="26" rx="3.5" fill="#ddd6fe" />
        </motion.g>
      </svg>
    </motion.div>
  )
}
