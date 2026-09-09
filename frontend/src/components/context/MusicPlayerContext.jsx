import React, { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { MusicService } from '../../lib/music/MusicService'

/**
 * context/MusicPlayerContext.jsx
 *
 * PHASE 2 UPDATE — additive on top of the Phase 1 context:
 *   - real queue (array + index) instead of a single currentTrack
 *   - onEnded now auto-advances instead of just stopping
 *   - shuffle / repeat
 *   - likes (localStorage-backed for now — swap for Supabase in the
 *     DB pass without changing the public API below)
 *   - recently played (localStorage-backed, same reasoning)
 *
 * playTrack(track) still works exactly like Phase 1 — a bare call
 * plays just that track. Existing call sites in MusicSearch.jsx and
 * PulseMusicCard.jsx don't need to change. New call sites (e.g. "play
 * this song, queue the rest of the search results") can pass a second
 * arg: playTrack(track, contextTracks).
 */

const MusicPlayerContext = createContext(null)

const LIKES_KEY = 'mattchat:music:likedTracks' // { [trackId]: { ...track, likedAt } }
const RECENTLY_PLAYED_KEY = 'mattchat:music:recentlyPlayed'
const RECENTLY_PLAYED_LIMIT = 50

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext)
  if (!ctx) throw new Error('useMusicPlayer must be used within a MusicPlayerProvider')
  return ctx
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full / unavailable — never let this block playback
  }
}

export function MusicPlayerProvider({ children, session = null }) {
  const userId = session?.user?.id || null
  const audioRef = useRef(null)
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.preload = 'metadata'
  }

  // ── queue state (replaces the old single `currentTrack` state) ──
  const [queue, setQueue] = useState([])        // normalized tracks
  const [queueIndex, setQueueIndex] = useState(-1)
  const [shuffle, setShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState('off') // 'off' | 'all' | 'one'
  const [isQueueVisible, setIsQueueVisible] = useState(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.85)
  const [isMiniPlayerVisible, setIsMiniPlayerVisible] = useState(false)
  const [isFullPlayerVisible, setIsFullPlayerVisible] = useState(false)

  const [likedTracksMap, setLikedTracksMap] = useState(() => readJSON(LIKES_KEY, {}))
  const [recentlyPlayed, setRecentlyPlayed] = useState(() => readJSON(RECENTLY_PLAYED_KEY, []))

  const currentTrack = queueIndex >= 0 && queueIndex < queue.length ? queue[queueIndex] : null

  // refs so the stable event handlers below always see fresh values
  // without having to be re-registered on every state change
  const stateRef = useRef({})
  stateRef.current = { queue, queueIndex, shuffle, repeatMode, volume }

  const recordRecentlyPlayed = useCallback((track) => {
    setRecentlyPlayed((prev) => {
      const next = [
        { ...track, playedAt: Date.now() },
        ...prev.filter((t) => t.id !== track.id),
      ].slice(0, RECENTLY_PLAYED_LIMIT)
      writeJSON(RECENTLY_PLAYED_KEY, next)
      return next
    })
  }, [])

  const loadAndPlay = useCallback(async (track, index) => {
    const audio = audioRef.current
    if (!audio || !track) return

    setError(null)
    setIsLoading(true)
    setQueueIndex(index)
    setIsMiniPlayerVisible(true)

    try {
      const url = await MusicService.resolveStreamUrl(track)
      if (!url) {
        setIsLoading(false)
        setError('Track unavailable')
        setIsPlaying(false)
        return
      }
      audio.src = url
      audio.volume = stateRef.current.volume
      await audio.play()
      recordRecentlyPlayed(track)
    } catch {
      setIsLoading(false)
      setError('Track unavailable')
      setIsPlaying(false)
    }
  }, [recordRecentlyPlayed])

  const computeNextIndex = useCallback(() => {
    const { queue: q, queueIndex: i, shuffle: sh, repeatMode: rm } = stateRef.current
    if (q.length === 0) return -1
    if (sh) {
      if (q.length === 1) return 0
      let idx = i
      while (idx === i) idx = Math.floor(Math.random() * q.length)
      return idx
    }
    if (i + 1 < q.length) return i + 1
    return rm === 'all' ? 0 : -1
  }, [])

  const playNext = useCallback(() => {
    const idx = computeNextIndex()
    if (idx === -1) { setIsPlaying(false); return }
    loadAndPlay(stateRef.current.queue[idx], idx)
  }, [computeNextIndex, loadAndPlay])

  const playPrevious = useCallback(() => {
    const { queue: q, queueIndex: i, repeatMode: rm } = stateRef.current
    if (q.length === 0) return
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      return
    }
    const idx = i - 1 >= 0 ? i - 1 : (rm === 'all' ? q.length - 1 : 0)
    loadAndPlay(q[idx], idx)
  }, [loadAndPlay])

  // Wire the single <audio> element's events once — handlers read
  // current state via stateRef/computeNextIndex so they never go stale.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration || 0)
    const onWaiting = () => setIsLoading(true)
    const onCanPlay = () => setIsLoading(false)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      if (stateRef.current.repeatMode === 'one') {
        audio.currentTime = 0
        audio.play().catch(() => {})
        return
      }
      playNext()
    }
    const onError = () => {
      setIsLoading(false)
      setIsPlaying(false)
      setError('Track unavailable')
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [playNext])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  /**
   * playTrack(track) — Phase 1 behavior, unchanged: plays just this track.
   * playTrack(track, contextTracks) — Phase 2: seeds the queue with
   * contextTracks (e.g. the full search-results list or an album),
   * starting playback at `track`'s position within it.
   */
  const playTrack = useCallback((track, contextTracks = null) => {
    const newQueue = contextTracks && contextTracks.length ? contextTracks : [track]
    const idx = newQueue.findIndex((t) => t.id === track.id)
    setQueue(newQueue)
    loadAndPlay(track, idx === -1 ? 0 : idx)
  }, [loadAndPlay])

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(() => setError('Playback failed'))
    }
  }, [isPlaying, currentTrack])

  const seekTo = useCallback((seconds) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds
    setCurrentTime(seconds)
  }, [])

  const setVolume = useCallback((v) => setVolumeState(Math.max(0, Math.min(1, v))), [])

  const closeMiniPlayer = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    setIsPlaying(false)
    setQueue([])
    setQueueIndex(-1)
    setIsMiniPlayerVisible(false)
  }, [])

  // ── queue management ──
  const addToQueue = useCallback((track) => {
    setQueue((q) => [...q, track])
  }, [])

  const removeFromQueue = useCallback((trackId) => {
    setQueue((q) => {
      const removeAt = q.findIndex((t) => t.id === trackId)
      if (removeAt === -1) return q
      const next = q.filter((t) => t.id !== trackId)
      // keep queueIndex pointing at the same *track* it was pointing
      // at before the removal, not the same numeric slot
      setQueueIndex((i) => {
        if (removeAt < i) return i - 1
        if (removeAt === i) return Math.min(i, next.length - 1)
        return i
      })
      return next
    })
  }, [])

  const playFromQueue = useCallback((trackId) => {
    const idx = stateRef.current.queue.findIndex((t) => t.id === trackId)
    if (idx === -1) return
    loadAndPlay(stateRef.current.queue[idx], idx)
  }, [loadAndPlay])

  const clearQueue = useCallback(() => {
    setQueue(currentTrack ? [currentTrack] : [])
    setQueueIndex(currentTrack ? 0 : -1)
  }, [currentTrack])

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), [])
  const cycleRepeat = useCallback(() => {
    setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))
  }, [])

  // ── likes ──
  const isLiked = useCallback((trackId) => Boolean(likedTracksMap[trackId]), [likedTracksMap])

  const toggleLike = useCallback((track) => {
    setLikedTracksMap((prev) => {
      const next = { ...prev }
      if (next[track.id]) delete next[track.id]
      else next[track.id] = { ...track, likedAt: Date.now() }
      writeJSON(LIKES_KEY, next)
      return next
    })
  }, [])

  // Most-recently-liked first — used by the "Liked Music" rail.
  const likedTracks = useMemo(
    () => Object.values(likedTracksMap).sort((a, b) => b.likedAt - a.likedAt),
    [likedTracksMap]
  )

  const value = {
    userId,
    // playback
    currentTrack, isPlaying, isLoading, error, currentTime, duration, volume,
    isMiniPlayerVisible, isFullPlayerVisible, setIsFullPlayerVisible, playTrack, togglePlayPause, seekTo, setVolume, closeMiniPlayer,
    playNext, playPrevious,
    // queue
    queue, queueIndex, shuffle, repeatMode, isQueueVisible, setIsQueueVisible,
    addToQueue, removeFromQueue, playFromQueue, clearQueue, toggleShuffle, cycleRepeat,
    // likes
    isLiked, toggleLike, likedTracks,
    // recently played
    recentlyPlayed,
  }

  return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>
}
