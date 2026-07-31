import React, { useRef, useEffect } from 'react'

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

  // Creates the player ONCE per videoId change — never torn down just
  // because mini/full mode toggled. This is the actual fix: mini vs
  // full only changes CSS positioning below, never unmounts the iframe.
  useEffect(() => {
    let cancelled = false
    if (currentVideoId.current === videoId && playerRef.current) return
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

  const handlePiP = async () => {
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

  return (
    <>
      {/* Backdrop — only shown in full mode */}
      {!mini && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 599, background: 'rgba(0,0,0,0.92)' }} />
      )}

      {/* Controls bar */}
      <div style={{
        position: 'fixed', zIndex: 601,
        ...(mini
          ? { bottom: 90 + 158, right: 16, width: 240 } // sits just above the mini video
          : { top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 16px' }),
      }}>
        {!mini && <button onClick={handlePiP} style={topBtnStyle} title="Picture-in-picture">⧉ PiP</button>}
        <button onClick={onExpand} style={mini ? miniBtnStyle : topBtnStyle}>{mini ? '⤢ Expand' : '— Mini'}</button>
        <button onClick={onClose} style={mini ? miniBtnStyle : topBtnStyle}>✕</button>
      </div>

      {/* The single, never-remounted player container */}
      <div
        style={
          mini
            ? {
                position: 'fixed', bottom: 90, right: 16, width: 240, aspectRatio: '16/9',
                borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                zIndex: 600, background: '#000',
              }
            : {
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '90vw', maxWidth: 900, aspectRatio: '16/9',
                borderRadius: 12, overflow: 'hidden', zIndex: 600, background: '#000',
              }
        }
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </>
  )
}

const miniBtnStyle = {
  background: 'rgba(0,0,0,0.85)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', padding: '4px 10px', borderRadius: 8,
}
const topBtnStyle = {
  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20,
  color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
}
