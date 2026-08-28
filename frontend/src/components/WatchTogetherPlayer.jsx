import React, { useRef, useEffect, useCallback } from 'react'
import WatchTogetherChatOverlay from './WatchTogetherChatOverlay'
import { useWatchVoice } from '../hooks/useWatchVoice'
import { IconMic } from './Icons'

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

export default function WatchTogetherPlayer({
  watchSession, onUpdatePlayback, onClose, isHost, mini,
  currentUserId, chatMessages, onSendChatMessage, typingUsers, onTyping,
}) {
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const applyingRemoteUpdate = useRef(false)
  const broadcastTimer = useRef(null)

  // Voice only runs in full (non-mini) mode — same gating as the chat
  // overlay. P2P WebRTC, no third-party voice service, no billing.
  const { micOn, toggleMic, otherSpeaking, connected, connecting, voiceError } =
    useWatchVoice(watchSession?.id, currentUserId, !mini)

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
            if (applyingRemoteUpdate.current) return
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

  const applyRemote = useCallback((state, position) => {
    if (!playerRef.current) return
    applyingRemoteUpdate.current = true
    const localTime = playerRef.current.getCurrentTime?.() || 0
    if (Math.abs(localTime - position) > 2) {
      playerRef.current.seekTo(position, true)
    }
    if (state === 'playing') playerRef.current.playVideo()
    else playerRef.current.pauseVideo()
    setTimeout(() => { applyingRemoteUpdate.current = false }, 500)
  }, [])

  useEffect(() => {
    applyRemote(watchSession.playback_state, watchSession.playback_position)
  }, [watchSession.playback_state, watchSession.playback_position, watchSession.updated_at, applyRemote])

  return (
    <>
      {!mini && <div style={{ position: 'fixed', inset: 0, zIndex: 599, background: 'rgba(0,0,0,0.92)' }} />}

      <div style={{
        position: 'fixed', zIndex: 601,
        ...(mini
          ? { bottom: 90 + 158, right: 16, width: 240 }
          : { top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 16px' }),
      }}>
        <button onClick={onClose} style={mini ? miniBtnStyle : topBtnStyle}>{mini ? '✕' : 'Leave'}</button>
      </div>

      <div style={
        mini
          ? { position: 'fixed', bottom: 90, right: 16, width: 240, aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', zIndex: 600, background: '#000' }
          : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90vw', maxWidth: 900, aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', zIndex: 600, background: '#000' }
      }>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {!mini && (
          <>
            <WatchTogetherChatOverlay
              messages={chatMessages || []}
              currentUserId={currentUserId}
              onSend={onSendChatMessage}
              mini={mini}
              typingUsers={typingUsers || []}
              onTyping={onTyping}
            />

            <button
              onClick={toggleMic}
              disabled={!connected}
              title={voiceError ? `Voice unavailable: ${voiceError}` : connecting ? 'Connecting voice…' : micOn ? 'Mute mic' : 'Talk while you watch'}
              style={{
                position: 'absolute', bottom: 20, left: 20, zIndex: 608,
                width: 44, height: 44, borderRadius: '50%', border: 'none',
                cursor: connected ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: voiceError ? 'rgba(239,68,68,0.6)' : micOn ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'rgba(0,0,0,0.55)',
                boxShadow: otherSpeaking ? '0 0 0 4px rgba(52,211,153,0.4)' : '0 4px 16px rgba(0,0,0,0.3)',
                opacity: connecting ? 0.5 : 1, transition: 'box-shadow 0.2s, opacity 0.2s',
              }}
            >
              <IconMic size={18} style={{ color: micOn ? '#fff' : 'rgba(255,255,255,0.7)' }} />
            </button>
          </>
        )}
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
