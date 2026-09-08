import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'
import MusicService from '../../lib/music/MusicService'

/**
 * context/MusicPlayerContext.jsx
 *
 * Mount <MusicPlayerProvider> ONCE, near the app root (same level as
 * your other top-level providers) — NOT inside PulsePage. That's
 * what makes playback survive Pulse → Chat → anywhere navigation:
 * the <audio> element and this context never unmount.
 *
 * Phase 1 scope: play/pause/seek/volume/next-track-on-end, a simple
 * "next up" queue of one item (whatever was playing before). Full
 * multi-track queue management is Phase 2.
 */

const MusicPlayerContext = createContext(null)

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext)
  if (!ctx) throw new Error('useMusicPlayer must be used within a MusicPlayerProvider')
  return ctx
}

export function MusicPlayerProvider({ children }) {
  const audioRef = useRef(null)
  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.preload = 'metadata'
  }

  const [currentTrack, setCurrentTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.85)
  const [isMiniPlayerVisible, setIsMiniPlayerVisible] = useState(false)

  // Wire the single <audio> element's events once.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration || 0)
    const onWaiting = () => setIsLoading(true)
    const onCanPlay = () => setIsLoading(false)
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      // Phase 1: no queue-advance yet — Phase 2 wires this to "play next in queue"
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
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const playTrack = useCallback(async (track) => {
    const audio = audioRef.current
    if (!audio || !track) return

    setError(null)
    setIsLoading(true)
    setCurrentTrack(track)
    setIsMiniPlayerVisible(true)

    const url = await MusicService.resolveStreamUrl(track)
    if (!url) {
      setIsLoading(false)
      setError('Track unavailable')
      return
    }

    audio.src = url
    try {
      await audio.play()
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
      setError('Playback failed — tap play to try again')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setError('Playback failed'))
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
    setCurrentTrack(null)
    setIsMiniPlayerVisible(false)
  }, [])

  const value = {
    currentTrack,
    isPlaying,
    isLoading,
    error,
    currentTime,
    duration,
    volume,
    isMiniPlayerVisible,
    playTrack,
    togglePlayPause,
    seekTo,
    setVolume,
    closeMiniPlayer,
  }

  return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>
}
