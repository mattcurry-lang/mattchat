import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useDominantColor } from '../../hooks/useDominantColor'

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

function haptic(pattern = 10) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern) } catch { /* unsupported — no-op */ }
  }
}

export default function ShortsVideoCard({
  video, isActive, isMounted, startPosition,
  onProgress, onEnded, onReplay, liked, onToggleLike,
  onOpenShare, onOpenComments, onTap,
}) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const readyRef = useRef(false)
  const [ready, setReady] = useState(false)
  const progressTimer = useRef(null)
  const [burst, setBurst] = useState(false)
  const lastTapRef = useRef(0)
  const bgColor = useDominantColor(video.thumbnailUrl)

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
            e.target.unMute()
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED) {
              onEnded?.()
              onReplay?.() // loop param means ENDED fires on every replay too
            }
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

  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return
    if (isActive) playerRef.current.playVideo?.()
    else playerRef.current.pauseVideo?.()
  }, [isActive, ready])

  useEffect(() => {
    if (!isActive) return
    progressTimer.current = setInterval(() => {
      const t = playerRef.current?.getCurrentTime?.()
      if (typeof t === 'number') onProgress?.(t)
    }, 2000)
    return () => clearInterval(progressTimer.current)
  }, [isActive, onProgress])

  const triggerLikeBurst = useCallback(() => {
    setBurst(true)
    haptic(15)
    setTimeout(() => setBurst(false), 700)
  }, [])

  const handleTapVideo = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 280) {
      // Double tap → like (only fires once per pair, ignores the pause toggle)
      lastTapRef.current = 0
      if (!liked) onToggleLike()
      triggerLikeBurst()
      return
    }
    lastTapRef.current = now
    setTimeout(() => {
      if (Date.now() - lastTapRef.current < 280) return // was consumed by the double-tap branch
      if (!readyRef.current) { onTap?.(); return }
      const state = playerRef.current.getPlayerState()
      if (state === window.YT.PlayerState.PLAYING) playerRef.current.pauseVideo()
      else playerRef.current.playVideo()
      onTap?.()
    }, 290)
  }, [liked, onToggleLike, onTap, triggerLikeBurst])

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100dvh', flexShrink: 0,
      scrollSnapAlign: 'start', scrollSnapStop: 'always', overflow: 'hidden',
      background: bgColor, transition: 'background 0.6s ease',
    }}>
      {/* Blurred, scaled backdrop sampled from the video itself — this
          is what replaces the flat black bars either side of a
          9:16-ish-but-not-exact clip. */}
      <div style={{
        position: 'absolute', inset: -20, backgroundImage: `url(${video.thumbnailUrl})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(38px) saturate(1.35) brightness(0.55)', transform: 'scale(1.15)',
      }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${bgColor}55, transparent 30%, transparent 65%, ${bgColor}dd)` }} />

      {/* Foreground player — contained, never cropped */}
      <div
        onClick={handleTapVideo}
        style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        <div style={{ width: '100%', maxWidth: 'calc(100dvh * 9 / 16)', aspectRatio: '9/16', position: 'relative' }}>
          {isMounted ? (
            <div ref={containerRef} style={{ width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 2, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
          ) : (
            <img src={video.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2 }} />
          )}
        </div>
      </div>

      {/* Double-tap heart burst */}
      {burst && (
        <div style={{
          position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%,-50%)',
          fontSize: 90, pointerEvents: 'none', animation: 'shortsHeartBurst 0.7s ease forwards',
        }}>❤️</div>
      )}

      {/* Creator / title — glass caption card */}
      <div style={{
        position: 'absolute', left: 14, right: 84, bottom: 28, color: '#fff',
        display: 'flex', flexDirection: 'column', gap: 7, padding: '12px 14px',
        background: 'rgba(20,20,30,0.32)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        borderRadius: 18, border: '1px solid rgba(255,255,255,0.12)',
      }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>▶</span>
          {video.channelTitle}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {video.title}
        </div>
      </div>

      {/* Action rail — glass pills */}
      <div style={{ position: 'absolute', right: 10, bottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <button onClick={(e) => { e.stopPropagation(); onToggleLike(); if (!liked) triggerLikeBurst() }} style={railBtnStyle}>
          <span style={{ fontSize: 24, display: 'block', transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', transform: liked ? 'scale(1.15)' : 'scale(1)' }}>
            {liked ? '❤️' : '🤍'}
          </span>
          <span style={railLabelStyle}>{formatCount((video.viewCount || 0) % 9999)}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onOpenComments?.() }} style={railBtnStyle}>
          <span style={{ fontSize: 22 }}>💬</span>
          <span style={railLabelStyle}>Comment</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onOpenShare() }} style={railBtnStyle}>
          <span style={{ fontSize: 22 }}>➤</span>
          <span style={railLabelStyle}>Send</span>
        </button>
      </div>

      <style>{`
        @keyframes shortsHeartBurst {
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.4); }
          25%  { opacity: 1; transform: translate(-50%,-50%) scale(1.15); }
          40%  { transform: translate(-50%,-50%) scale(0.95); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(1.3); }
        }
      `}</style>
    </div>
  )
}

const railBtnStyle = {
  background: 'rgba(20,20,30,0.35)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, width: 52, padding: '10px 0 8px',
  color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  cursor: 'pointer', fontFamily: 'inherit',
}
const railLabelStyle = { fontSize: 9.5, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }
