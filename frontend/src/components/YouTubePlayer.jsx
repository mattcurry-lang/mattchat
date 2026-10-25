// src/components/YouTubePlayer.jsx
// The video player opened from a chat's YouTube card. Same props as before:
// { videoId, startSeconds, mini, onClose, onExpand }.
//
// New: the same look as the rest of the YouTube pieces (glass buttons, a soft glow taken from the
// video's picture, rounded frame, safe-area aware controls), tap outside / Escape closes the big
// player, and a real fix: tapping a chapter or highlight on the card for the video that is
// ALREADY open now jumps to that time (before, that tap was silently ignored).
//
// Removed: the Picture-in-Picture button. It reached into YouTube's iframe for the <video>, which
// browsers never allow across sites, so it could not work.

import React, { useRef, useEffect } from 'react'
import { baseThumbUrl } from '../lib/youtubeThumb'
import { ensureYouTubeStyles } from './youtube/youtubeStyles'
import { MinimizeIcon, ExpandIcon, CloseIcon } from './youtube/ytIcons'

ensureYouTubeStyles()

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

export default function YouTubePlayer({ videoId, startSeconds, mini, onClose, onExpand }) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const currentVideoId = useRef(null)

  // Creates the player ONCE per videoId change - never torn down just because mini/full mode
  // toggled. Mini vs full only changes CSS classes below, never unmounts the iframe.
  useEffect(() => {
    let cancelled = false
    if (currentVideoId.current === videoId && playerRef.current) {
      // Same video already open: a chapter / highlight tap just moves the playhead.
      if (typeof startSeconds === 'number') playerRef.current.seekTo?.(startSeconds, true)
      return undefined
    }
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !containerRef.current) return
      playerRef.current?.destroy?.()
      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: { autoplay: 1, playsinline: 1, start: startSeconds || 0 },
      })
      currentVideoId.current = videoId
    })
    return () => { cancelled = true }
  }, [videoId, startSeconds])

  useEffect(() => () => playerRef.current?.destroy?.(), [])

  // Escape closes the big player (the little one stays out of the way)
  useEffect(() => {
    if (mini) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mini, onClose])

  return (
    <div className="mc-yt" style={{ display: 'contents' }}>
      {/* Backdrop with a soft glow from the video's picture - full mode only; tapping it closes */}
      {!mini && (
        <div className="mc-ytv-backdrop" onClick={onClose} aria-hidden="true">
          <div className="mc-ytv-glow" style={{ backgroundImage: `url(${baseThumbUrl(videoId)})` }} />
        </div>
      )}

      <div className={`mc-ytv-bar ${mini ? 'mc-ytv-bar--mini' : 'mc-ytv-bar--full'}`}>
        <button type="button" className="mc-ytv-btn" onClick={onExpand} aria-label={mini ? 'Expand video' : 'Shrink to mini player'}>
          {mini ? <ExpandIcon /> : <MinimizeIcon />} {mini ? 'Expand' : 'Mini'}
        </button>
        <button type="button" className="mc-ytv-btn mc-ytv-btn--icon mc-ytv-btn--bad" onClick={onClose} aria-label="Close video">
          <CloseIcon size={15} />
        </button>
      </div>

      {/* The single, never-remounted player frame */}
      <div className={`mc-ytv-frame ${mini ? 'mc-ytv-frame--mini' : 'mc-ytv-frame--full'}`} role={mini ? undefined : 'dialog'} aria-label="YouTube video">
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}
