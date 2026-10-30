// ShushhhChoreo.js — the mascot's dance-in, as plain data/maths (no React), so it can be tested and previewed.
//
// "Makola groove": the mascot's version of the guinea-fowl dance in the reference video. Moves it borrows:
//   HOP     he leaps in from the side, arms out like wings, and lands with a squash
//   CROSS   stands tall, arms crossed low in front, slow poker-face glance
//   SQUAT   the signature move: wide low stance, long arms hanging wide, weight rocking side to side,
//           one shoulder dropping on every beat
//   SING    stands up, head thrown back, beak open, eyes shut, arms folded low, swaying
//   LOLL    half-squat, fists pumping at the waist, head lolling side to side, mouth popping open on the beat
//   SQUAT2  back to the wide low stance, calmer, deadpan stare at the camera
//   HIT     pop pose: arms up in a V, sparkles
//   SHH     arms drop, finger to lips: "shhh" (the brand sign-off, unchanged)
//
// Everything is locked to ONE clock: BPM. The reference song measures about 110 BPM and the head sways once
// per two beats (about 1 s), which is the "rock" in SQUAT/LOLL. Change BPM to speed the whole dance up or down.
//
// DANCE_LENGTH: 'full' is about 9 s, 'short' is about 5.5 s (HOP, CROSS, a shorter SQUAT, LOLL, HIT, SHH).

export const BPM = 110
export const BEAT = 60 / BPM
export const DANCE_LENGTH = 'full' // 'full' | 'short'

export const STEP = 0.05 // seconds per stored frame (FRAMES below); the mascot itself samples the maths directly

export const NORMAL = 'M73 101 Q80 106 87 101'
export const GRIN = 'M69 99 Q80 114 91 99'

const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, k) => a + (b - a) * k
const smooth = (t) => t * t * (3 - 2 * t)

// Every channel the mascot understands, at its neutral value.
export const REST_POSE = {
  wrapX: 0, wrapO: 1,                                   // slide in (vw) / fade
  bodyX: 0, bodyY: 0, bodyRot: 0, bodySkew: 0, bodySX: 1, bodySY: 1,
  shoulderL: 0, shoulderR: 0,                           // shoulder up/down (px)
  armL: 0, armR: 0, armX: 0, armY: 0,                   // arm angle (deg, + = out), slide inward / down (px)
  legL: 0, legR: 0, legSpread: 0, legSY: 1,             // leg lift (px), stance width (px), leg length
  faceX: 0, faceY: 0, faceRot: 0, faceS: 1,             // head sway / bob / tilt / scale
  eyeX: 0, eyeSY: 1, faceO: 1,
  mouthSmile: 0, mouthOpen: 0, fingerO: 0,              // 0 = flat mouth, 1 = grin  /  0 = shut, 1 = wide open
  fxO: 0, starO: 0, starS: 0.5, shadowS: 1, ringS: 0.5, ringO: 0,
}

// The mouth as a closed path so it can morph from flat, to grin, to a wide-open "singing" beak.
export function mouthPath(smile, open) {
  const s = clamp(smile, 0, 1)
  const o = clamp(open, 0, 1)
  const half = lerp(7, 11, s) + 1.5 * o
  const y0 = lerp(101, 99, s) - 2.5 * o
  const top = lerp(lerp(106, 114, s), y0 + 2, o)
  const bot = lerp(top, y0 + 30, o)
  const r = (v) => +v.toFixed(2)
  return `M${r(80 - half)} ${r(y0)} Q80 ${r(top)} ${r(80 + half)} ${r(y0)} Q80 ${r(bot)} ${r(80 - half)} ${r(y0)} Z`
}

// Fill in the things that follow from the rest: feet stay planted when he squats, the shadow follows the jump.
const P = (over) => {
  const p = { ...REST_POSE, ...over }
  if (over.legSY === undefined) p.legSY = clamp((30 - Math.max(0, p.bodyY)) / 30, 0.5, 1)
  if (over.shadowS === undefined) p.shadowS = clamp(1 + p.bodyY / 60, 0.55, 1.1)
  return p
}
const mixPose = (a, b, k) => {
  const out = {}
  for (const key of Object.keys(REST_POSE)) out[key] = lerp(a[key], b[key], k)
  return out
}

// ── waveforms, all in BEATS ───────────────────────────────────────────
const beatPulse = (b) => 0.5 + 0.5 * Math.cos(TAU * b)   // 1 on every beat, 0 half-way between
const side = (b) => Math.cos(Math.PI * b)                // +1 / -1: flips every beat = the side-to-side rock
const ripple = (b, amp) => { const p = b - Math.floor(b); return { ringS: 0.5 + 1.3 * p, ringO: amp * (1 - p) } }

// ── the sections: each is fn(b, lb) with b = absolute beat, lb = beats since this section started ──
const HOP = (b) => {
  const u = clamp(b / 2, 0, 1)
  const air = Math.sin(Math.PI * u)
  const wings = 74 - 32 * smooth(clamp((u - 0.65) / 0.35, 0, 1)) + 6 * Math.sin(TAU * b) * (1 - u)
  return P({
    wrapX: -60 * (1 - smooth(u)),
    bodyY: -34 * air, bodyRot: 9 * air, bodySX: 1 - 0.04 * air, bodySY: 1 + 0.05 * air,
    armL: wings, armR: -wings,
    legL: -9 * air, legR: -3 * air,
    shoulderL: -3 * air, shoulderR: -3 * air,
    faceX: 3 * air, mouthSmile: 0.9, eyeSY: 1.1,
  })
}

const CROSS = (b, lb) => {
  const pulse = beatPulse(b)
  const sd = side(b)
  const land = Math.exp(-lb * 6) // squash on landing, gone in half a beat
  return P({
    bodyY: 1.5 * pulse + 7 * land, bodySY: 1 - 0.13 * land, bodySX: 1 + 0.07 * land,
    bodyRot: 2.5 * sd,
    armX: 28, armY: 26, armL: -45, armR: 45,            // arms folded low in front
    shoulderL: -3, shoulderR: -3,
    faceY: 1.5 * pulse, faceRot: 3 * sd,
    eyeX: 3 * Math.sin((Math.PI * b) / 2),              // slow poker-face glance
    mouthSmile: 0.1,
  })
}

// k = intensity: 1 = full groove, 0.6 = calmer
const SQUAT = (b, lb, k = 1) => {
  const sd = side(b)
  const pulse = beatPulse(b)
  const fling = Math.exp(-lb * 4) // arms thrown wide as he drops into the stance
  return P({
    bodyX: 7 * k * sd, bodyY: 8 + 2.5 * k * pulse, bodyRot: 5 * k * sd, bodySkew: 3 * k * sd,
    bodySX: 1.05, bodySY: 0.93 - 0.02 * k * pulse,
    legSpread: 10,
    armL: 38 + 10 * k * sd + 32 * fling,
    armR: -38 + 10 * k * sd - 32 * fling,
    shoulderL: -4 * k * sd, shoulderR: 4 * k * sd,
    faceX: 3 * k * sd, faceY: 2 + 2.5 * k * pulse, faceRot: 8 * k * sd,
    eyeX: 2 * sd, mouthSmile: 0.3,
    fxO: 0.4 * k * pulse,
    ...ripple(b, 0.5),
  })
}
const SQUAT2 = (b, lb) => ({
  ...SQUAT(b, lb, 0.6),
  ...P({
    ...SQUAT(b, lb, 0.6),
    faceX: 0, faceRot: 1.5 * side(b), eyeX: 0, eyeSY: 1.08, mouthSmile: 0, mouthOpen: 0.12,
    armL: 44 + 5 * side(b) + 24 * Math.exp(-lb * 4), armR: -44 + 5 * side(b) - 24 * Math.exp(-lb * 4),
  }),
})

const SING = (b) => {
  const sd = side(b)
  const pulse = beatPulse(b)
  return P({
    bodyX: 4 * sd, bodyY: 1 + 2 * pulse, bodyRot: 3 * sd, bodySY: 1.03,
    armX: 26, armY: 26, armL: -45, armR: 45,
    shoulderL: -2, shoulderR: -2,
    faceX: 2 * sd, faceY: -5 + 1.5 * pulse, faceRot: 10 * sd, faceS: 1.04,   // head thrown back
    eyeSY: 0.12,                                                              // eyes shut
    mouthOpen: 0.5 + 0.5 * pulse, mouthSmile: 0,
    ...ripple(b, 0.35),
  })
}

const LOLL = (b) => {
  const sd = side(b)
  const pulse = beatPulse(b)
  return P({
    bodyX: 5 * sd, bodyY: 6 + 2 * pulse, bodyRot: 4 * sd, bodySX: 1.03, bodySY: 0.96,
    legSpread: 7,
    armX: 9, armY: 10 + 4 * pulse, armL: 26 + 6 * sd, armR: -26 + 6 * sd,       // fists pumping at the waist
    shoulderL: -3 * sd, shoulderR: 3 * sd,
    faceX: 6 * sd, faceY: 2 + 3 * (1 - pulse), faceRot: 16 * sd,               // head lolling
    eyeSY: 0.7 + 0.3 * (0.5 + 0.5 * sd),
    mouthOpen: 0.75 * pulse, mouthSmile: 0,
    ...ripple(b, 0.35),
  })
}

const HIT = (b, lb) => {
  const h = clamp(lb / 0.8, 0, 1)
  const e = 1 - smooth(h)
  return P({
    bodyY: -16 * e, bodySX: 1 + 0.1 * e, bodySY: 1 + 0.16 * e,
    armL: 112 + 28 * e, armR: -(112 + 28 * e),
    shoulderL: -8 * (1 - h), shoulderR: -8 * (1 - h),
    eyeSY: 0.45, mouthSmile: 1,
    starO: Math.pow(1 - h, 1.5), starS: 1.35 - 0.85 * h,
  })
}

const SHH = (b, lb) => {
  const d = smooth(clamp(lb / 1.2, 0, 1))
  return P({
    armL: 112 * (1 - d), armR: -112 * (1 - d),
    fingerO: clamp(lb / 0.5, 0, 1),
  })
}

// ── the running order (beats) ─────────────────────────────────────────
const FADE = 0.5 // default crossfade between sections, in beats
const SECTIONS_FULL = [
  { id: 'HOP', beats: 2, fn: HOP },
  { id: 'CROSS', beats: 2, fn: CROSS, fade: 0.12 },   // landing is a hard cut
  { id: 'SQUAT', beats: 4, fn: SQUAT },
  { id: 'SING', beats: 2, fn: SING },
  { id: 'LOLL', beats: 2, fn: LOLL },
  { id: 'SQUAT2', beats: 2, fn: SQUAT2 },
  { id: 'HIT', beats: 1, fn: HIT, fade: 0.1 },
  { id: 'SHH', beats: 1.5, fn: SHH, fade: 0.2 },
]
const SECTIONS_SHORT = [
  { id: 'HOP', beats: 2, fn: HOP },
  { id: 'CROSS', beats: 1, fn: CROSS, fade: 0.12 },
  { id: 'SQUAT', beats: 3, fn: SQUAT },
  { id: 'LOLL', beats: 2, fn: LOLL },
  { id: 'HIT', beats: 0.75, fn: HIT, fade: 0.1 },
  { id: 'SHH', beats: 1.25, fn: SHH, fade: 0.2 },
]

let acc = 0
export const TIMELINE = (DANCE_LENGTH === 'short' ? SECTIONS_SHORT : SECTIONS_FULL).map((s) => {
  const o = { ...s, start: acc }
  acc += s.beats
  return o
})
export const TOTAL_BEATS = acc
export const ENTRANCE = TOTAL_BEATS * BEAT
export const N = Math.round(ENTRANCE / STEP)

// The whole dance as a function of time (seconds). Returns every channel as a number.
export function dancePose(t) {
  const b = clamp(t / BEAT, 0, TOTAL_BEATS)
  let i = TIMELINE.findIndex((s) => b < s.start + s.beats)
  if (i < 0) i = TIMELINE.length - 1
  const s = TIMELINE[i]
  const lb = b - s.start
  const cur = s.fn(b, lb)
  const f = s.fade ?? FADE
  if (i > 0 && lb < f) {
    const prev = TIMELINE[i - 1]
    return mixPose(prev.fn(b, b - prev.start), cur, smooth(lb / f))
  }
  return cur
}

// Stored frames, kept for previews/tests that read them (same shape as before; mouthD is the mouth path).
export const FRAMES = (() => {
  const keys = Object.keys(REST_POSE)
  const f = { mouthD: [] }
  keys.forEach((k) => { f[k] = [] })
  for (let i = 0; i <= N; i++) {
    const p = dancePose(i * STEP)
    keys.forEach((k) => f[k].push(k === 'wrapX' ? `${p.wrapX.toFixed(2)}vw` : p[k]))
    f.mouthD.push(mouthPath(p.mouthSmile, p.mouthOpen))
  }
  return f
})()
