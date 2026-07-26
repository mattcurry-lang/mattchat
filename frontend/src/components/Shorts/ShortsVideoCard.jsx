import React, { useRef, useEffect, useState, useCallback } from 'react'

let apiLoadPromise = null
function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (apiLoadPromise) return apiLoadPromise
  apiLoadPromise = new Promise((resolve) => {
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
    const prevReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prevReady?.(); resolve(window.YT) }
    if (window.YT && window.YT.Player) resolve(window.YT)
  })
  return apiLoadPromise
}

function formatCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function ShortsVideoCard({
  video, isActive, isMounted, muted, onToggleMute, startPosition,
  onProgress, onEnded, liked, onToggleLike, onOpenShare, onOpenComments,
}) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const readyRef = useRef(false)
  const [ready, setReady] = useState(false)
  const progressTimer = useRef(null)

  useEffect(() => {
    if (!isMounted) return
    let cancelled = false
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !containerRef.current) return
      playerRef.current = new YT.Player(containerRef.current, {
        videoId: video.videoId,
        playerVars: { autoplay: 0, playsinline: 1, controls: 0, loop: 1, playlist: video.videoId, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e) => {
            readyRef.current = true
            setReady(true)
            if (startPosition > 1) e.target.seekTo(startPosition, true)
            e.target[muted ? 'mute' : 'unMute']()
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED) onEnded?.()
          },
        },
      })
    })
    return () => {
      cancelled = true
      playerRef.current?.destroy?.()
      playerRef.current = null
      readyRef.current = false
    }
  }, [isMounted, video.videoId]) // eslint-disable-line

  // Play/pause driven purely by isActive — this is what makes "next
  // one plays, previous one pauses" work regardless of scroll speed.
  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return
    if (isActive) {
      playerRef.current.playVideo?.()
    } else {
      playerRef.current.pauseVideo?.()
    }
  }, [isActive, ready])

  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return
    playerRef.current[muted ? 'mute' : 'unMute']?.()
  }, [muted, ready])

  // Report watch progress every 2s while active, for continue-watching
  // + Curry's watch-duration signal — cleared the instant it's no
  // longer the active card.
  useEffect(() => {
    if (!isActive) return
    progressTimer.current = setInterval(() => {
      const t = playerRef.current?.getCurrentTime?.()
      if (typeof t === 'number') onProgress?.(t)
    }, 2000)
    return () => clearInterval(progressTimer.current)
  }, [isActive, onProgress])

  const handleTapVideo = useCallback(() => {
    if (!readyRef.current) return
    const state = playerRef.current.getPlayerState()
    if (state === window.YT.PlayerState.PLAYING) playerRef.current.pauseVideo()
    else playerRef.current.playVideo()
  }, [])

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100dvh', flexShrink: 0,
      scrollSnapAlign: 'start', scrollSnapStop: 'always', background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      {isMounted ? (
        <div onClick={handleTapVideo} style={{ width: '100%', height: '100%', cursor: 'pointer' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
        </div>
      ) : (
        <img src={video.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
      )}

      {/* Gradient scrim for legibility */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 18%, transparent 55%, rgba(0,0,0,0.75) 100%)', pointerEvents: 'none' }} />

      {/* Mute toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleMute() }}
        style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 36, height: 36, color: '#fff', fontSize: 15, cursor: 'pointer' }}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {/* Creator / title / description */}
      <div style={{ position: 'absolute', left: 16, right: 84, bottom: 24, color: '#fff', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
          ▶️ {video.channelTitle}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {video.title}
        </div>
        {video.description && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {video.description}
          </div>
        )}
      </div>

      {/* Action rail: like / comment / share */}
      <div style={{ position: 'absolute', right: 12, bottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <button onClick={(e) => { e.stopPropagation(); onToggleLike() }} style={actionBtnStyle}>
          <span style={{ fontSize: 26, transition: 'transform 0.15s', transform: liked ? 'scale(1.1)' : 'scale(1)' }}>
            {liked ? '❤️' : '🤍'}
          </span>
          <span style={actionLabelStyle}>{formatCount((video.viewCount || 0) % 9999)}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onOpenComments?.() }} style={actionBtnStyle}>
          <span style={{ fontSize: 24 }}>💬</span>
          <span style={actionLabelStyle}>Comment</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onOpenShare() }} style={actionBtnStyle}>
          <span style={{ fontSize: 24 }}>➤</span>
          <span style={actionLabelStyle}>Share</span>
        </button>
      </div>
    </div>
  )
}

const actionBtnStyle = {
  background: 'none', border: 'none', color: '#fff', display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: 4, cursor: 'pointer', fontFamily: 'inherit',
}
const actionLabelStyle = { fontSize: 10.5, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }
