/*
  voiceFx.js: offline voice changer for voice notes.

  Pitch shifting keeps the note the same length: the audio is time-stretched
  with WSOLA (which keeps pitch), then resampled back to its original length
  (which moves pitch). Everything runs in the browser, on the recording,
  before it is uploaded. Output is a mono 22.05 kHz 16-bit WAV.
*/

const SR = 22050 // working sample rate

export const VOICE_FX = [
  { id: 'original', label: 'Original' },
  { id: 'deep', label: 'Deep', semitones: -4 },
  { id: 'giant', label: 'Giant', semitones: -8 },
  { id: 'soprano', label: 'Soprano', semitones: 5 },
  { id: 'chipmunk', label: 'Chipmunk', semitones: 9 },
  { id: 'robot', label: 'Robot', ring: 50 },
]

const yieldToUi = () => new Promise(resolve => setTimeout(resolve, 0))

/* ── DSP (pure functions, no browser APIs) ──────────────────── */

// WSOLA time-stretch: output is `factor` times as long, pitch unchanged
export async function stretch(x, sr, factor) {
  const N = Math.round(sr * 0.032) & ~1 // frame length (even)
  const H = N / 2                       // synthesis hop (50% overlap)
  const Ha = H / factor                 // analysis hop
  const tol = Math.round(sr * 0.008)    // search +/- 8 ms for the best-fitting frame
  const cmpLen = H
  const stride = 4

  const win = new Float32Array(N)
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)

  const out = new Float32Array(Math.ceil(x.length * factor) + 2 * N)
  let nominal = 0
  let prev = 0
  let outPos = 0
  let frame = 0

  for (;;) {
    let s = Math.round(nominal)
    if (frame === 0) {
      s = 0
    } else {
      const lo = Math.max(0, s - tol)
      const hi = Math.min(x.length - N, s + tol)
      if (lo > hi) break
      const target = prev + H // where the previous frame would naturally continue
      let best = Math.min(hi, Math.max(lo, s))
      if (target + cmpLen <= x.length) {
        let bestScore = Infinity
        for (let c = lo; c <= hi; c += 2) {
          let d = 0
          for (let j = 0; j < cmpLen; j += stride) d += Math.abs(x[target + j] - x[c + j])
          if (d < bestScore) { bestScore = d; best = c }
        }
      }
      s = best
    }
    if (s + N > x.length) break

    for (let i = 0; i < N; i++) {
      const w = frame === 0 && i < H ? 1 : win[i] // no fade-in on the very first frame
      out[outPos + i] += w * x[s + i]
    }
    prev = s
    outPos += H
    nominal += Ha
    frame++
    if (outPos + N > out.length) break
    if (frame % 250 === 0) await yieldToUi()
  }
  return out.subarray(0, Math.min(out.length, outPos + H))
}

// two cascaded one-pole low-pass filters (tames aliasing before pitching up)
export function lowpass(x, fc, sr) {
  const a = Math.exp((-2 * Math.PI * fc) / sr)
  const out = new Float32Array(x.length)
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < x.length; i++) {
    y1 = (1 - a) * x[i] + a * y1
    y2 = (1 - a) * y1 + a * y2
    out[i] = y2
  }
  return out
}

export async function pitchShift(x, sr, semitones) {
  const r = Math.pow(2, semitones / 12)
  if (x.length < sr * 0.3) return x
  let s = await stretch(x, sr, r)
  if (r > 1) s = lowpass(s, (sr / 2 / r) * 0.9, sr)
  const n = Math.max(0, Math.floor((s.length - 2) / r))
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i * r
    const k = p | 0
    const f = p - k
    out[i] = s[k] * (1 - f) + s[k + 1] * f
  }
  return out
}

// ring modulation: multiplies the voice by a low sine, the classic robot sound
export function ringMod(x, sr, hz, wet = 0.85) {
  const out = new Float32Array(x.length)
  const w = (2 * Math.PI * hz) / sr
  for (let i = 0; i < x.length; i++) out[i] = x[i] * (1 - wet) + wet * x[i] * Math.sin(w * i)
  return out
}

export function fitPeak(x, target = 0.92, allowBoost = false) {
  let peak = 0
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]))
  if (!peak || (peak <= target && !allowBoost)) return x
  const g = target / peak
  const out = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) out[i] = x[i] * g
  return out
}

export function encodeWav(x, sr) {
  const buf = new ArrayBuffer(44 + x.length * 2)
  const v = new DataView(buf)
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + x.length * 2, true)
  str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, x.length * 2, true)
  for (let i = 0; i < x.length; i++) {
    const s = Math.max(-1, Math.min(1, x[i]))
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buf], { type: 'audio/wav' })
}

// n bar heights (0..1) for the preview waveform
export function peaksFromSamples(x, n) {
  const out = []
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i / n) * x.length)
    const b = Math.max(a + 1, Math.floor(((i + 1) / n) * x.length))
    const step = Math.max(1, Math.floor((b - a) / 64))
    let m = 0
    for (let k = a; k < b && k < x.length; k += step) m = Math.max(m, Math.abs(x[k]))
    out.push(m)
  }
  const top = Math.max(...out) || 1
  return out.map(v => Math.max(0.14, Math.min(1, (v / top) * 0.95 + 0.05)))
}

/* ── browser entry point ────────────────────────────────────── */

// Takes the recorded blob and a voice id, returns { blob, secs, peaks }
export async function processVoice(blob, id) {
  const fx = VOICE_FX.find(f => f.id === id)
  if (!fx || id === 'original') throw new Error(`Unknown voice: ${id}`)

  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC()
  let decoded
  try {
    const bytes = await blob.arrayBuffer()
    decoded = await new Promise((resolve, reject) => {
      const p = ctx.decodeAudioData(bytes, resolve, reject)
      if (p && p.catch) p.catch(reject)
    })
  } finally {
    try { ctx.close() } catch { /* noop */ }
  }

  // let the browser downmix + resample properly (with anti-aliasing)
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
  const off = new OAC(1, Math.max(1, Math.ceil(decoded.duration * SR)), SR)
  const src = off.createBufferSource()
  src.buffer = decoded
  src.connect(off.destination)
  src.start()
  const rendered = await off.startRendering()

  let data = rendered.getChannelData(0)
  if (fx.semitones) data = await pitchShift(data, SR, fx.semitones)
  if (fx.ring) data = ringMod(data, SR, fx.ring)
  data = fitPeak(data, 0.92, !!fx.ring)

  return {
    blob: encodeWav(data, SR),
    secs: Math.max(1, Math.round(data.length / SR)),
    peaks: peaksFromSamples(data, 44),
  }
}
