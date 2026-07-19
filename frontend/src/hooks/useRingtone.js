import { useEffect, useRef } from 'react'

// mode='ringback' — what the CALLER hears while the other person's phone
// is ringing. Synthesized dual-tone (440Hz+480Hz), 2s on / 4s off,
// same as a classic US ringback tone. Unchanged.
//
// mode='ringtone' — what the RECEIVER hears for an incoming call.
// Plays the real Mattchat ringtone (public/sounds/ringtone.wav), which
// is already a seamless 4-second loop, so looping it just works.
//
// Usage: useRingtone(isRinging, mode) — stops automatically when
// isRinging goes false, or when the component unmounts.
export function useRingtone(isRinging, mode = 'ringback') {
  const audioCtxRef = useRef(null)
  const timeoutsRef = useRef([])
  const stoppedRef = useRef(true)
  const ringtoneElRef = useRef(null)

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
      if (ringtoneElRef.current) {
        ringtoneElRef.current.pause()
        ringtoneElRef.current.currentTime = 0
        ringtoneElRef.current = null
      }
    }

    if (!isRinging) {
      stopRing()
      return
    }

    stoppedRef.current = false

    // --- Receiver: play the real ringtone file, looped ---
    if (mode === 'ringtone') {
      const el = new Audio('/sounds/ringtone.wav')
      el.loop = true
      el.volume = 0.85
      ringtoneElRef.current = el
      el.play().catch(() => {
        console.warn('Mattchat: ringtone playback blocked — page needs a user gesture to unlock audio first.')
      })
      return stopRing
    }

    // --- Caller: synthesized dual-tone ringback (unchanged) ---
    let ctx
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      ctx = new AudioContext()
      audioCtxRef.current = ctx
    } catch (e) {
      return
    }

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

    ringbackBurst()
    return stopRing
  }, [isRinging, mode])
}
