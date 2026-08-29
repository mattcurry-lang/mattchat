// CameraCapture.jsx
// Live camera preview using getUserMedia. Supports photo capture (canvas
// snapshot) and short video recording (MediaRecorder). Falls back to the
// native camera file input on browsers/devices that block getUserMedia
// (e.g. some in-app webviews) so the feature never dead-ends.

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function CameraCapture({ isOpen, onClose, onConfirm }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const fallbackInputRef = useRef(null)

  const [mode, setMode] = useState('photo') // 'photo' | 'video'
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [facing, setFacing] = useState('environment')
  const [cameraError, setCameraError] = useState(null)
  const timerRef = useRef(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const startStream = useCallback(async () => {
    setCameraError(null)
    stopStream()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: mode === 'video',
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (e) {
      console.error('[CameraCapture] getUserMedia failed:', e)
      setCameraError('Camera unavailable — use your device camera app instead.')
    }
  }, [facing, mode, stopStream])

  useEffect(() => {
    if (isOpen) startStream()
    return () => stopStream()
  }, [isOpen, startStream, stopStream])

  useEffect(() => () => clearInterval(timerRef.current), [])

  const takePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onConfirm([file], 'image')
      handleClose()
    }, 'image/jpeg', 0.92)
  }

  const startRecording = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm;codecs=vp9,opus' })
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' })
      onConfirm([file], 'video')
      handleClose()
    }
    recorder.start()
    recorderRef.current = recorder
    setIsRecording(true)
    setRecordSeconds(0)
    timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    setIsRecording(false)
    clearInterval(timerRef.current)
  }

  const handleClose = () => {
    stopRecording()
    stopStream()
    onClose()
  }

  const flipCamera = () => setFacing(f => (f === 'environment' ? 'user' : 'environment'))

  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={overlayStyle}>
          <input
            ref={fallbackInputRef}
            type="file"
            accept={mode === 'video' ? 'video/*' : 'image/*'}
            capture={facing === 'user' ? 'user' : 'environment'}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onConfirm([file], mode === 'video' ? 'video' : 'image')
              handleClose()
            }}
          />

          {cameraError ? (
            <div style={fallbackStateStyle}>
              <p style={{ color: 'var(--text-secondary, #c9c4dd)', marginBottom: 16 }}>{cameraError}</p>
              <button onClick={() => fallbackInputRef.current?.click()} style={primaryBtnStyle}>Open camera</button>
              <button onClick={handleClose} style={{ ...textBtnStyle, marginTop: 12 }}>Cancel</button>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted style={videoStyle} />

              <div style={topBarStyle}>
                <button onClick={handleClose} style={iconBtnStyle}>✕</button>
                {isRecording && (
                  <span style={recTimerStyle}>● {mmss(recordSeconds)}</span>
                )}
                <button onClick={flipCamera} style={iconBtnStyle}>⟲</button>
              </div>

              <div style={bottomBarStyle}>
                <div style={modeSwitchStyle}>
                  <button
                    onClick={() => setMode('photo')}
                    style={{ ...modeBtnStyle, opacity: mode === 'photo' ? 1 : 0.5 }}
                  >Photo</button>
                  <button
                    onClick={() => setMode('video')}
                    style={{ ...modeBtnStyle, opacity: mode === 'video' ? 1 : 0.5 }}
                  >Video</button>
                </div>

                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => {
                    if (mode === 'photo') takePhoto()
                    else if (isRecording) stopRecording()
                    else startRecording()
                  }}
                  style={{
                    ...shutterStyle,
                    background: isRecording ? '#ff4757' : '#fff',
                    borderRadius: isRecording ? 10 : '50%',
                  }}
                  aria-label={mode === 'photo' ? 'Take photo' : isRecording ? 'Stop recording' : 'Start recording'}
                />
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 75, background: '#000', display: 'flex', flexDirection: 'column' }
const videoStyle = { flex: 1, width: '100%', objectFit: 'cover' }
const topBarStyle = {
  position: 'absolute', top: 0, left: 0, right: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 16px max(16px, env(safe-area-inset-top))',
}
const iconBtnStyle = {
  width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.4)',
  color: '#fff', border: 'none', fontSize: 18, cursor: 'pointer',
}
const recTimerStyle = { color: '#fff', fontWeight: 700, fontSize: 14, background: 'rgba(0,0,0,0.4)', padding: '6px 12px', borderRadius: 20 }
const bottomBarStyle = {
  position: 'absolute', bottom: 0, left: 0, right: 0,
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
  padding: '18px 0 max(24px, env(safe-area-inset-bottom))',
  background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
}
const modeSwitchStyle = { display: 'flex', gap: 20 }
const modeBtnStyle = { background: 'none', border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const shutterStyle = { width: 68, height: 68, border: '4px solid rgba(255,255,255,0.6)', cursor: 'pointer' }
const fallbackStateStyle = {
  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: 24, textAlign: 'center',
}
const primaryBtnStyle = {
  background: 'var(--accent, #7c5cff)', color: '#fff', border: 'none',
  borderRadius: 12, padding: '10px 22px', fontWeight: 600, cursor: 'pointer',
}
const textBtnStyle = { background: 'none', border: 'none', color: 'var(--text-secondary, #c9c4dd)', cursor: 'pointer', fontSize: 14 }
