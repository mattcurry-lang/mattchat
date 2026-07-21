// src/lib/mattchatSounds.js
//
// Mattchat's official sound identity. 'pulse' (incoming message) and
// 'ringtone'-style calls now play the studio-designed WAV assets in
// public/sounds/. The rest — tap, echo, spark, warning, beacon — stay
// as lightweight synthesized Web Audio tones, all built from soft
// sine/triangle oscillators with the same "glassy" envelope shape, so
// the whole family still feels like one voice.
//
// Usage:
//   import { playSound } from '../lib/mattchatSounds'
//   playSound('pulse')   // incoming message — plays notification.wav
//   playSound('tap')     // message sent
//   playSound('echo')    // Curry activated
//   playSound('spark')   // success
//   playSound('warning') // error
//   playSound('beacon')  // daily summary ready

let sharedCtx = null
function getContext() {
  if (!sharedCtx) sharedCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (sharedCtx.state === 'suspended') sharedCtx.resume()
  return sharedCtx
}

// A single soft tone: sine/triangle oscillator through a gentle lowpass
// filter, with a fast attack and smooth exponential release — this
// "glassy" envelope shape is what gives every Mattchat sound its shared
// family resemblance, regardless of pitch or duration.
function tone(ctx, { freq, start, duration, gain = 0.22, type = 'sine', filterFreq = 3200, glideTo = null }) {
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const env = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + duration)

  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(filterFreq, start)
  filter.Q.value = 0.7

  env.gain.setValueAtTime(0, start)
  env.gain.linearRampToValueAtTime(gain, start + Math.min(0.015, duration * 0.2)) // fast soft attack
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration)                  // smooth release, never abrupt

  osc.connect(filter)
  filter.connect(env)
  env.connect(ctx.destination)

  osc.start(start)
  osc.stop(start + duration + 0.05)
}

const SOUND_BUILDERS = {
  // "Tap" — message sent. A single tiny, quiet, crisp click-tone.
  tap: (ctx) => {
    const t = ctx.currentTime
    tone(ctx, { freq: 1046, start: t, duration: 0.07, gain: 0.09, type: 'triangle', filterFreq: 4200 })
  },

  // "Echo" — Curry AI activating. A smooth, layered, slightly detuned
  // rising chime — warm and intelligent, no sci-fi robot clichés.
  echo: (ctx) => {
    const t = ctx.currentTime
    tone(ctx, { freq: 440, start: t, duration: 0.5, gain: 0.14, type: 'sine', filterFreq: 2200, glideTo: 660 })
    tone(ctx, { freq: 554, start: t + 0.05, duration: 0.45, gain: 0.11, type: 'sine', filterFreq: 2600, glideTo: 740 })
    tone(ctx, { freq: 880, start: t + 0.18, duration: 0.35, gain: 0.09, type: 'sine', filterFreq: 3200 })
  },

  // "Spark" — success. Bright, quick, rewarding two-note lift.
  spark: (ctx) => {
    const t = ctx.currentTime
    tone(ctx, { freq: 698, start: t, duration: 0.14, gain: 0.2, type: 'sine', filterFreq: 3600 })
    tone(ctx, { freq: 932, start: t + 0.1, duration: 0.22, gain: 0.19, type: 'sine', filterFreq: 4000 })
  },

  // "Soft Warning" — error. A calm, gentle descending tone.
  warning: (ctx) => {
    const t = ctx.currentTime
    tone(ctx, { freq: 494, start: t, duration: 0.28, gain: 0.16, type: 'sine', filterFreq: 2000, glideTo: 349 })
  },

  // "Beacon" — daily summary ready. Three soft ascending layers.
  beacon: (ctx) => {
    const t = ctx.currentTime
    tone(ctx, { freq: 523, start: t, duration: 0.22, gain: 0.16, type: 'sine', filterFreq: 2600 })
    tone(ctx, { freq: 659, start: t + 0.12, duration: 0.24, gain: 0.16, type: 'sine', filterFreq: 3000 })
    tone(ctx, { freq: 880, start: t + 0.26, duration: 0.3, gain: 0.14, type: 'sine', filterFreq: 3600 })
  },
}

// Sounds backed by the studio-designed WAV files in public/sounds/,
// rather than synthesized live. Reuses one <audio> element per sound
// so rapid repeats (e.g. a burst of incoming messages) restart cleanly
// instead of overlapping or queuing.
const FILE_SOUNDS = {
  pulse: '/sounds/notification.wav', // incoming message
}
const fileAudioCache = {}

let audioUnlocked = false
export function unlockFileAudio() {
  if (audioUnlocked) return
  audioUnlocked = true
  Object.entries(FILE_SOUNDS).forEach(([name, path]) => {
    const el = new Audio(path)
    el.volume = 0
    el.play().then(() => { el.pause(); el.currentTime = 0 }).catch(() => {})
    fileAudioCache[name] = el
  })
}

 
function playFileSound(name, path) {
  if (!fileAudioCache[name]) {
    const el = new Audio(path)
    el.volume = 0.9
    fileAudioCache[name] = el
  }
  const el = fileAudioCache[name]
  el.currentTime = 0
  el.play().catch(() => {
    console.warn(`playSound: "${name}" playback blocked — page needs a user gesture to unlock audio first.`)
  })
}

/**
 * Plays one of Mattchat's official sounds: 'pulse' | 'tap' | 'echo' |
 * 'spark' | 'warning' | 'beacon'. Safe to call from any click/event
 * handler or realtime callback — 'pulse' plays the notification.wav
 * asset, the rest are synthesized on a shared AudioContext.
 */
export function playSound(name) {
  if (FILE_SOUNDS[name]) {
    playFileSound(name, FILE_SOUNDS[name])
    return
  }
  const builder = SOUND_BUILDERS[name]
  if (!builder) {
    console.warn(`playSound: unknown sound "${name}"`)
    return
  }
  try {
    const ctx = getContext()
    builder(ctx)
  } catch (e) {
    console.error('playSound failed:', e)
  }
}

export const MATTCHAT_SOUNDS = [...Object.keys(SOUND_BUILDERS), ...Object.keys(FILE_SOUNDS)]
