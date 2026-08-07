import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Heart, MessageCircle, Repeat2, Bookmark, Send, Volume2, VolumeX } from 'lucide-react'
import { useDominantColor } from '../../hooks/useDominantColor'
import { useIsDesktop } from '../../hooks/useIsDesktop'

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
  video, isActive, isMounted,
  onProgress, onEnded, onReplay, liked, onToggleLike,
  onOpenShare, onOpenComments, onTap,
  muted, onToggleMute,
  following, onToggleFollow, reposted, onToggleRepost, saved, onToggleSave,
}) {
  const wrapperRef = useRef(null)
  const playerRef = useRef(null)
  const readyRef = useRef(false)
  const [ready, setReady] = useState(false)
  const progressTimer = useRef(null)
  const [burst, setBurst] = useState(false)
  const lastTapRef = useRef(0)
  const bgColor = useDominantColor(video.thumbnailUrl)
  const isDesktop = useIsDesktop()

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
            // Always starts at 0 — no resume-to-last-position. A short
            // always beginning from wherever you previously stopped
            // made replays and re-scrolls feel repetitive rather than
            // helpful, so this intentionally does NOT seek anywhere.
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

  // The mounted-player / poster-until-ready block is identical in both
  // layouts, so it's factored out once here instead of duplicated.
  const videoSurface = (
    <>
      {isMounted ? (
        <>
          {!ready && (
            <img
              src={video.thumbnailUrl} alt="" loading="eager" decoding="async"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }}
            />
          )}
          <div ref={wrapperRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
        </>
      ) : (
        <img src={video.thumbnailUrl} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {burst && (
        <div style={{
          position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%,-50%)',
          pointerEvents: 'none', animation: 'shortsHeartBurst 0.7s ease forwards',
        }}>
          <Heart size={90} fill="#ff3b5c" color="#ff3b5c" strokeWidth={0} />
        </div>
      )}
      {isActive && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMute?.() }}
          style={{
            position: 'absolute', right: 12, bottom: 12, zIndex: 4,
            background: 'none', border: 'none', color: '#fff',
            cursor: 'pointer', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.7))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
          }}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={19} strokeWidth={2} /> : <Volume2 size={19} strokeWidth={2} />}
        </button>
      )}
    </>
  )

  const railButtons = (railStyle, labelStyle, iconShadow) => (
    <>
      <button onClick={(e) => { e.stopPropagation(); onToggleLike(); if (!liked) triggerLikeBurst() }} style={railStyle}>
        <Heart
          size={27} strokeWidth={2} fill={liked ? '#ff3b5c' : 'none'} color={liked ? '#ff3b5c' : '#fff'}
          style={{ transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', transform: liked ? 'scale(1.15)' : 'scale(1)', filter: iconShadow }}
        />
        <span style={labelStyle}>{formatCount((video.viewCount || 0) % 999_999)}</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onOpenComments?.() }} style={railStyle}>
        <MessageCircle size={25} strokeWidth={2} color="#fff" style={{ filter: iconShadow }} />
        <span style={labelStyle}>{formatCount(21)}</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onToggleRepost?.() }} style={railStyle}>
        <Repeat2 size={27} strokeWidth={2.2} color={reposted ? '#5eb1ff' : '#fff'} style={{ filter: iconShadow }} />
        <span style={labelStyle}>Repost</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onToggleSave?.() }} style={railStyle}>
        <Bookmark size={24} strokeWidth={2} fill={saved ? '#fff' : 'none'} color="#fff" style={{ filter: iconShadow }} />
      </button>
      {/* Send-to-chat is Mattchat's own core feature (sharing a Short
          straight into a conversation) and has no Instagram Reels
          equivalent in the reference screenshots — kept deliberately
          even though it means the rail has one more icon than the
          reference. */}
      <button onClick={(e) => { e.stopPropagation(); onOpenShare() }} style={railStyle}>
        <Send size={24} strokeWidth={2} color="#fff" style={{ filter: iconShadow }} />
        <span style={labelStyle}>Send</span>
      </button>
    </>
  )

  const creatorAndCaption = (textColor, linkColor) => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#667eea,#764ba2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0,
        }}>
          {(video.channelTitle || '?').charAt(0).toUpperCase()}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {video.channelTitle}
        </span>
        <span style={{ color: textColor, fontSize: 13 }}>&bull;</span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFollow?.() }}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13.5, fontWeight: 700, color: following ? 'rgba(255,255,255,0.55)' : linkColor, flexShrink: 0,
          }}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      </div>
      <div style={{ color: textColor, fontSize: 13, fontWeight: 500, lineHeight: 1.4, marginTop: 6 }}>
        {video.title}
      </div>
    </>
  )

  // ── Desktop: Instagram's own web client puts the creator info and
  // caption BELOW a fixed-size rounded video card, with the action
  // rail beside it — not overlaid on the video. There's enough
  // horizontal room on desktop that overlaying (the mobile approach)
  // would just be copying a mobile-only constraint that doesn't apply
  // here.
  if (isDesktop) {
    return (
      <div style={{
        height: '100dvh', width: '100%', flexShrink: 0,
        scrollSnapAlign: 'start', scrollSnapStop: 'always',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0f', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 22 }}>
          <div
            onClick={handleTapVideo}
            style={{
              position: 'relative', width: 340, maxWidth: '80vw', maxHeight: '74vh', aspectRatio: '9/16',
              borderRadius: 12, overflow: 'hidden', cursor: 'pointer', background: bgColor,
              transition: 'background 0.6s ease',
            }}
          >
            {videoSurface}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 8 }}>
            {railButtons(desktopRailBtnStyle, desktopRailLabelStyle, 'none')}
          </div>
        </div>
        <div style={{ width: 340, maxWidth: '80vw' }}>
          {creatorAndCaption('#fff', '#5eb1ff')}
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

  // ── Mobile: full-bleed immersive video, everything overlaid with a
  // gradient scrim — this is the correct treatment when the video IS
  // the screen, matching your mobile Reels reference from earlier.
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
          {videoSurface}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 14, right: 78, bottom: 30, color: '#fff' }}>
        {creatorAndCaption('#fff', '#5eb1ff')}
      </div>

      <div style={{ position: 'absolute', right: 10, bottom: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        {railButtons(railBtnStyle, railLabelStyle, 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))')}
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
const desktopRailBtnStyle = { ...railBtnStyle }
const desktopRailLabelStyle = { fontSize: 11, fontWeight: 700, color: '#fff' }
