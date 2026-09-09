/**
 * lib/music/YouTubeEngine.js
 *
 * A hidden 1x1px YouTube IFrame Player used purely as an audio
 * engine. Lazy-loaded — the YT script and player only ever get
 * created the first time a YouTube track is actually played.
 *
 * This is a plain singleton module, not a React component — it
 * manages its own DOM node so MusicPlayerContext can call it
 * imperatively (load/play/pause/seek) exactly like it calls the
 * <audio> element for Audius/Mattchat tracks.
 */

let apiPromise = null
let player = null
let listeners = { onTimeUpdate: null, onEnded: null, onStateChange: null }
let pollTimer = null

function loadApi() {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) { resolve(); return }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev && prev(); resolve() }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}

function ensureContainer() {
  let el = document.getElementById('mattchat-yt-audio-engine')
  if (!el) {
    el = document.createElement('div')
    el.id = 'mattchat-yt-audio-engine'
    Object.assign(el.style, {
      position: 'fixed', width: '1px', height: '1px', opacity: '0',
      pointerEvents: 'none', left: '-9999px', top: '-9999px',
    })
    document.body.appendChild(el)
  }
  return el
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    if (!player || typeof player.getCurrentTime !== 'function') return
    try {
      listeners.onTimeUpdate?.(player.getCurrentTime(), player.getDuration())
    } catch { /* player not ready yet mid-transition — ignore this tick */ }
  }, 400)
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

let playerReadyPromise = null

async function ensurePlayer() {
  if (player && playerReadyPromise) return playerReadyPromise
  if (playerReadyPromise) return playerReadyPromise // someone else is already building it

  playerReadyPromise = (async () => {
    await loadApi()
    const container = ensureContainer()
    return new Promise((resolve, reject) => {
      const p = new window.YT.Player(container, {
        height: '1', width: '1',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => { player = p; resolve(p) },
          onError: (e) => listeners.onPlaybackError?.(e.data),
          onStateChange: (e) => {
            listeners.onStateChange?.(e.data)
            if (e.data === window.YT.PlayerState.ENDED) { stopPolling(); listeners.onEnded?.() }
            if (e.data === window.YT.PlayerState.PLAYING) startPolling()
            if (e.data === window.YT.PlayerState.PAUSED) stopPolling()
          },
        },
      })
    })
  })()

  return playerReadyPromise
}
export const YouTubeEngine = {
  async load(videoId) {
    const p = await ensurePlayer()
    p.loadVideoById(videoId)
  },
  async play() {
    const p = await ensurePlayer()
    p.playVideo()
  },
  async pause() {
    const p = await ensurePlayer()
    p.pauseVideo()
  },
  async seekTo(seconds) {
    const p = await ensurePlayer()
    p.seekTo(seconds, true)
  },
  async setVolume(v01) {
    const p = await ensurePlayer()
    p.setVolume(Math.round(Math.max(0, Math.min(1, v01)) * 100))
  },
  stop() {
    stopPolling()
    try { player?.stopVideo() } catch {}
  },
  setListeners(next) { listeners = { ...listeners, ...next } },
}
