// useRingtone.js
// Plays/loops a Mattchat call sound (by name, resolved through
// mattchatSounds' FILE_SOUNDS registry — see getSoundPath) while
// `active` is true. Stops and cleans up on false or unmount.
//
// Wraps play() in a catch — mobile browsers block autoplay until a
// user gesture unlocks audio (see unlockFileAudio in lib/mattchatSounds,
// already wired in App.jsx), so a rejected play() here is expected in
// some cases, not a bug to surface.

import { useEffect, useRef } from 'react'
import { getSoundPath } from '../lib/mattchatSounds'

export function useRingtone(active, soundName = 'ringtone', { volume = 0.85 } = {}) {
  const audioRef = useRef(null)

  useEffect(() => {
    if (!active) return

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
