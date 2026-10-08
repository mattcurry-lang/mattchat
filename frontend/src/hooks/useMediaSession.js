import { useEffect, useRef } from 'react'

const supported = typeof navigator !== 'undefined' && 'mediaSession' in navigator
const ACTIONS = ['play', 'pause', 'stop', 'previoustrack', 'nexttrack', 'seekto']

// Feeds the phone's lock screen and notification, the desktop media overlay and the keyboard media keys
export function useMediaSession({ track, isPlaying, currentTime, duration, onPlay, onPause, onNext, onPrevious, onSeekTo, onStop }) {
  const handlers = useRef({})
  handlers.current = { onPlay, onPause, onNext, onPrevious, onSeekTo, onStop }
  const time = useRef(0)
  time.current = currentTime

  // what the notification / lock screen shows
  useEffect(() => {
    if (!supported) return
    if (!track) { navigator.mediaSession.metadata = null; return }
    const sizes = ['96x96', '128x128', '192x192', '256x256', '384x384', '512x512']
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || 'Unknown title',
      artist: track.artist || '',
      album: track.album || 'Mattchat',
      artwork: track.artwork ? sizes.map((s) => ({ src: track.artwork, sizes: s })) : [],
    })
  }, [track?.id, track?.title, track?.artist, track?.album, track?.artwork]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!supported) return
    navigator.mediaSession.playbackState = !track ? 'none' : isPlaying ? 'playing' : 'paused'
  }, [track, isPlaying])

  // the buttons: pause/play, next, previous, seek bar
  useEffect(() => {
    if (!supported) return undefined
    const set = (action, fn) => { try { navigator.mediaSession.setActionHandler(action, fn) } catch { /* not supported on this browser */ } }
    set('play', () => handlers.current.onPlay())
    set('pause', () => handlers.current.onPause())
    set('stop', () => handlers.current.onStop())
    set('previoustrack', () => handlers.current.onPrevious())
    set('nexttrack', () => handlers.current.onNext())
    set('seekto', (d) => { if (typeof d.seekTime === 'number') handlers.current.onSeekTo(d.seekTime) })
    return () => ACTIONS.forEach((a) => set(a, null))
  }, [])

  // progress bar on the lock screen / overlay
  useEffect(() => {
    if (!supported || !('setPositionState' in navigator.mediaSession)) return
    if (!track || !Number.isFinite(duration) || duration <= 0) return
    try {
      navigator.mediaSession.setPositionState({ duration, playbackRate: 1, position: Math.min(Math.max(time.current, 0), duration) })
    } catch { /* ignore invalid positions */ }
  }, [track, duration, isPlaying, Math.floor(currentTime / 3)]) // eslint-disable-line react-hooks/exhaustive-deps
}
