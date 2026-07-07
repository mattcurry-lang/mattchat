import { useEffect, useRef } from 'react'
// Generates two distinct tones with the Web Audio API — no audio file needed.
//
// mode='ringback' — what the CALLER hears while the other person's phone
// is ringing. Classic dual-tone (440Hz+480Hz), slow steady cadence
// (2s on / 4s off), same as a US ringback tone.
//
// mode='ringtone' — what the RECEIVER hears for an incoming call. Higher,
// brighter double-chirp pattern so the two are never confused for each
// other even with your eyes closed.
//
// Usage: useRingtone(isRinging, mode) — stops automatically when
// isRinging goes false.
export function useRingtone(isRinging, mode = 'ringback') {
  const audioCtxRef = useRef(null)
  const timeoutsRef = useRef([])
  const stoppedRef = useRef(true)

  useEffect(() => {
    function clearAllTimeouts() {
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current = []
    }
    function stopRing() {
      stoppedRef.current = true
      clearAllTimeouts()
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
    }
    if (!isRinging) {
      stopRing()
      return
    }

    let ctx
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      ctx = new AudioContext()
      audioCtxRef.current = ctx
    } catch (e) {
      return
    }
    stoppedRef.current = false

    function playTone(freq1, freq2, start, dur, peakGain = 0.15) {
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()
      osc1.frequency.value = freq1
      osc2.frequency.value = freq2
      osc1.type = 'sine'
      osc2.type = 'sine'
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(peakGain, start + 0.04)
      gain.gain.setValueAtTime(peakGain, start + dur - 0.06)
      gain.gain.linearRampToValueAtTime(0, start + dur)
      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)
      osc1.start(start)
      osc2.start(start)
      osc1.stop(start + dur)
      osc2.stop(start + dur)
    }

    function ringbackBurst() {
      if (stoppedRef.current) return
      playTone(440, 480, ctx.currentTime, 2.0)
      const t = setTimeout(ringbackBurst, 6000) // 2s ring + 4s silence
      timeoutsRef.current.push(t)
    }

    function ringtoneBurst() {
      if (stoppedRef.current) return
      const now = ctx.currentTime
      // Two short bright chirps back to back, then a pause —
      // deliberately busier/higher than the ringback tone.
      playTone(830, 1046, now, 0.4)
      playTone(830, 1046, now + 0.55, 0.4)
      const t = setTimeout(ringtoneBurst, 2500)
      timeoutsRef.current.push(t)
    }

    if (mode === 'ringtone') ringtoneBurst()
    else ringbackBurst()

    return stopRing
  }, [isRinging, mode])
}
