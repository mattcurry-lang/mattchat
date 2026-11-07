import { useEffect, useRef, useState } from 'react'
import { useMusicPlayer } from '../components/context/MusicPlayerContext'
import {
  loadHistoryLocal, loadLastPlayed, loadMixesLocal, saveLastPlayed,
  recordPlay, fetchHistory, buildDailyMixes,
} from '../lib/music/ListeningHistory'

// Mount ONCE in ChatPage so plays are recorded even when the music overlay is closed.
// Mount ONCE in ChatPage so plays are recorded even when the music overlay is closed.
// A play counts after 30 seconds of ACTUAL listening (about half the song if it is under a minute).
// Seeking ahead, scrubbing or sitting paused never adds to the total.
export function useRecordPlays(userId) {
  const { currentTrack, currentTime, duration, isPlaying, playbackRate } = useMusicPlayer()
  const recorded = useRef(null)
  const listened = useRef(0)     // seconds really played on this song
  const lastTick = useRef(null)  // { t: song position, wall: Date.now(), playing }

  useEffect(() => {
    recorded.current = null
    listened.current = 0
    lastTick.current = null
    if (currentTrack) saveLastPlayed(userId, currentTrack)   // survives reloads
  }, [currentTrack?.id, userId])

  useEffect(() => {
    if (!currentTrack) return
    const now = Date.now()
    const prev = lastTick.current
    lastTick.current = { t: currentTime, wall: now, playing: isPlaying }
    if (!isPlaying || !prev || !prev.playing) return

    // Real listening: the song moved forward about as fast as the clock did.
    const moved = currentTime - prev.t
    const clock = (now - prev.wall) / 1000
    if (moved > 0 && moved <= clock * (playbackRate || 1) + 1.5) listened.current += moved

    const need = duration > 0 && duration < 60 ? Math.max(10, duration / 2) : 30
    if (recorded.current !== currentTrack.id && listened.current >= need) {
      recorded.current = currentTrack.id
      recordPlay(userId, currentTrack)
    }
  }, [currentTime, isPlaying, currentTrack, userId, duration, playbackRate])
}
// Used inside the music overlay.
export function useListeningHistory(userId) {
  const [history, setHistory] = useState(() => loadHistoryLocal(userId))
  const [mixes, setMixes] = useState(() => loadMixesLocal(userId)?.mixes || [])
  const lastPlayed = loadLastPlayed(userId) || history[0]?.track || null

  useEffect(() => {
    if (!userId) return
    fetchHistory(userId).then(setHistory).catch(() => {})
  }, [userId])

  useEffect(() => {
    if (!userId || history.length < 3) return
    buildDailyMixes(userId, history).then(setMixes).catch(() => {})
  }, [userId, history.length])

  return { history, mixes, lastPlayed }
}
