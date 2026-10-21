// ShushhhChoreo.js — the mascot's dance-in, as plain data (no React), so it can be tested and previewed.
//
// "Afrobeats groove" entrance: an ORIGINAL routine in the spirit of today's viral Afrobeats dance
// challenges (bounce on the beat, hip sway, cross-swinging arms, alternating arm pumps, a spin,
// a freeze pose). It is not a move-for-move copy of any specific dance.
//
// 64 frames x 0.07s = 4.48s = 8 beats at ~107 BPM (one beat = 8 frames, half-beat = 4 frames).
//
//   A  (0-16)   GROOVE-WALK  slides in from the left, bouncing on every half-beat, arms swinging
//   W  (16-28)  SWAY         big hip roll side to side, arms cross-swing, still bouncing
//   P  (28-40)  PUMP         arms pump alternately every half-beat, hops, shoulder pops, vibration marks
//   S  (40-52)  SPIN         a hop and a full turn, arms out (face hides while his back is to us)
//   H  (52-58)  HIT          pop pose: both arms up in a V, sparkles
//   D  (58-64)  SETTLE       arms drop, finger to lips: "shhh"   (the brand sign-off)
//
// Feet-ring "beat pulses" ripple out on the ground on every beat during W, P and S.

export const STEP = 0.07
export const N = 64
export const ENTRANCE = N * STEP

const A_END = 16, W_END = 28, P_END = 40, S_END = 52, H_END = 58

export const NORMAL = 'M73 101 Q80 106 87 101'
export const GRIN = 'M69 99 Q80 114 91 99'

const frames = (fn) => Array.from({ length: N + 1 }, (_, i) => fn(i))
const smooth = (t) => t * t * (3 - 2 * t)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

const phase = (i) => (i < A_END ? 'A' : i < W_END ? 'W' : i < P_END ? 'P' : i < S_END ? 'S' : i < H_END ? 'H' : 'D')

const bounce = (i) => Math.abs(Math.sin((i * Math.PI) / 4))            // peaks every half-beat (4 frames)
const swing = (i) => Math.sin((i * Math.PI) / 3)                         // walking arm swing
const sway = (i) => Math.sin(((i - A_END) * Math.PI) / 3)                // hip roll, 6-frame period, 0 at the start
const pump = (i) => (Math.sin(((i - W_END) * Math.PI) / 4 + 0.6) >= 0 ? 1 : -1) // flips every half-beat (4 frames)
const spinU = (i) => clamp((i - P_END) / (S_END - 1 - P_END), 0, 1)      // 0..1 across the spin
const spinCos = (i) => Math.cos(2 * Math.PI * smooth(spinU(i)))
const ht = (i) => clamp(i - S_END, 0, 5)                                  // 0..5 inside the hit pose

const POP = [1.16, 1.12, 1.08, 1.05, 1.02, 1]
const POPY = [-16, -13, -9, -5, -2, 0]
const HIT_ARM = [140, 140, 132, 124, 116, 112]
const HIT_STAR_O = [1, 0.95, 0.8, 0.55, 0.3, 0]
const HIT_STAR_S = [1.35, 1.2, 1, 0.85, 0.7, 0.5]

// ── slide-in ──────────────────────────────────────────────────────────
const wrapX = frames((i) => {
  if (i >= A_END) return '0vw'
  const t = i / A_END
  return `${(-60 * (1 - smooth(t)) + 4 * Math.sin((i * Math.PI) / 2) * (1 - t)).toFixed(2)}vw`
})

// ── body ──────────────────────────────────────────────────────────────
const bodyX = frames((i) => { const p = phase(i); if (p === 'W') return sway(i) * 8; if (p === 'P') return pump(i) * 2.5; return 0 })
const bodyY = frames((i) => {
  const p = phase(i)
  if (p === 'A') return -9 * bounce(i)
  if (p === 'W') return -6 * bounce(i)
  if (p === 'P') return pump(i) > 0 ? -7 : 2
  if (p === 'S') return -16 * Math.sin(Math.PI * spinU(i))
  if (p === 'H') return POPY[ht(i)]
  return 0
})
const bodyRot = frames((i) => {
  const p = phase(i)
  if (p === 'A') return (i >> 2) % 2 ? 5 : -5
  if (p === 'W') return sway(i) * 7
  if (p === 'P') return pump(i) * 5
  return 0
})
const bodySkew = frames((i) => { const p = phase(i); if (p === 'W') return sway(i) * 6; if (p === 'P') return pump(i) * 6; return 0 })
const bodySX = frames((i) => {
  const p = phase(i)
  if (p === 'S') { const c = spinCos(i); return (c < 0 ? -1 : 1) * Math.max(Math.abs(c), 0.22) }   // the turn (never paper-thin: he's a round little guy)
  if (p === 'H') return 1 + (POP[ht(i)] - 1) * 0.6
  return 1
})
const bodySY = frames((i) => {
  const p = phase(i)
  if (p === 'A') return 1 - 0.07 * (1 - bounce(i))
  if (p === 'W') return 1 - 0.05 * (1 - bounce(i))
  if (p === 'P') return pump(i) > 0 ? 1.04 : 0.94
  if (p === 'S') return 1 + 0.05 * Math.sin(Math.PI * spinU(i))
  if (p === 'H') return POP[ht(i)]
  return 1
})

// ── limbs ─────────────────────────────────────────────────────────────
const shoulderL = frames((i) => { const p = phase(i); if (p === 'W') return -sway(i) * 5; if (p === 'P') return -pump(i) * 8; if (p === 'H') return -8 * (1 - ht(i) / 5); return 0 })
const shoulderR = frames((i) => { const p = phase(i); if (p === 'W') return sway(i) * 5; if (p === 'P') return pump(i) * 8; if (p === 'H') return -8 * (1 - ht(i) / 5); return 0 })

// s = +1 for the left arm, -1 for the right arm
const armAngle = (i, s) => {
  const p = phase(i)
  if (p === 'A') return 16 + s * 16 * swing(i)
  if (p === 'W') return 38 + s * 26 * sway(i)                    // cross-swing
  if (p === 'P') return pump(i) * s > 0 ? 128 : 28               // alternating pumps
  if (p === 'S') return 60 + 20 * Math.sin(Math.PI * spinU(i))   // arms out wide
  if (p === 'H') return HIT_ARM[ht(i)]
  return HIT_ARM[5] * (1 - smooth(clamp((i - H_END) / (N - H_END), 0, 1)))   // settle to sides
}
const armL = frames((i) => armAngle(i, 1))
const armR = frames((i) => -armAngle(i, -1))

const legL = frames((i) => { const p = phase(i); if (p === 'A') return -6 * Math.max(0, swing(i)); if (p === 'W') return -5 * Math.max(0, sway(i)); if (p === 'P') return pump(i) > 0 ? -6 : 0; return 0 })
const legR = frames((i) => { const p = phase(i); if (p === 'A') return -6 * Math.max(0, -swing(i)); if (p === 'W') return -5 * Math.max(0, -sway(i)); if (p === 'P') return pump(i) > 0 ? 0 : -6; return 0 })

// ── face ──────────────────────────────────────────────────────────────
const eyeX = frames((i) => { const p = phase(i); if (p === 'W') return sway(i) * 3; if (p === 'P') return pump(i) * 2; return 0 })
const eyeSY = frames((i) => { const p = phase(i); if (p === 'H') return 0.45; if (p === 'W' || p === 'P') return 0.85; return 1 })
const faceO = frames((i) => (phase(i) === 'S' ? clamp((spinCos(i) - 0.05) / 0.25, 0, 1) : 1))   // hidden while his back is to us
const mouthD = frames((i) => { const p = phase(i); return p === 'A' || p === 'D' ? NORMAL : GRIN })
const fingerO = frames((i) => (i >= H_END ? Math.min(1, (i - H_END) / 3) : 0))

// ── effects ───────────────────────────────────────────────────────────
const fxO = frames((i) => (phase(i) === 'P' ? (pump(i) > 0 ? 1 : 0.35) : 0))              // vibration marks
const starO = frames((i) => (phase(i) === 'H' ? HIT_STAR_O[ht(i)] : 0))
const starS = frames((i) => (phase(i) === 'H' ? HIT_STAR_S[ht(i)] : 0.5))
const shadowS = frames((i) => clamp(1 + bodyY[i] / 60, 0.55, 1.1))                          // shadow shrinks as he jumps
const beatP = (i) => (i % 8) / 8
const ringActive = (i) => i >= A_END && i < S_END
const ringS = frames((i) => (ringActive(i) ? 0.5 + 1.3 * beatP(i) : 0.5))
const ringO = frames((i) => (ringActive(i) ? 0.5 * (1 - beatP(i)) : 0))                    // one ripple per beat

export const FRAMES = {
  wrapX, bodyX, bodyY, bodyRot, bodySkew, bodySX, bodySY,
  shoulderL, shoulderR, armL, armR, legL, legR,
  eyeX, eyeSY, faceO, mouthD, fingerO,
  fxO, starO, starS, shadowS, ringS, ringO,
}
