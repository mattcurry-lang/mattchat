import { useEffect, useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// mood: 'entrance' | 'idle' | 'curious' | 'leaving'
// onDone fires when 'entrance' or 'leaving' finishes (immediately if reduced motion).
const pivot = (origin) => ({ transformBox: 'fill-box', transformOrigin: origin })

// ---------- Choreography: 64 frames x 0.07s = 4.48s ----------
// A  (0-16)   side-steps in from the left, knees bent, hopping
// S1 (16-28)  SHIMMY leaning right: shoulders alternate fast, arms out
// H1 (28-32)  HIT: pop up, arms up, sparkles
// S2 (32-44)  SHIMMY leaning left
// H2 (44-48)  HIT
// C  (48-58)  knees wiggle down, then up, hips bump
// D  (58-64)  arms drop, finger to lips: "shhh"
const STEP = 0.07
const N = 64
const A_END = 16, S1 = 28, H1 = 32, S2 = 44, H2 = 48, C_END = 58
const ENTRANCE = N * STEP

const frames = (fn) => Array.from({ length: N + 1 }, (_, i) => fn(i))
const alt = (i) => (i % 2 ? 1 : -1)
const smooth = (t) => t * t * (3 - 2 * t)
const hop = (i) => Math.abs(Math.sin((i * Math.PI) / 3))
const swing = (i) => Math.sin((i * Math.PI) / 3)

const phase = (i) => (i < A_END ? 'A' : i < S1 ? 'S1' : i < H1 ? 'H1' : i < S2 ? 'S2' : i < H2 ? 'H2' : i < C_END ? 'C' : 'D')
const isShim = (p) => p === 'S1' || p === 'S2'
const isHit = (p) => p === 'H1' || p === 'H2'
const lean = (p) => (p === 'S1' ? 1 : p === 'S2' ? -1 : 0)
const ht = (i) => (i < H1 ? i - S1 : i - S2) // 0..3 inside a hit
const bump = (i) => (Math.floor((i - H2) / 3) % 2 ? -1 : 1)

const POP = [1.14, 1.1, 1.04, 1]
const POPY = [-14, -11, -5, 0]
const HIT_ARM = [135, 135, 125, 110]
const HIT_STAR_O = [1, 0.9, 0.5, 0]
const HIT_STAR_S = [1.3, 1.1, 0.8, 0.5]

const NORMAL = 'M73 101 Q80 106 87 101'
const GRIN = 'M69 99 Q80 114 91 99'

const wrapX = frames((i) => {
  if (i >= A_END) return '0vw'
  const t = i / A_END
  return `${(-60 * (1 - smooth(t)) + 4 * Math.sin((i * Math.PI) / 2) * (1 - t)).toFixed(2)}vw`
})
const bodyX = frames((i) => { const p = phase(i); if (isShim(p)) return lean(p) * 5 + alt(i) * 2; if (p === 'C') return bump(i) * 5; return 0 })
const bodyY = frames((i) => {
  const p = phase(i)
  if (p === 'A') return -8 * hop(i)
  if (isShim(p)) return 5 + alt(i) * 1.5
  if (isHit(p)) return POPY[ht(i)]
  if (p === 'C') return i < H2 + 5 ? 8 : -4
  return 0
})
const bodyRot = frames((i) => {
  const p = phase(i)
  if (p === 'A') return (i >> 2) % 2 ? 6 : -6
  if (isShim(p)) return lean(p) * 6 + alt(i) * 2
  if (p === 'C') return bump(i) * 4
  return 0
})
const bodySkew = frames((i) => (isShim(phase(i)) ? alt(i) * 10 : 0))
const bodySX = frames((i) => { const p = phase(i); if (isShim(p)) return 1 + alt(i) * 0.05; if (isHit(p)) return 1 + (POP[ht(i)] - 1) * 0.6; return 1 })
const bodySY = frames((i) => {
  const p = phase(i)
  if (p === 'A') return 1 - 0.06 * (1 - hop(i))
  if (isShim(p)) return 0.92
  if (isHit(p)) return POP[ht(i)]
  if (p === 'C') return i < H2 + 5 ? 0.88 : 1.06
  return 1
})
const shoulderL = frames((i) => { const p = phase(i); if (isShim(p)) return -alt(i) * 7; if (isHit(p)) return -8 * (1 - ht(i) / 3); return 0 })
const shoulderR = frames((i) => { const p = phase(i); if (isShim(p)) return alt(i) * 7; if (isHit(p)) return -8 * (1 - ht(i) / 3); return 0 })
const arm = (i, s) => {
  const p = phase(i)
  if (p === 'A') return 16 + s * 16 * swing(i)
  if (isShim(p)) return 40 + s * alt(i) * 9
  if (isHit(p)) return HIT_ARM[ht(i)]
  if (p === 'C') return 40 + s * bump(i) * 10
  return 40 * (1 - (i - C_END) / (N - C_END))
}
const armL = frames((i) => arm(i, 1))
const armR = frames((i) => -arm(i, -1))
const legL = frames((i) => { const p = phase(i); if (p === 'A') return -6 * Math.max(0, swing(i)); if (isShim(p)) return alt(i) * 2; return 0 })
const legR = frames((i) => { const p = phase(i); if (p === 'A') return -6 * Math.max(0, -swing(i)); if (isShim(p)) return -alt(i) * 2; return 0 })
const eyeX = frames((i) => lean(phase(i)) * 3)
const eyeSY = frames((i) => { const p = phase(i); if (isHit(p)) return 0.5; if (isShim(p)) return 0.85; return 1 })
const mouthD = frames((i) => { const p = phase(i); return isShim(p) || isHit(p) || p === 'C' ? GRIN : NORMAL })
const fxO = frames((i) => (isShim(phase(i)) ? (i % 2 ? 1 : 0.35) : 0))
const starO = frames((i) => (isHit(phase(i)) ? HIT_STAR_O[ht(i)] : 0))
const starS = frames((i) => (isHit(phase(i)) ? HIT_STAR_S[ht(i)] : 0.5))
const fingerO = frames((i) => (i >= C_END ? Math.min(1, (i - C_END) / 3) : 0))

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
  entrance: { x: eyeX, scaleY: eyeSY, transition: lin },
  idle: { x: 0, scaleY: [1, 1, 0.1, 1, 1], transition: { duration: 4, repeat: Infinity, times: [0, 0.9, 0.94, 0.98, 1] } },
  curious: { scaleY: 1, x: [0, 2, 0, -2, 0], transition: loop(4.2) },
  leaving: { x: 0, scaleY: 1 },
}
const mouthV = { entrance: { d: mouthD, transition: lin }, idle: { d: NORMAL }, curious: { d: NORMAL }, leaving: { d: NORMAL } }
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
        <ellipse cx="80" cy="172" rx="34" ry="5" fill="rgba(139,92,246,0.25)" />

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
