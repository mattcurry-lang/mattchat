import { useState, useEffect, useRef, useCallback } from 'react'
import { getSpotifyToken } from '../lib/supabase'

// Loads the Spotify Web Playback SDK script once, no matter how many
// components call this.
let sdkLoadPromise = null
function loadSpotifySDK() {
  if (window.Spotify) return Promise.resolve()
  if (sdkLoadPromise) return sdkLoadPromise
  sdkLoadPromise = new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)
  })
  return sdkLoadPromise
}

// Unifies two very different playback paths behind one small API:
//   - Premium accounts: real full-track playback via the Web
//     Playback SDK, which registers this browser tab as a genuine
//     Spotify Connect device — no redirect to the Spotify app ever
//     happens.
//   - Free accounts: Spotify's API only exposes a 30-second
//     preview_url for free-tier playback (their limit, not ours), so
//     we just play that through a plain <audio> element instead.
// Callers don't need to know which path is active — playTrack(track)
// picks the right one based on the connected account's `product`.
export function useSpotify(session) {
  const [connected, setConnected] = useState(false)
  const [product, setProduct] = useState(null) // 'premium' | 'free' | null
  const [displayName, setDisplayName] = useState(null)
  const [ready, setReady] = useState(false) // SDK device ready (premium only)
  const [currentTrack, setCurrentTrack] = useState(null) // { name, artists, image, uri, isPreview }
  const [isPlaying, setIsPlaying] = useState(false)
  const [checked, setChecked] = useState(false)

  const playerRef = useRef(null)
  const deviceIdRef = useRef(null)
  const audioRef = useRef(null)
  const tokenCacheRef = useRef(null) // { token, expiresAtMs }

  const getFreshToken = useCallback(async () => {
    const now = Date.now()
    if (tokenCacheRef.current && tokenCacheRef.current.expiresAtMs > now) {
      return tokenCacheRef.current.token
    }
    const data = await getSpotifyToken(session)
    if (!data.ok || !data.connected) return null
    tokenCacheRef.current = { token: data.accessToken, expiresAtMs: now + 50_000 } // short-lived local cache
    return data.accessToken
  }, [session])

  // Initial connection check + SDK bootstrap for Premium accounts.
  useEffect(() => {
    if (!session) return
    let cancelled = false

    async function init() {
      const data = await getSpotifyToken(session)
      if (cancelled) return
      setConnected(!!data.connected)
      setProduct(data.product || null)
      setDisplayName(data.displayName || null)
      setChecked(true)

      if (data.connected && data.product === 'premium') {
        await loadSpotifySDK()
        if (cancelled) return
        const player = new window.Spotify.Player({
          name: 'Mattchat',
          getOAuthToken: async (cb) => cb(await getFreshToken()),
          volume: 0.7,
        })
        player.addListener('ready', ({ device_id }) => { deviceIdRef.current = device_id; setReady(true) })
        player.addListener('not_ready', () => setReady(false))
        player.addListener('player_state_changed', (state) => {
          if (!state) return
          const t = state.track_window?.current_track
          if (t) {
            setCurrentTrack({
              name: t.name,
              artists: t.artists.map(a => a.name).join(', '),
              image: t.album?.images?.[0]?.url,
              uri: t.uri,
              isPreview: false,
            })
          }
          setIsPlaying(!state.paused)
        })
        player.connect()
        playerRef.current = player
      }
    }
    init()

    return () => {
      cancelled = true
      playerRef.current?.disconnect()
    }
  }, [session, getFreshToken])

  // Plain <audio> element for free-tier 30s previews.
  useEffect(() => {
    const audio = new Audio()
    audio.addEventListener('ended', () => setIsPlaying(false))
    audioRef.current = audio
    return () => { audio.pause(); audio.src = '' }
  }, [])

  const playTrack = useCallback(async (track) => {
    // track: { uri, name, artists, image, preview_url }
    if (product === 'premium' && ready && deviceIdRef.current) {
      const token = await getFreshToken()
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceIdRef.current}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [track.uri] }),
      })
      setCurrentTrack({ name: track.name, artists: track.artists, image: track.image, uri: track.uri, isPreview: false })
      setIsPlaying(true)
      return
    }

    // Free tier (or Premium SDK not ready yet) — 30s preview fallback.
    if (!track.preview_url) return
    const audio = audioRef.current
    audio.src = track.preview_url
    audio.currentTime = 0
    audio.play()
    setCurrentTrack({ name: track.name, artists: track.artists, image: track.image, uri: track.uri, isPreview: true })
    setIsPlaying(true)
  }, [product, ready, getFreshToken])

  const togglePlay = useCallback(async () => {
    if (currentTrack?.isPreview) {
      const audio = audioRef.current
      if (isPlaying) { audio.pause(); setIsPlaying(false) } else { audio.play(); setIsPlaying(true) }
      return
    }
    if (product === 'premium' && playerRef.current) {
      await playerRef.current.togglePlay()
    }
  }, [currentTrack, isPlaying, product])

  return {
    checked, connected, product, displayName, ready,
    currentTrack, isPlaying,
    playTrack, togglePlay,
    getFreshToken,
  }
}
