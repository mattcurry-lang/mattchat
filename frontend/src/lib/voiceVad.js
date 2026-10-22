 // src/lib/voiceVad.js
// Decides, frame by frame, when you start and stop talking.
// A plain loudness detector, but built the way voice engineers build them:
//
//  * Adaptive noise floor. The first ~0.35 s is used to measure how noisy the
//    room is, so a fan or a busy street doesn't count as speech (and doesn't keep
//    the mic open forever).
//  * Two thresholds (hysteresis). Louder is needed to START than to CONTINUE, so a
//    voice hovering near the line can't flicker between speech and silence.
//  * Onset confirmation. Sound must stay above the line for a moment before it
//    counts as speech, so a click, a bump or a cough is ignored.
//  * Hangover. After you stop, it waits a beat before deciding you're done, so a
//    pause between words doesn't cut you off mid-sentence.
//  * Timeouts. Nothing said for a few seconds ends the session politely, and a
//    hard cap stops a runaway recording.
//
// push(level, nowMs): level is the average loudness 0..255 of the speech band.
// It returns { phase, speaking, event } where event is one of:
//   'speech-start' | 'speech-end' | 'misfire' | 'no-speech' | 'max-length' | null

export const VAD_DEFAULTS = {
  calibrationMs: 350,   // measure room noise first
  enterMargin: 2.0,     // start threshold = noise floor x this ...
  enterAdd: 7,          // ... plus this
  minEnter: 12,         // never more sensitive than this (0-255 scale)
  maxFloor: 25,         // the "room" can never be estimated louder than this, so starting to
                        // talk the instant you tap the mic can't be mistaken for room noise
  exitRatio: 0.7,       // keep-going threshold = start threshold x this
  onsetMs: 110,         // must stay loud this long to count as speech
  hangoverMs: 1300,     // silence this long after speech = finished
  minSpeechMs: 260,     // shorter than this was a noise, not a word
  noSpeechMs: 7000,     // nothing said by now = give up
  maxMs: 30000,         // hard limit on one recording
}

const percentile = (arr, p) => {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}

export function createVad(options = {}) {
  const o = { ...VAD_DEFAULTS, ...options }
  let t0 = null
  let phase = 'calibrating'          // calibrating -> waiting -> speaking -> done
  const calib = []
  let enter = o.minEnter
  let exit = o.minEnter * o.exitRatio
  let onsetAt = null                 // when the current loud run began
  let speechStart = null
  let lastLoud = null

  const done = (event) => { phase = 'done'; return { phase, speaking: false, event } }

  function push(level, now) {
    if (phase === 'done') return { phase, speaking: false, event: null }
    if (t0 === null) t0 = now
    const elapsed = now - t0

    if (phase === 'calibrating') {
      calib.push(level)
      if (elapsed >= o.calibrationMs) {
        // the quietest quarter of the samples = the room, even if you started talking early
        const floor = Math.min(o.maxFloor, percentile(calib, 0.25))
        enter = Math.max(o.minEnter, floor * o.enterMargin + o.enterAdd)
        exit = enter * o.exitRatio
        phase = 'waiting'
      }
      return { phase, speaking: false, event: null }
    }

    if (phase === 'waiting') {
      if (level > enter) {
        if (onsetAt === null) onsetAt = now
        if (now - onsetAt >= o.onsetMs) {
          phase = 'speaking'
          speechStart = onsetAt
          lastLoud = now
          return { phase, speaking: true, event: 'speech-start' }
        }
      } else {
        onsetAt = null
      }
      if (elapsed >= o.noSpeechMs) return done('no-speech')
      return { phase, speaking: false, event: null }
    }

    // speaking
    if (level > exit) lastLoud = now
    if (now - speechStart >= o.maxMs) return done('max-length')
    if (now - lastLoud >= o.hangoverMs) {
      if (lastLoud - speechStart < o.minSpeechMs) {
        // that was a blip, not speech: go back to listening
        phase = 'waiting'
        onsetAt = null
        speechStart = null
        return { phase, speaking: false, event: 'misfire' }
      }
      return done('speech-end')
    }
    return { phase, speaking: true, event: null }
  }

  return { push, get thresholds() { return { enter, exit } } }
}
