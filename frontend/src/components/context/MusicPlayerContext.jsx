import React, { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { MusicService } from '../../lib/music/MusicService'
import { YouTubeEngine } from '../../lib/music/YouTubeEngine'
import { OfflineCache } from '../../lib/music/OfflineCache'
import { isOnlineNow } from '../../lib/connectivity'         
import { useMediaSession } from '../../hooks/useMediaSession'
import { AutoCache } from '../../lib/music/AutoCache'
import { RadioEngine } from '../../lib/music/RadioEngine'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

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
    const [isMusicHubOpen, setIsMusicHubOpen] = useState(false)
  // Speed belongs to ONE song: it is not remembered, and every new song starts at 1x (see loadAndPlay)
  const [playbackRate, setPlaybackRateState] = useState(1)
  // null | { mode: 'time', endsAt } | { mode: 'track' }
  const [sleepTimer, setSleepTimerState] = useState(null)
  const [autoCacheEnabled, setAutoCacheEnabledState] = useState(() => AutoCache.isEnabled())

  const [likedTracksMap, setLikedTracksMap] = useState(() => readJSON(LIKES_KEY, {}))
  const [recentlyPlayed, setRecentlyPlayed] = useState(() => readJSON(RECENTLY_PLAYED_KEY, []))

  const currentTrack = queueIndex >= 0 && queueIndex < queue.length ? queue[queueIndex] : null

  const online = useOnlineStatus()
  // null | { seed, filling } - a "song radio" is running: similar songs keep getting added behind what's playing
  const [radio, setRadio] = useState(null)

  const stateRef = useRef({})
  stateRef.current = { queue, queueIndex, shuffle, repeatMode, volume, currentTrack, playbackRate, currentTime, recentlyPlayed, likedTracksMap, radio }
  const loadedTrackIdRef = useRef(null)   // which song was last loaded, so a NEW song resets the speed
  const loadTokenRef = useRef(0)          // lets a slow lookup notice the listener has already moved on
  const radioEpochRef = useRef(0)         // bumped whenever a radio is replaced/stopped, to drop stale refills
  const fillPromiseRef = useRef(null)
  const fillAttemptRef = useRef('')
  const loadAndPlayRef = useRef(null)
  const blobUrlRef = useRef(null)

  // ── sleep timer ──
  const sleepRef = useRef(null)
  sleepRef.current = sleepTimer
  const pauseAll = useCallback(() => {
    audioRef.current?.pause()
    if (stateRef.current.currentTrack?.provider === 'youtube') YouTubeEngine.pause()
    setIsPlaying(false)
  }, [])
  // called when a track ends on its own; true = "stop here, sleep timer was set to end of track"
  const consumeSleepEnd = useCallback(() => {
    if (sleepRef.current?.mode !== 'track') return false
    setSleepTimerState(null)
    pauseAll()
    return true
  }, [pauseAll])
  const setSleepTimer = useCallback((opt) => {
    if (opt == null) setSleepTimerState(null)
    else if (opt === 'track') setSleepTimerState({ mode: 'track' })
    else setSleepTimerState({ mode: 'time', endsAt: Date.now() + opt * 60000 })
  }, [])
  useEffect(() => {
    if (sleepTimer?.mode !== 'time') return undefined
    const id = setTimeout(() => { setSleepTimerState(null); pauseAll() }, Math.max(0, sleepTimer.endsAt - Date.now()))
    return () => clearTimeout(id)
  }, [sleepTimer, pauseAll])

  // ── playback speed ──
  const setPlaybackRate = useCallback((r) => setPlaybackRateState(r), [])
  const setAutoCacheEnabled = useCallback((on) => { AutoCache.setEnabled(on); setAutoCacheEnabledState(on) }, [])
const pendingRestoreRef = useRef(false)
const resumeAtRef = useRef(0)
const POS_KEY = 'mattchat:music:position'
  // Bring back the last track (paused) so the player isn't empty after a reload
useEffect(() => {
  if (!userId) return
  const last = readJSON(`mattchat:music:last:${userId}`, null)
  if (!last || stateRef.current.queue.length) return
  const rest = recentlyPlayed.filter((t) => t.id !== last.id).slice(0, 20)
  setQueue([last, ...rest])
  setQueueIndex(0)
  pendingRestoreRef.current = true
  const pos = readJSON(POS_KEY, null)
  resumeAtRef.current = pos && pos.id === last.id ? pos.t : 0
  setCurrentTime(resumeAtRef.current)
}, [userId])  

// Remember playback position every ~5s
useEffect(() => {
  if (currentTrack && isPlaying) writeJSON(POS_KEY, { id: currentTrack.id, t: currentTime })
}, [Math.floor(currentTime / 5)]) 
const sessionPlayedRef = useRef(new Set())

const recordRecentlyPlayed = useCallback((track) => {
  sessionPlayedRef.current.add(track.id)
  RadioEngine.markPlayed(track)
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
  const loadAndPlay = useCallback(async (inputTrack, index, origin = 'auto') => {
    let track = inputTrack
    if (!track) return
    pendingRestoreRef.current = false
    setError(null)
    setIsLoading(true)
    setQueueIndex(index)
    setIsMiniPlayerVisible(true)
    const token = ++loadTokenRef.current

    // A radio suggestion is only a name until it is about to play: find its playable copy now.
    if (RadioEngine.isPending(track)) {
      const pendingId = track.id
      const real = await RadioEngine.resolve(track).catch(() => null)
      if (token !== loadTokenRef.current) return                 // the listener already moved on
      if (!real) {
        // couldn't find this one: drop it and carry on with whatever slid into its place
        const rest = stateRef.current.queue.filter((t) => t.id !== pendingId)
        stateRef.current.queue = rest
        setQueue(rest)
        if (rest[index]) { loadAndPlayRef.current(rest[index], index, origin); return }
        setQueueIndex(Math.min(index, rest.length - 1))
        setIsLoading(false)
        setIsPlaying(false)
        setError(isOnlineNow() ? "Couldn't find that song" : "You're offline. This song needs internet.")
        return
      }
      const swap = (list) => list.map((t) => (t.id === pendingId ? real : t))
      stateRef.current.queue = swap(stateRef.current.queue)
      setQueue(swap)
      track = real
    }

    // A new song always starts at normal speed - changing the speed on one song must not follow you to the next
    if (loadedTrackIdRef.current !== track.id) {
      loadedTrackIdRef.current = track.id
      stateRef.current.playbackRate = 1
      setPlaybackRateState(1)
    }

    const audio = audioRef.current
if (!isOnlineNow()) {
  const cached = await OfflineCache.isDownloaded(track.id).catch(() => false)
  if (!cached) { setIsLoading(false); setError("You're offline. This song needs internet."); return }
}
    if (track.provider === 'youtube') {
      audio?.pause()
      try {
        await YouTubeEngine.load(track.providerTrackId)
        await YouTubeEngine.setVolume(stateRef.current.volume)
        await YouTubeEngine.setRate(stateRef.current.playbackRate)
        await YouTubeEngine.play()
        if (resumeAtRef.current > 1) { YouTubeEngine.seekTo(resumeAtRef.current); resumeAtRef.current = 0 }
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
  if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
  // downloaded copy first, so offline playback works with no network
  let url = await OfflineCache.getBlobUrl(track.id).catch(() => null)
  if (url) blobUrlRef.current = url
  else url = await MusicService.resolveStreamUrl(track)

  if (!url) { setIsLoading(false); setError('Track unavailable'); setIsPlaying(false); return }
  audio.src = url
  audio.volume = stateRef.current.volume
  audio.defaultPlaybackRate = stateRef.current.playbackRate
  audio.playbackRate = stateRef.current.playbackRate
  const resumeAt = resumeAtRef.current
  resumeAtRef.current = 0
  if (resumeAt > 1) audio.addEventListener('loadedmetadata', () => { audio.currentTime = resumeAt }, { once: true })
  await audio.play()
  recordRecentlyPlayed(track)
    AutoCache.noteHeard(track, origin).catch(() => {})
  } catch {
    setIsLoading(false)
    setError('Track unavailable')
    setIsPlaying(false)
  }
}, [recordRecentlyPlayed])
loadAndPlayRef.current = loadAndPlay

const [isAutoContinuing, setIsAutoContinuing] = useState(false)

// Next song we can actually play. Online that is simply queue order; offline we hop over
// songs that aren't saved in Mattchat instead of stopping on "needs internet".
const nextPlayableIndex = useCallback(async () => {
  if (isOnlineNow()) return computeNextIndex()
  const { queue: q, queueIndex: i, shuffle: sh, repeatMode: rm } = stateRef.current
  if (q.length === 0) return -1
  const ok = await Promise.all(q.map((t) => (RadioEngine.isPending(t) ? false : OfflineCache.isDownloaded(t.id).catch(() => false))))
  if (sh) {
    const pool = ok.map((v, k) => (v && k !== i ? k : -1)).filter((k) => k !== -1)
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : -1
  }
  for (let k = i + 1; k < q.length; k++) if (ok[k]) return k
  if (rm === 'all') for (let k = 0; k <= i; k++) if (ok[k]) return k
  return -1
}, [computeNextIndex])

// add songs to the end of the queue (the ref is updated at once so back-to-back calls see them)
const appendToQueue = useCallback((batch) => {
  const have = new Set(stateRef.current.queue.map((t) => t.id))
  const fresh = batch.filter((t) => !have.has(t.id))
  if (!fresh.length) return []
  stateRef.current.queue = [...stateRef.current.queue, ...fresh]
  setQueue((q) => { const h = new Set(q.map((t) => t.id)); return [...q, ...fresh.filter((t) => !h.has(t.id))] })
  return fresh
}, [])

// Songs similar to what is playing now (and to the song the station started from), never repeating this session.
// Offline, RadioEngine builds it from the songs saved in Mattchat.
const buildRadioBatch = useCallback(async () => {
  const { currentTrack: cur, queue: q, recentlyPlayed: rp, likedTracksMap: lm, radio: r } = stateRef.current
  const anchor = r?.seed
  const seeds = [cur && !RadioEngine.isPending(cur) ? cur : null, anchor && anchor.id !== cur?.id ? anchor : null].filter(Boolean)
  if (!seeds.length && cur) seeds.push(cur)
  return RadioEngine.build({
    seeds,
    excludeIds: new Set([...sessionPlayedRef.current, ...q.map((t) => t.id)]),
    excludeTracks: q,
    library: rp.slice(0, 30),
    liked: Object.values(lm).slice(0, 40),
    online: isOnlineNow(),
    lastArtist: q[q.length - 1]?.artist || cur?.artist || '',
  })
}, [])

const fillRadio = useCallback(() => {
  if (fillPromiseRef.current) return fillPromiseRef.current
  const epoch = radioEpochRef.current
  setRadio((r) => (r ? { ...r, filling: true } : r))
  const p = (async () => {
    try {
      const batch = await buildRadioBatch()
      if (epoch !== radioEpochRef.current) return 0          // the station changed while we were looking
      return appendToQueue(batch).length
    } catch {
      return 0
    } finally {
      fillPromiseRef.current = null
      setRadio((r) => (r ? { ...r, filling: false } : r))
    }
  })()
  fillPromiseRef.current = p
  return p
}, [buildRadioBatch, appendToQueue])

// Go to the next song. When the queue is used up, the radio takes over instead of stopping.
const advance = useCallback(async () => {
  let idx = await nextPlayableIndex()
  if (idx === -1 && fillPromiseRef.current) {              // a refill is already on its way: wait for it
    await fillPromiseRef.current.catch(() => {})
    idx = await nextPlayableIndex()
  }
  if (idx !== -1) {
    loadAndPlay(stateRef.current.queue[idx], idx)
    return
  }

  const lastTrack = stateRef.current.currentTrack
  if (!lastTrack) { setIsPlaying(false); return }

  setIsAutoContinuing(true)
  try {
    const startIndex = stateRef.current.queue.length
    const added = appendToQueue(await buildRadioBatch())
    if (added.length === 0) {
      setIsPlaying(false)
      if (!isOnlineNow()) setError("You're offline. That's all your saved songs.")
      return
    }
    loadAndPlay(added[0], startIndex)
  } catch {
    setIsPlaying(false)
  } finally {
    setIsAutoContinuing(false)
  }
}, [nextPlayableIndex, buildRadioBatch, appendToQueue, loadAndPlay])

// What the Next button / media keys do. Leaving a song in its first 30s counts as a skip,
// and the radio learns from it (that artist drops down the list for a few days).
const playNext = useCallback(() => {
  const { currentTrack: ct, currentTime: t } = stateRef.current
  if (ct && !RadioEngine.isPending(ct)) RadioEngine.noteSkip(ct, t)
  advance()
}, [advance])

// What happens when a song finishes by itself
const onTrackEnded = useCallback(() => {
  const ct = stateRef.current.currentTrack
  if (ct) RadioEngine.noteFinish(ct)
  advance()
}, [advance])

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
      if (consumeSleepEnd()) return
      if (stateRef.current.repeatMode === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return }
      onTrackEnded()
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
  }, [onTrackEnded, consumeSleepEnd])

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
       setError("This track can't be played here — the owner disabled embedding")
      } else if (code === 100) {
        setError('Video no longer available')
      } else {
        setError('Track unavailable')
      }
    },
    onEnded: () => {
      if (stateRef.current.currentTrack?.provider !== 'youtube') return
      if (consumeSleepEnd()) return
      if (stateRef.current.repeatMode === 'one') { YouTubeEngine.seekTo(0); YouTubeEngine.play(); return }
      onTrackEnded()
    },
  })
}, [onTrackEnded, consumeSleepEnd])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
    if (currentTrack?.provider === 'youtube') YouTubeEngine.setVolume(volume)
  }, [volume, currentTrack?.provider])

  useEffect(() => {
    const a = audioRef.current
    if (a) { a.defaultPlaybackRate = playbackRate; a.playbackRate = playbackRate }
    if (currentTrack?.provider === 'youtube') YouTubeEngine.setRate(playbackRate)
  }, [playbackRate, currentTrack?.id, currentTrack?.provider])

  // playTrack(song)                 -> song radio: that song, then songs LIKE it (what Spotify does from search)
  // playTrack(song, listOfSongs)    -> plays that list in order (playlist, album, liked songs...); the radio takes over when it ends
  // playTrack(song, null, {radio:false}) -> just that one song
  const playTrack = useCallback((track, contextTracks = null, opts = {}) => {
    const hasContext = Array.isArray(contextTracks) && contextTracks.length > 1
    const newQueue = hasContext ? contextTracks : [track]
    const idx = newQueue.findIndex((t) => t.id === track.id)
    radioEpochRef.current += 1                       // any refill for the previous station is now stale
    fillAttemptRef.current = ''
    stateRef.current.queue = newQueue
    setQueue(newQueue)
    setRadio(!hasContext && opts.radio !== false ? { seed: track, filling: false } : null)
    loadAndPlay(track, idx === -1 ? 0 : idx, opts.origin)
  }, [loadAndPlay])

  // Keep the radio topped up: whenever fewer than 3 songs are lined up behind the current one, add more.
  useEffect(() => {
    if (!radio || radio.filling || !currentTrack || RadioEngine.isPending(currentTrack)) return
    if (queue.length - queueIndex - 1 >= 3) return
    const key = `${currentTrack.id}:${queue.length}:${online}`
    if (fillAttemptRef.current === key) return        // already tried for this exact situation
    fillAttemptRef.current = key
    fillRadio()
  }, [radio, currentTrack?.id, queue.length, queueIndex, online, fillRadio])

  // While a song plays, get the next suggestion ready so skipping is instant (and costs one lookup at most)
  const nextId = queue[queueIndex + 1]?.id
  useEffect(() => {
    const next = stateRef.current.queue[stateRef.current.queueIndex + 1]
    if (!next || !RadioEngine.isPending(next) || !online) return undefined
    let cancelled = false
    const timer = setTimeout(() => {
      RadioEngine.resolve(next).then((real) => {
        if (cancelled || !real) return
        const swap = (list) => list.map((t) => (t.id === next.id ? real : t))
        stateRef.current.queue = swap(stateRef.current.queue)
        setQueue(swap)
      }).catch(() => {})
    }, 4000)                                           // let the current song start first
    return () => { cancelled = true; clearTimeout(timer) }
  }, [nextId, queueIndex, online])

  const togglePlayPause = useCallback(() => {
    if (!currentTrack || currentTrack.pending) return   // still finding a playable copy
    if (pendingRestoreRef.current) { loadAndPlay(currentTrack, queueIndex); return }
    if (currentTrack.provider === 'youtube') {
      if (isPlaying) YouTubeEngine.pause()
      else YouTubeEngine.play()
      return
    }
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.pause()
    else audio.play().catch(() => setError('Playback failed'))
  }, [isPlaying, currentTrack, queueIndex, loadAndPlay])

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
    setSleepTimerState(null)
    setRadio(null)
    radioEpochRef.current += 1
    RadioEngine.resetSession()
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
  useMediaSession({
    track: currentTrack,
    isPlaying,
    currentTime,
    duration,
    onPlay: () => { if (!isPlaying) togglePlayPause() },
    onPause: () => { if (isPlaying) togglePlayPause() },
    onNext: playNext,
    onPrevious: playPrevious,
    onSeekTo: seekTo,
    onStop: closeMiniPlayer,
  })
 const value = {
  userId,
  currentTrack, isPlaying, isLoading, error, currentTime, duration, volume,
  isMiniPlayerVisible, isFullPlayerVisible, setIsFullPlayerVisible, playTrack, togglePlayPause, seekTo, setVolume, closeMiniPlayer,
  playNext, playPrevious, isAutoContinuing,
  queue, queueIndex, shuffle, repeatMode, isQueueVisible, setIsQueueVisible,
  addToQueue, removeFromQueue, playFromQueue, clearQueue, toggleShuffle, cycleRepeat,
  isLiked, toggleLike, likedTracks,
  recentlyPlayed,autoCacheEnabled, setAutoCacheEnabled,
   playbackRate, setPlaybackRate, sleepTimer, setSleepTimer,
  isMusicHubOpen, setIsMusicHubOpen,
  radio, isOffline: !online,
}

  return <MusicPlayerContext.Provider value={value}>{children}</MusicPlayerContext.Provider>
}
