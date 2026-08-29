// ScreenshotCapture.jsx
// Section 1 — "Screenshot" attachment option. Uses getDisplayMedia to let
// the user pick a tab/window/screen via the browser's own native picker
// (we cannot skip or customize that step — it's a browser security
// requirement, not a Mattchat limitation), shows a live preview, and
// captures a single still frame on demand. The resulting PNG is handed
// back through the exact same onConfirm(files, mediaType) shape
// CameraCapture uses, so it flows into MediaComposer identically.
//
// Honest limitation: getDisplayMedia has no mobile browser support
// (iOS Safari, Chrome/Android) — this component detects that up front
// and shows an explanatory message instead of a broken button.

import { useState, useRef, useEffect } from 'react'
import { IconX, IconCamera } from '../Icons'

const SUPPORTED = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia

export default function ScreenshotCapture({ isOpen, onClose, onConfirm }) {
  const [status, setStatus] = useState('idle') // idle | requesting | live | denied | error
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    if (!isOpen) { stopStream(); setStatus('idle'); return }
    if (!SUPPORTED) { setStatus('error'); return }
    return () => stopStream() // cleanup if the sheet is closed mid-capture
  }, [isOpen])

  const startCapture = async () => {
    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      // If the user stops sharing via the browser's own "Stop sharing"
      // control rather than our Cancel button, reflect that here too.
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopStream()
        setStatus('idle')
      })
      setStatus('live')
    } catch (e) {
      setStatus(e.name === 'NotAllowedError' ? 'denied' : 'error')
    }
  }

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' })
      stopStream()
      onConfirm([file], 'image')
    }, 'image/png')
  }

  const handleClose = () => { stopStream(); onClose() }

  if (!isOpen) return null

  return (
    <div style={overlayStyle} onClick={handleClose}>
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Screenshot</span>
          <button onClick={handleClose} style={closeBtnStyle}><IconX size={16} /></button>
        </div>

        <div style={previewWrapStyle}>
          {status === 'error' && !SUPPORTED && (
            <div style={centerMsgStyle}>Screenshot capture isn't supported in this browser — it's a desktop-browser feature only. Use Photos to send an existing screenshot instead.</div>
          )}
          {status === 'error' && SUPPORTED && (
            <div style={centerMsgStyle}>Something went wrong starting the capture. Try again.</div>
          )}
          {status === 'denied' && (
            <div style={centerMsgStyle}>Screen sharing was cancelled or denied.</div>
          )}
          {status === 'idle' && SUPPORTED && (
            <div style={centerMsgStyle}>Tap "Choose what to share" to pick a tab, window, or your entire screen — your browser will ask you to confirm.</div>
          )}
          {status === 'requesting' && <div style={centerMsgStyle}>Waiting for your selection…</div>}
          {/* Always mounted (just hidden) once support is confirmed, so
              videoRef exists before startCapture() needs to attach the
              stream to it. */}
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', maxHeight: 320, display: status === 'live' ? 'block' : 'none', borderRadius: 12, background: '#000' }}
          />
        </div>

        {status === 'idle' && SUPPORTED && (
          <button onClick={startCapture} style={primaryBtnStyle}>Choose what to share</button>
        )}
        {(status === 'denied' || (status === 'error' && SUPPORTED)) && (
          <button onClick={startCapture} style={primaryBtnStyle}>Try again</button>
        )}
        {status === 'live' && (
          <button onClick={capture} style={primaryBtnStyle}>
            <IconCamera size={15} style={{ marginRight: 6 }} /> Capture
          </button>
        )}
      </div>
    </div>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
const sheetStyle = { width: '100%', maxWidth: 460, background: 'var(--bg-surface-1, #14141f)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }
const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const closeBtnStyle = { background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const previewWrapStyle = { borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const centerMsgStyle = { fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: 24, lineHeight: 1.5 }
const primaryBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 700, fontSize: 13.5, padding: '12px', fontFamily: 'inherit', cursor: 'pointer' }
