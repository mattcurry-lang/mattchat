import { useEffect, useRef, useState } from 'react'
import { useMusicPlayer } from '../components/context/MusicPlayerContext'
import {
  loadHistoryLocal, loadLastPlayed, loadMixesLocal, saveLastPlayed,
  recordPlay, fetchHistory, buildDailyMixes,
} from '../lib/music/ListeningHistory'

// Mount ONCE in ChatPage so plays are recorded even when the music overlay is closed.
export function useRecordPlays(userId) {
  const { currentTrack, currentTime, isPlaying } = useMusicPlayer()
  const recorded = useRef(null)

  useEffect(() => {
    recorded.current = null
    if (currentTrack) saveLastPlayed(userId, currentTrack)   // survives reloads
  }, [currentTrack?.id, userId])

  useEffect(() => {
    if (isPlaying && currentTrack && currentTime >= 30 && recorded.current !== currentTrack.id) {
      recorded.current = currentTrack.id
      recordPlay(userId, currentTrack)
    }
  }, [currentTime, isPlaying, currentTrack, userId])
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
