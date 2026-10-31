import { useEffect, useRef } from 'react'

const supported = typeof navigator !== 'undefined' && 'mediaSession' in navigator
const ACTIONS = ['play', 'pause', 'stop', 'previoustrack', 'nexttrack', 'seekto']

// YouTube plays inside an iframe, and browsers build the system media controls from media playing in the
// page itself. While a YouTube track plays we keep one silent 10-second loop running here, so the media
// card, media keys and headset buttons point at Mattchat instead of the iframe.
let anchorEl = null
function getAnchor() {
  if (typeof document === 'undefined') return null
  if (anchorEl) return anchorEl
  const rate = 8000, n = rate * 10
  const buf = new ArrayBuffer(44 + n)
  const v = new DataView(buf)
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true)
  w(36, 'data'); v.setUint32(40, n, true)
  new Uint8Array(buf, 44).fill(128) // 8-bit PCM: 128 = silence
  const el = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })))
  el.loop = true
  anchorEl = el
  return el
}
// Feeds the phone's lock screen and notification, the desktop media overlay and the keyboard media keys
export function useMediaSession({ track, isPlaying, currentTime, duration, playbackRate = 1, onPlay, onPause, onNext, onPrevious, onSeekTo, onStop }) {
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
  }, [track?.id, track?.title, track?.artist, track?.album, track?.artwork])  

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
      navigator.mediaSession.setPositionState({ duration, playbackRate: playbackRate || 1, position: Math.min(Math.max(time.current, 0), duration) })
    } catch { /* ignore invalid positions */ }
}, [track, duration, isPlaying, playbackRate, Math.floor(currentTime / 3)])
    // silent anchor, only while a YouTube track is the one playing
  const isYouTube = track?.provider === 'youtube'
  useEffect(() => {
    if (!supported) return
    const el = getAnchor()
    if (!el) return
    if (isYouTube && isPlaying) el.play().catch(() => {})
    else el.pause()
  }, [isYouTube, isPlaying])
  useEffect(() => () => { anchorEl?.pause() }, [])
}
