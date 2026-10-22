import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { STEP, N, ENTRANCE, NORMAL, FRAMES } from './ShushhhChoreo'

// Shushhh mascot.
//
// mood: 'entrance' (the Afrobeats groove dance-in, see ShushhhChoreo.js) | 'idle' | 'curious' | 'leaving'
// onDone fires once when 'entrance' or 'leaving' finishes (immediately if reduced motion).
//
// v3: no animation library. A plain requestAnimationFrame loop computes the pose for the current time and
// writes each part's SVG `transform` attribute directly (with explicit pivots). It works in every browser,
// doesn't depend on measuring SVG boxes, and one failing part can never freeze the others.

export const MASCOT_ENTRANCE_SECONDS = ENTRANCE
export const DANCE_VERSION = 'afrobeats-groove v3 (direct)'

const LEAVE_SECONDS = 1.3
const BLEND_SECONDS = 0.25   // smooth hand-over between moods

const REST = {
  wrapX: 0, wrapO: 1,
  bodyX: 0, bodyY: 0, bodyRot: 0, bodySkew: 0, bodySX: 1, bodySY: 1,
  shoulderL: 0, shoulderR: 0, armL: 0, armR: 0, legL: 0, legR: 0,
  eyeX: 0, eyeSY: 1, faceO: 1, mouth: NORMAL, fingerO: 0,
  fxO: 0, starO: 0, starS: 0.5, shadowS: 1, ringS: 0.5, ringO: 0,
}

// ── tiny math helpers ────────────────────────────────────────────────
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, k) => a + (b - a) * k
const smooth = (t) => t * t * (3 - 2 * t)
const wave = (u) => 0.5 - 0.5 * Math.cos(2 * Math.PI * u)             // 0 -> 1 -> 0, eased
// piecewise keyframes with eased segments; `times` defaults to evenly spaced
const kf = (u, vals, times) => {
  const ts = times || vals.map((_, i) => i / (vals.length - 1))
  const x = clamp(u, 0, 1)
  for (let i = 0; i < ts.length - 1; i++) {
    if (x <= ts[i + 1]) return lerp(vals[i], vals[i + 1], smooth((x - ts[i]) / (ts[i + 1] - ts[i] || 1)))
  }
  return vals[vals.length - 1]
}
const nums = (s) => s.match(/-?\d+(\.\d+)?/g).map(Number)
const lerpPath = (a, b, k) => { const nb = nums(b); let n = 0; return a.replace(/-?\d+(\.\d+)?/g, (m) => String(+lerp(+m, nb[n++], k).toFixed(3))) }
const lerpPose = (a, b, k) => {
  const out = {}
  for (const key of Object.keys(REST)) out[key] = key === 'mouth' ? lerpPath(a[key], b[key], k) : lerp(a[key], b[key], k)
  return out
}

// ── poses over time ──────────────────────────────────────────────────
const entrancePose = (t) => {
  const f = clamp(t / STEP, 0, N)
  const i = Math.min(N - 1, Math.floor(f))
  const k = f - i
  const ch = (name) => lerp(FRAMES[name][i], FRAMES[name][i + 1], k)
  return {
    ...REST,
    wrapX: lerp(parseFloat(FRAMES.wrapX[i]), parseFloat(FRAMES.wrapX[i + 1]), k),
    bodyX: ch('bodyX'), bodyY: ch('bodyY'), bodyRot: ch('bodyRot'), bodySkew: ch('bodySkew'), bodySX: ch('bodySX'), bodySY: ch('bodySY'),
    shoulderL: ch('shoulderL'), shoulderR: ch('shoulderR'), armL: ch('armL'), armR: ch('armR'), legL: ch('legL'), legR: ch('legR'),
    eyeX: ch('eyeX'), eyeSY: ch('eyeSY'), faceO: ch('faceO'), fingerO: ch('fingerO'),
    mouth: lerpPath(FRAMES.mouthD[i], FRAMES.mouthD[i + 1], k),
    fxO: ch('fxO'), starO: ch('starO'), starS: ch('starS'), shadowS: ch('shadowS'), ringS: ch('ringS'), ringO: ch('ringO'),
  }
}
const idlePose = (t) => {
  const w = wave((t % 3.4) / 3.4)
  const blink = kf((t % 4) / 4, [1, 1, 0.1, 1, 1], [0, 0.9, 0.94, 0.98, 1])
  return { ...REST, bodyY: -3 * w, bodySY: 1 + 0.018 * w, armL: 2 * w, armR: -2 * w, eyeSY: blink }
}
const curiousPose = (t) => {
  const u = (t % 4.2) / 4.2
  return { ...REST, bodyY: -2 * wave(u), bodyRot: -5 * Math.sin(2 * Math.PI * u), eyeX: 2 * Math.sin(2 * Math.PI * u) }
}
const leavingPose = (t) => {
  const u = clamp(t / LEAVE_SECONDS, 0, 1)
  const s = kf(u, [1, 1, 1, 0.85], [0, 0.3, 0.6, 1])
  return {
    ...REST,
    wrapO: kf(u, [1, 1, 1, 0], [0, 0.3, 0.6, 1]),
    bodyY: kf(u, [0, -4, 0, 12], [0, 0.3, 0.6, 1]), bodySX: s, bodySY: s,
    armR: kf(clamp(t / 1.2, 0, 1), [0, -125, -145, -125, -145, -125, 0]),
    fingerO: clamp(t / 0.17, 0, 1),
  }
}
const poseFor = (mood, t) => (mood === 'entrance' ? entrancePose(t) : mood === 'curious' ? curiousPose(t) : mood === 'leaving' ? leavingPose(t) : idlePose(t))

// ── write a pose onto the SVG ────────────────────────────────────────
const T = (px, py, x = 0, y = 0, sx = 1, sy = 1, rot = 0, skew = 0) =>
  `translate(${px} ${py}) translate(${x} ${y}) scale(${sx} ${sy}) rotate(${rot}) skewX(${skew}) translate(${-px} ${-py})`
const r3 = (v) => +v.toFixed(3)

function applyPose(els, p) {
  const set = (el, attr, v) => { if (el) el.setAttribute(attr, v) }
  if (els.wrap) { els.wrap.style.transform = `translateX(${r3(p.wrapX)}vw)`; els.wrap.style.opacity = String(r3(p.wrapO)) }
  set(els.body, 'transform', T(80, 158, r3(p.bodyX), r3(p.bodyY), r3(p.bodySX), r3(p.bodySY), r3(p.bodyRot), r3(p.bodySkew)))
  set(els.legL, 'transform', `translate(0 ${r3(p.legL)})`)
  set(els.legR, 'transform', `translate(0 ${r3(p.legR)})`)
  set(els.shL, 'transform', `translate(0 ${r3(p.shoulderL)})`)
  set(els.shR, 'transform', `translate(0 ${r3(p.shoulderR)})`)
  set(els.armL, 'transform', T(27, 83.8, 0, 0, 1, 1, r3(p.armL)))
  set(els.armR, 'transform', T(133, 83.8, 0, 0, 1, 1, r3(p.armR)))
  set(els.eyes, 'transform', T(81, 76, r3(p.eyeX), 0, 1, r3(p.eyeSY)))
  set(els.eyes, 'opacity', r3(p.faceO))
  set(els.mouth, 'd', p.mouth)
  set(els.mouth, 'opacity', r3(p.faceO))
  set(els.finger, 'opacity', r3(clamp(p.fingerO, 0, 1)))
  set(els.fx, 'opacity', r3(p.fxO))
  ;['star1', 'star2', 'star3'].forEach((k) => { set(els[k], 'opacity', r3(p.starO)); set(els[k], 'transform', `scale(${r3(Math.max(0.01, p.starS))})`) })
  set(els.ring, 'transform', T(80, 172, 0, 0, r3(p.ringS), r3(p.ringS)))
  set(els.ring, 'opacity', r3(p.ringO))
  set(els.shadow, 'transform', T(80, 172, 0, 0, r3(p.shadowS), 1))
}

function useSystemReduceMotion() {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  const [reduce, setReduce] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return undefined
    const on = () => setReduce(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduce
}

const STAR = 'M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2Z'

// forceMotion: play the animation even if the system says "reduce motion" (only used when the person taps to play it)
export default function ShushhhMascot({ size = 140, mood = 'idle', onDone, forceMotion = false }) {
  const systemReduce = useSystemReduceMotion()
  const reduce = systemReduce && !forceMotion
  const uid = useId().replace(/:/g, '')

  const els = useRef({})
  const reg = (name) => (el) => { els.current[name] = el }
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const lastPose = useRef(null)

  // first paint: the right starting pose (off-screen for the entrance), never a flash of the wrong one
  useLayoutEffect(() => {
    applyPose(els.current, mood === 'entrance' && !reduce ? entrancePose(0) : (lastPose.current || REST))
  }, []) // eslint-disable-line

  // proof of which dance is running: look for this in the browser console (F12)
  useEffect(() => {
    if (mood === 'entrance') console.info(`[Shushhh] dance: ${DANCE_VERSION}${reduce ? ' (skipped: system reduce-motion is on)' : ''}`)
  }, [mood, reduce])

  useEffect(() => {
    if (reduce) {
      applyPose(els.current, REST)
      lastPose.current = REST
      if (mood === 'entrance' || mood === 'leaving') onDoneRef.current?.(mood)
      return undefined
    }
    const from = lastPose.current
    const start = performance.now()
    let raf = 0
    let finished = false
    const finish = (pose) => {
      finished = true
      lastPose.current = pose
      if (mood === 'entrance' || mood === 'leaving') onDoneRef.current?.(mood)
    }
    const loop = () => {
      const t = (performance.now() - start) / 1000
      let pose = poseFor(mood, t)
      if (from && mood !== 'entrance' && t < BLEND_SECONDS) pose = lerpPose(from, pose, smooth(t / BLEND_SECONDS))
      applyPose(els.current, pose)
      lastPose.current = pose
      if (mood === 'entrance' && t >= ENTRANCE) { const end = entrancePose(ENTRANCE); applyPose(els.current, end); finish(end); return }
      if (mood === 'leaving' && t >= LEAVE_SECONDS) { const end = leavingPose(LEAVE_SECONDS); applyPose(els.current, end); finish(end); return }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); if (!finished) lastPose.current = lastPose.current || REST }
  }, [mood, reduce])

  return (
    <div ref={reg('wrap')} data-dance={DANCE_VERSION} style={{ display: 'inline-block', lineHeight: 0 }}>
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
        {/* a ripple on the floor with every beat of the dance, and the shadow */}
        <ellipse ref={reg('ring')} cx="80" cy="172" rx="34" ry="6" fill="none" stroke="#c4b5fd" strokeWidth="2" opacity="0" />
        <ellipse ref={reg('shadow')} cx="80" cy="172" rx="34" ry="5" fill="rgba(139,92,246,0.25)" />

        {/* sparkles on each "hit" */}
        <g transform="translate(22 30)"><path ref={reg('star1')} d={STAR} fill="#ddd6fe" opacity="0" /></g>
        <g transform="translate(140 24)"><path ref={reg('star2')} d={STAR} fill="#c4b5fd" opacity="0" /></g>
        <g transform="translate(80 8)"><path ref={reg('star3')} d={STAR} fill="#ede9fe" opacity="0" /></g>

        <g ref={reg('body')}>
          {/* legs */}
          <rect ref={reg('legL')} x="55" y="128" width="18" height="30" rx="9" fill="#5b21b6" />
          <rect ref={reg('legR')} x="87" y="128" width="18" height="30" rx="9" fill="#5b21b6" />

          {/* shoulders + arms (shoulders bob in opposite directions = the shimmy) */}
          <g ref={reg('shL')}>
            <rect ref={reg('armL')} x="20" y="80" width="14" height="38" rx="7" fill="#7c3aed" />
            <circle cx="28" cy="87" r="8.5" fill="#8b5cf6" />
          </g>
          <g ref={reg('shR')}>
            <rect ref={reg('armR')} x="126" y="80" width="14" height="38" rx="7" fill="#7c3aed" />
            <circle cx="132" cy="87" r="8.5" fill="#8b5cf6" />
          </g>

          {/* body */}
          <rect x="30" y="28" width="100" height="108" rx="46" fill={`url(#b${uid})`} />
          <rect x="42" y="36" width="52" height="14" rx="7" fill="#fff" opacity="0.12" />

          {/* vibration marks beside the shoulders while shimmying */}
          <g ref={reg('fx')} opacity="0" stroke="#c4b5fd" strokeWidth="2.4" strokeLinecap="round" fill="none">
            <path d="M12 74 q-6 9 0 18" /><path d="M5 68 q-9 15 0 30" />
            <path d="M148 74 q6 9 0 18" /><path d="M155 68 q9 15 0 30" />
          </g>

          {/* face */}
          <g ref={reg('eyes')}>
            <ellipse cx="62" cy="76" rx="6.5" ry="8.5" fill="#1a1033" />
            <ellipse cx="98" cy="76" rx="6.5" ry="8.5" fill="#1a1033" />
            <circle cx="64" cy="72.5" r="2" fill="#fff" opacity="0.9" />
            <circle cx="100" cy="72.5" r="2" fill="#fff" opacity="0.9" />
          </g>
          <path ref={reg('mouth')} d={NORMAL} stroke="#1a1033" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <rect ref={reg('finger')} x="76.5" y="88" width="7" height="26" rx="3.5" fill="#ddd6fe" opacity="0" />
        </g>
      </svg>
    </div>
  )
}
