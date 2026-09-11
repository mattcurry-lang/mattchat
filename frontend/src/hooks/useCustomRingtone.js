import { useState, useEffect, useRef } from 'react'
import { RingtoneService } from '../lib/music/RingtoneService'

/**
 * hooks/useCustomRingtone.js
 *
 * Checks whether the given user has a custom Mattchat ringtone set
 * (via the Music feature's RingtonePicker). While `isRinging` is
 * true, plays it on loop through RingtoneService's independent
 * <audio> element — separate from the main music player, so it never
 * interferes with whatever the person might already be listening to.
 *
 * Returns `hasCustomRingtone` as a three-state value (undefined while
 * checking, then true/false) so the caller can decide whether to
 * fall back to the bundled default tone — avoids a moment where
 * neither tone is playing, or both play at once.
 */
export function useCustomRingtone(userId, isRinging) {
  const [hasCustomRingtone, setHasCustomRingtone] = useState(undefined)
  const trackRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    if (!userId) { setHasCustomRingtone(false); return }
    RingtoneService.getMyRingtone(userId)
      .then((track) => {
        if (cancelled) return
        trackRef.current = track
        setHasCustomRingtone(Boolean(track))
      })
      .catch(() => { if (!cancelled) setHasCustomRingtone(false) })
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    if (!isRinging || !hasCustomRingtone || !trackRef.current) return
    RingtoneService.playRingtone(trackRef.current)
    return () => RingtoneService.stopRingtone()
  }, [isRinging, hasCustomRingtone])

  return hasCustomRingtone
}
