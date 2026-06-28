import { useEffect, useRef } from 'react'

// Generates a classic two-tone phone ring (like the US ringback tone:
// 440Hz + 480Hz) entirely with the Web Audio API — no audio file needed.
// Plays a 2-second ring, then 4 seconds of silence, repeating — the
// same cadence as a real phone ring.
//
// Usage: useRingtone(isRinging) — pass true while a call should be
// audibly ringing (e.g. callStatus === 'calling' || 'incoming'), and
// it stops automatically when you pass false.
export function useRingtone(isRinging) {
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

    // Browsers block audio until a user gesture has happened somewhere
    // on the page. If this throws, we just don't get sound — better
    // than crashing the call flow.
    let ctx
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      ctx = new AudioContext()
      audioCtxRef.current = ctx
    } catch (e) {
      return
    }

    stoppedRef.current = false

    function playRingBurst() {
      if (stoppedRef.current || !audioCtxRef.current) return
      const now = ctx.currentTime

      // Two oscillators for the classic dual-tone ring sound.
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.frequency.value = 440
      osc2.frequency.value = 480
      osc1.type = 'sine'
      osc2.type = 'sine'

      // Quick fade in/out to avoid audible clicks at start/end.
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05)
      gain.gain.setValueAtTime(0.15, now + 1.9)
      gain.gain.linearRampToValueAtTime(0, now + 2.0)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 2.0)
      osc2.stop(now + 2.0)
    }

    function scheduleNextBurst() {
      if (stoppedRef.current) return
      playRingBurst()
      // 2s ring + 4s silence = 6s cadence, matching a typical phone ring
      const t = setTimeout(scheduleNextBurst, 6000)
      timeoutsRef.current.push(t)
    }

    scheduleNextBurst()

    return stopRing
  }, [isRinging])
}
