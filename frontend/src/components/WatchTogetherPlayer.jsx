import React, { useRef, useEffect, useCallback } from 'react'

let apiLoadPromise = null
function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (apiLoadPromise) return apiLoadPromise
  apiLoadPromise = new Promise((resolve) => {
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
    window.onYouTubeIframeAPIReady = () => resolve(window.YT)
  })
  return apiLoadPromise
}

export default function WatchTogetherPlayer({ watchSession, onUpdatePlayback, onClose, isHost }) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const applyingRemoteUpdate = useRef(false)
  const broadcastTimer = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !containerRef.current) return
      playerRef.current = new YT.Player(containerRef.current, {
        videoId: watchSession.video_id,
        playerVars: { autoplay: 1, playsinline: 1 },
        events: {
          onReady: (e) => {
            e.target.seekTo(watchSession.playback_position || 0, true)
            if (watchSession.playback_state === 'playing') e.target.playVideo()
          },
          onStateChange: (e) => {
            if (applyingRemoteUpdate.current) return // don't echo remote-driven changes back out
            const YTState = window.YT.PlayerState
            if (e.data === YTState.PLAYING) {
              onUpdatePlayback({ playback_state: 'playing', playback_position: playerRef.current.getCurrentTime() })
            } else if (e.data === YTState.PAUSED) {
              onUpdatePlayback({ playback_state: 'paused', playback_position: playerRef.current.getCurrentTime() })
            }
          },
        },
      })
    })
    return () => { cancelled = true; playerRef.current?.destroy?.() }
  }, [watchSession.video_id])

  // Periodically broadcast position while playing, so a late joiner
  // or someone whose socket dropped can resync without a hard cut.
  useEffect(() => {
    broadcastTimer.current = setInterval(() => {
      if (!playerRef.current?.getPlayerState) return
      const YTState = window.YT?.PlayerState
      if (playerRef.current.getPlayerState() === YTState?.PLAYING) {
        onUpdatePlayback({ playback_state: 'playing', playback_position: playerRef.current.getCurrentTime() })
      }
    }, 3000)
    return () => clearInterval(broadcastTimer.current)
  }, [onUpdatePlayback])

  // Applies a remote update (someone else played/paused/seeked) to
  // this local player instance, guarding against re-triggering our
  // own onStateChange handler in a loop.
  const applyRemote = useCallback((state, position) => {
    if (!playerRef.current) return
    applyingRemoteUpdate.current = true
    const localTime = playerRef.current.getCurrentTime?.() || 0
    // Only seek if drift is significant — small gaps aren't worth a
    // jarring correction every update.
    if (Math.abs(localTime - position) > 2) {
      playerRef.current.seekTo(position, true)
    }
    if (state === 'playing') playerRef.current.playVideo()
    else playerRef.current.pauseVideo()
    setTimeout(() => { applyingRemoteUpdate.current = false }, 500)
  }, [])

  useEffect(() => {
    applyRemote(watchSession.playback_state, watchSession.playback_position)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchSession.playback_state, watchSession.playback_position, watchSession.updated_at])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.94)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14 }}>
        <div style={{ color: '#c4b5fd', fontSize: 13, fontWeight: 700 }}>🎬 Watching together</div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Leave
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px 16px' }}>
        <div style={{ width: '100%', maxWidth: 900 }}>
          <div ref={containerRef} style={{ width: '100%', aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden' }} />
        </div>
      </div>
    </div>
  )
}
