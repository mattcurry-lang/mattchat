// useRingtone.js
// 'ringtone' (incoming call) plays the custom branded file via
// FILE_SOUNDS/getSoundPath, looped through an <audio> element.
// 'ringback' (outgoing call) uses the synthesized standard dual-tone
// ringback from mattchatSounds instead — see startRingback/stopRingback.
// Both stop cleanly on active=false or unmount.

import { useEffect, useRef } from 'react'
import { getSoundPath, startRingback, stopRingback } from '../lib/mattchatSounds'

export function useRingtone(active, soundName = 'ringtone', { volume = 0.85 } = {}) {
  const audioRef = useRef(null)

  useEffect(() => {
    if (!active) return

    if (soundName === 'ringback') {
      startRingback()
      return () => stopRingback()
    }

    const path = getSoundPath(soundName)
    if (!path) {
      console.warn(`[useRingtone] no sound registered for "${soundName}" in mattchatSounds.FILE_SOUNDS`)
      return
    }

    const audio = new Audio(path)
    audio.loop = true
    audio.volume = volume
    audioRef.current = audio

    audio.play().catch((err) => {
      console.warn('[useRingtone] autoplay blocked until user gesture:', err)
    })

    return () => {
      audio.pause()
      audio.currentTime = 0
      audioRef.current = null
    }
  }, [active, soundName, volume])
}
