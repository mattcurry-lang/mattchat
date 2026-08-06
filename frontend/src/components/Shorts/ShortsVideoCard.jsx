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
// Exported so ShortsPage can kick this off the moment Shorts opens,
// instead of waiting for the first card to mount — the API script
// fetch + parse is the single biggest fixed cost before any video can
// start, so starting it as early as possible is what actually moves
// the needle on perceived load time.
export { loadYouTubeAPI }

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
  muted, onToggleMute,
}) {
  const wrapperRef = useRef(null)
  const playerRef = useRef(null)
  const readyRef = useRef(false)
  const [ready, setReady] = useState(false)
  const progressTimer = useRef(null)
  const [burst, setBurst] = useState(false)
  const lastTapRef = useRef(0)
  const [following, setFollowing] = useState(false) // visual only — see note in chat
  const [reposted, setReposted] = useState(false)   // visual only — see note in chat
  const [saved, setSaved] = useState(false)          // visual only — see note in chat
  const bgColor = useDominantColor(video.thumbnailUrl)

  useEffect(() => {
    if (!isMounted) return
    let cancelled = false
    let targetDiv = null

    loadYouTubeAPI().then((YT) => {
      if (cancelled || !wrapperRef.current) return
      targetDiv = document.createElement('div')
      targetDiv.style.width = '100%'
      targetDiv.style.height = '100%'
      wrapperRef.current.appendChild(targetDiv)

      playerRef.current = new YT.Player(targetDiv, {
        videoId: video.videoId,
        playerVars: { autoplay: 0, playsinline: 1, controls: 0, loop: 1, playlist: video.videoId, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e) => {
            readyRef.current = true
            setReady(true)
            if (startPosition > 1) e.target.seekTo(startPosition, true)
            e.target.mute() // always start muted — see mute-reconciliation effect below for why
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED) {
              onEnded?.()
              onReplay?.()
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
      setReady(false)
      if (wrapperRef.current) wrapperRef.current.innerHTML = ''
    }
  }, [isMounted, video.videoId]) // eslint-disable-line

  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return
    if (isActive) playerRef.current.playVideo?.()
    else playerRef.current.pauseVideo?.()
  }, [isActive, ready])

  useEffect(() => {
    if (!ready || !playerRef.current) return
    if (muted) playerRef.current.mute?.()
    else playerRef.current.unMute?.()
  }, [muted, ready])

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
      lastTapRef.current = 0
      if (!liked) onToggleLike()
      triggerLikeBurst()
      return
    }
    lastTapRef.current = now
    setTimeout(() => {
      if (Date.now() - lastTapRef.current < 280) return
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
      <div style={{
        position: 'absolute', inset: -20, backgroundImage: `url(${video.thumbnailUrl})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(38px) saturate(1.35) brightness(0.55)', transform: 'scale(1.15)',
      }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${bgColor}55, transparent 30%, transparent 60%, rgba(0,0,0,0.75))` }} />

      <div
        onClick={handleTapVideo}
        style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        <div style={{ width: '100%', maxWidth: 'calc(100dvh * 9 / 16)', aspectRatio: '9/16', position: 'relative' }}>
          {isMounted ? (
            <>
              {/* Poster stays visible until the YouTube player actually
                  fires onReady, instead of showing a blank black box
                  during init. This is the main perceived-speed fix —
                  the network/init time doesn't change, but there's
                  never a moment that reads as "stuck loading". */}
              {!ready && (
                <img
                  src={video.thumbnailUrl} alt="" loading="eager" decoding="async"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2, zIndex: 1 }}
                />
              )}
              <div ref={wrapperRef} style={{ width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 2, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
            </>
          ) : (
            <img src={video.thumbnailUrl} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2 }} />
          )}
        </div>
      </div>

      {burst && (
        <div style={{
          position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%,-50%)',
          fontSize: 90, pointerEvents: 'none', animation: 'shortsHeartBurst 0.7s ease forwards',
        }}>❤️</div>
      )}

      {/* Creator row — avatar, name, Follow, sitting directly on the
          video with a drop shadow instead of inside a boxed card,
          matching the Reels reference. */}
      <div style={{
        position: 'absolute', left: 14, right: 78, bottom: 76, color: '#fff',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#667eea,#764ba2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}>
          {(video.channelTitle || '?').charAt(0).toUpperCase()}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {video.channelTitle}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setFollowing(v => !v) }}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13.5, fontWeight: 700, color: following ? 'rgba(255,255,255,0.55)' : '#5eb1ff',
            textShadow: '0 1px 3px rgba(0,0,0,0.6)', flexShrink: 0,
          }}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      </div>

      {/* Caption — plain text on the gradient scrim, no card behind it. */}
      <div style={{
        position: 'absolute', left: 14, right: 78, bottom: 30, color: '#fff',
        fontSize: 13, fontWeight: 500, lineHeight: 1.4, textShadow: '0 1px 4px rgba(0,0,0,0.7)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {video.title}
      </div>

      {/* Mute — small, minimal, sitting near the caption instead of
          floating in a top corner. */}
      {isActive && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMute?.() }}
          style={{
            position: 'absolute', right: 14, bottom: 30, zIndex: 4,
            background: 'none', border: 'none', color: '#fff', fontSize: 18,
            cursor: 'pointer', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.7))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
          }}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}

      {/* Action rail — plain icons + count, no background pill, matching
          the Reels reference: like, comment, repost, save, and more
          all present now. Repost and save are visual-only right now —
          see note below the code for what real persistence needs. */}
      <div style={{ position: 'absolute', right: 10, bottom: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <button onClick={(e) => { e.stopPropagation(); onToggleLike(); if (!liked) triggerLikeBurst() }} style={railBtnStyle}>
          <span style={{ fontSize: 27, display: 'block', transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', transform: liked ? 'scale(1.15)' : 'scale(1)', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }}>
            {liked ? '❤️' : '🤍'}
          </span>
          <span style={railLabelStyle}>{formatCount((video.viewCount || 0) % 999_999)}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onOpenComments?.() }} style={railBtnStyle}>
          <span style={{ fontSize: 25, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }}>💬</span>
          <span style={railLabelStyle}>Comment</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); setReposted(v => !v) }} style={railBtnStyle}>
          <span style={{ fontSize: 25, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))', color: reposted ? '#5eb1ff' : '#fff' }}>🔁</span>
          <span style={railLabelStyle}>Repost</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); setSaved(v => !v) }} style={railBtnStyle}>
          <span style={{ fontSize: 24, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }}>{saved ? '🔖' : '📑'}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onOpenShare() }} style={railBtnStyle}>
          <span style={{ fontSize: 25, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }}>➤</span>
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
  background: 'none', border: 'none', width: 44, padding: 0,
  color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
  cursor: 'pointer', fontFamily: 'inherit',
}
const railLabelStyle = { fontSize: 11, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }
