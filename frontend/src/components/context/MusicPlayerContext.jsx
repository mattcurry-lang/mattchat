import React, { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { MusicService } from '../../lib/music/MusicService'
import { YouTubeEngine } from '../../lib/music/YouTubeEngine'

const MusicPlayerContext = createContext(null)

const LIKES_KEY = 'mattchat:music:likedTracks'
const RECENTLY_PLAYED_KEY = 'mattchat:music:recentlyPlayed'
const RECENTLY_PLAYED_LIMIT = 50

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext)
  if (!ctx) throw new Error('useMusicPlayer must be used within a MusicPlayerProvider')
  return ctx
}

function readJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export function MusicPlayerProvider({ children, session = null }) {
  const userId = session?.user?.id || null
  const audioRef = useRef(null)
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.preload = 'metadata'
  }

  const [queue, setQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(-1)
  const [shuffle, setShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState('off')
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

  const stateRef = useRef({})
  stateRef.current = { queue, queueIndex, shuffle, repeatMode, volume, currentTrack }

  const recordRecentlyPlayed = useCallback((track) => {
    setRecentlyPlayed((prev) => {
      const next = [{ ...track, playedAt: Date.now() }, ...prev.filter((t) => t.id !== track.id)].slice(0, RECENTLY_PLAYED_LIMIT)
      writeJSON(RECENTLY_PLAYED_KEY, next)
      return next
    })
  }, [])

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

  // ── the branch point: everything else in the app just calls
  // loadAndPlay/togglePlayPause/etc — this is the only place that
  // knows a YouTube track needs a different engine than <audio> ──
  const loadAndPlay = useCallback(async (track, index) => {
    if (!track) return
    setError(null)
    setIsLoading(true)
    setQueueIndex(index)
    setIsMiniPlayerVisible(true)

    const audio = audioRef.current

    if (track.provider === 'youtube') {
      audio?.pause()
      try {
        await YouTubeEngine.load(track.providerTrackId)
        await YouTubeEngine.setVolume(stateRef.current.volume)
        await YouTubeEngine.play()
        recordRecentlyPlayed(track)
      } catch {
        setIsLoading(false)
        setError('Track unavailable')
        setIsPlaying(false)
      }
      return
    }

    // non-YouTube: stop the YouTube engine if it was mid-playback,
    // then fall back to the normal <audio> element flow
    YouTubeEngine.stop()
    try {
      const url = await MusicService.resolveStreamUrl(track)
      if (!url) { setIsLoading(false); setError('Track unavailable'); setIsPlaying(false); return }
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

  const playNext = useCallback(() => {
    const idx = computeNextIndex()
    if (idx === -1) { setIsPlaying(false); return }
    loadAndPlay(stateRef.current.queue[idx], idx)
  }, [computeNextIndex, loadAndPlay])

  const playPrevious = useCallback(() => {
    const { queue: q, queueIndex: i, repeatMode: rm, currentTrack: ct } = stateRef.current
    if (q.length === 0) return
    if (ct?.provider !== 'youtube' && audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      return
    }
    const idx = i - 1 >= 0 ? i - 1 : (rm === 'all' ? q.length - 1 : 0)
    loadAndPlay(q[idx], idx)
  }, [loadAndPlay])

  // <audio> element events (Audius/Mattchat tracks)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => { if (stateRef.current.currentTrack?.provider !== 'youtube') setCurrentTime(audio.currentTime) }
    const onLoadedMetadata = () => setDuration(audio.duration || 0)
    const onWaiting = () => setIsLoading(true)
    const onCanPlay = () => setIsLoading(false)
    const onPlay = () => { if (stateRef.current.currentTrack?.provider !== 'youtube') setIsPlaying(true) }
    const onPause = () => { if (stateRef.current.currentTrack?.provider !== 'youtube') setIsPlaying(false) }
    const onEnded = () => {
      if (stateRef.current.repeatMode === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return }
      playNext()
    }
    const onError = () => { setIsLoading(false); setIsPlaying(false); setError('Track unavailable') }

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

  // YouTube engine events — same job as the <audio> listeners above,
  // just fed by polling since the IFrame API has no timeupdate event
useEffect(() => {
  YouTubeEngine.setListeners({
    onTimeUpdate: (t, d) => {
      if (stateRef.current.currentTrack?.provider !== 'youtube') return
      setCurrentTime(t || 0)
      setDuration(d || 0)
      setIsLoading(false)
    },
    onStateChange: (ytState) => {
      if (stateRef.current.currentTrack?.provider !== 'youtube') return
      if (ytState === 1) { setIsPlaying(true); setIsLoading(false) }
      if (ytState === 2) setIsPlaying(false)
      if (ytState === 3) setIsLoading(true)
    },
    onPlaybackError: (code) => {
      if (stateRef.current.currentTrack?.provider !== 'youtube') return
      setIsLoading(false)
      setIsPlaying(false)
      if (code === 101 || code === 150) {
        setError('This track can't be played here — the owner disabled embedding')
      } else if (code === 100) {
        setError('Video no longer available')
      } else {
        setError('Track unavailable')
      }
    },
    onEnded: () => {
      if (stateRef.current.currentTrack?.provider !== 'youtube') return
      if (stateRef.current.repeatMode === 'one') { YouTubeEngine.seekTo(0); YouTubeEngine.play(); return }
      playNext()
    },
  })
}, [playNext])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
    if (currentTrack?.provider === 'youtube') YouTubeEngine.setVolume(volume)
  }, [volume, currentTrack?.provider])

  const playTrack = useCallback((track, contextTracks = null) => {
    const newQueue = contextTracks && contextTracks.length ? contextTracks : [track]
    const idx = newQueue.findIndex((t) => t.id === track.id)
    setQueue(newQueue)
    loadAndPlay(track, idx === -1 ? 0 : idx)
  }, [loadAndPlay])

  const togglePlayPause = useCallback(() => {
    if (!currentTrack) return
    if (currentTrack.provider === 'youtube') {
      if (isPlaying) YouTubeEngine.pause()
      else YouTubeEngine.play()
      return
    }
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.pause()
    else audio.play().catch(() => setError('Playback failed'))
  }, [isPlaying, currentTrack])

  const seekTo = useCallback((seconds) => {
    if (currentTrack?.provider === 'youtube') { YouTubeEngine.seekTo(seconds); setCurrentTime(seconds); return }
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds
    setCurrentTime(seconds)
  }, [currentTrack])

  const setVolume = useCallback((v) => setVolumeState(Math.max(0, Math.min(1, v))), [])

  const closeMiniPlayer = useCallback(() => {
    const audio = audioRef.current
    if (audio) { audio.pause(); audio.src = '' }
    YouTubeEngine.stop()
    setIsPlaying(false)
    setQueue([])
    setQueueIndex(-1)
    setIsMiniPlayerVisible(false)
  }, [])

  const addToQueue = useCallback((track) => setQueue((q) => [...q, track]), [])
  const removeFromQueue = useCallback((trackId) => {
    setQueue((q) => {
      const removeAt = q.findIndex((t) => t.id === trackId)
      if (removeAt === -1) return q
      const next = q.filter((t) => t.id !== trackId)
      setQueueIndex((i) => (removeAt < i ? i - 1 : removeAt === i ? Math.min(i, next.length - 1) : i))
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
  const cycleRepeat = useCallback(() => setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off')), [])

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
  const likedTracks = useMemo(() => Object.values(likedTracksMap).sort((a, b) => b.likedAt - a.likedAt), [likedTracksMap])

  const value = {
    userId,
    currentTrack, isPlaying, isLoading, error, currentTime, duration, volume,
    isMiniPlayerVisible, isFullPlayerVisible, setIsFullPlayerVisible, playTrack, togglePlayPause, seekTo, setVolume, closeMiniPlayer,
    playNext, playPrevious,
    queue, queueIndex, shuffle, repeatMode, isQueueVisible, setIsQueueVisible,
    addToQueue, removeFromQueue, playFromQueue, clearQueue, toggleShuffle, cycleRepeat,
    isLiked, toggleLike, likedTracks,
    recentlyPlayed,
  }

  return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>
}
