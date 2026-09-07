useRingtone.js// useRingtone.js
// Plays/loops the Mattchat ringtone while `active` is true, stops and
// cleans up on false or unmount. Wraps play() in a catch — mobile
// browsers block autoplay until a user gesture unlocks audio (see
// unlockFileAudio in lib/mattchatSounds, already wired in App.jsx), so a
// rejected play() here is expected in some cases, not a bug to surface.

import { useEffect, useRef } from 'react'

export function useRingtone(active, { volume = 0.85 } = {}) {
  const audioRef = useRef(null)

  useEffect(() => {
    if (!active) return
    const audio = new Audio()
    audio.loop = true
    audio.volume = volume
    // ogg first (smaller, Chrome/Firefox/Android), mp3 fallback (Safari/iOS)
    const canOgg = audio.canPlayType('audio/ogg') !== ''
    audio.src = canOgg ? '/sounds/mattchat-ringtone.ogg' : '/sounds/mattchat-ringtone.mp3'
    audioRef.current = audio

    audio.play().catch((err) => {
      console.warn('[useRingtone] autoplay blocked until user gesture:', err)
    })

    return () => {
      audio.pause()
      audio.currentTime = 0
      audioRef.current = null
    }
  }, [active, volume])
}
