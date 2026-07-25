import React, { useRef, useEffect } from 'react'

// Loads the YouTube IFrame API once, globally, and calls back when
// it's ready — multiple player instances can share the same script
// load rather than each injecting their own <script> tag.
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

export default function YouTubePlayer({ videoId, mini, onClose, onExpand }) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !containerRef.current) return
      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: { autoplay: 1, playsinline: 1 },
      })
    })
    return () => {
      cancelled = true
      playerRef.current?.destroy?.()
    }
  }, [videoId])

  const handlePiP = async () => {
    // Native Picture-in-Picture requires a <video> element — the
    // YouTube iframe doesn't expose one directly, so this asks the
    // iframe's internal video element via the Document PiP API where
    // supported. Falls back silently (mini-player mode still works)
    // on browsers without support.
    try {
      const iframe = containerRef.current?.querySelector('iframe')
      const video = iframe?.contentDocument?.querySelector('video')
      if (video && document.pictureInPictureEnabled) {
        await video.requestPictureInPicture()
      }
    } catch (e) {
      console.warn('Picture-in-picture not available:', e)
    }
  }

  if (mini) {
    return (
      <div style={{
        position: 'fixed', bottom: 90, right: 16, width: 240, borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)', zIndex: 500, background: '#000',
      }}>
        <div ref={containerRef} style={{ width: '100%', aspectRatio: '16/9' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(0,0,0,0.85)' }}>
          <button onClick={onExpand} style={miniBtnStyle}>⤢ Expand</button>
          <button onClick={onClose} style={miniBtnStyle}>✕</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 12 }}>
        <button onClick={handlePiP} style={topBtnStyle} title="Picture-in-picture">⧉ PiP</button>
        <button onClick={onExpand} style={topBtnStyle} title="Minimize">— Mini</button>
        <button onClick={onClose} style={topBtnStyle} title="Close">✕</button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px 16px' }}>
        <div style={{ width: '100%', maxWidth: 900 }}>
          <div ref={containerRef} style={{ width: '100%', aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden' }} />
        </div>
      </div>
    </div>
  )
}

const miniBtnStyle = {
  background: 'none', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '2px 6px',
}
const topBtnStyle = {
  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20,
  color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
}
