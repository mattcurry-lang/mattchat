import React, { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const MAX_DURATION = 120
const WAVEFORM_BARS = 36

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function VoiceRecorder({ conversationId, senderId, onSent, onCancel }) {
  const [phase, setPhase] = useState('idle') // idle | recording | preview | sending
  const [duration, setDuration] = useState(0)
  const [bars, setBars] = useState(Array(WAVEFORM_BARS).fill(0.1))
  const [error, setError] = useState(null)

  const mediaRecorder = useRef(null)
  const audioChunks = useRef([])
  const audioBlob = useRef(null)
  const audioUrl = useRef(null)
  const analyser = useRef(null)
  const animFrame = useRef(null)
  const timer = useRef(null)
  const barsSnapshot = useRef([])
  const durationRef = useRef(0)

  useEffect(() => {
    return () => {
      clearInterval(timer.current)
      cancelAnimationFrame(animFrame.current)
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
      mediaRecorder.current?.stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const animateWaveform = useCallback(() => {
    if (!analyser.current) return
    const data = new Uint8Array(analyser.current.frequencyBinCount)
    analyser.current.getByteFrequencyData(data)
    const step = Math.floor(data.length / WAVEFORM_BARS)
    const newBars = Array.from({ length: WAVEFORM_BARS }, (_, i) => {
      const slice = data.slice(i * step, (i + 1) * step)
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length
      return Math.max(0.08, avg / 255)
    })
    setBars(newBars)
    barsSnapshot.current = newBars
    animFrame.current = requestAnimationFrame(animateWaveform)
  }, [])

  const stopRecording = useCallback(() => {
    clearInterval(timer.current)
    cancelAnimationFrame(animFrame.current)
    mediaRecorder.current?.stop()
    mediaRecorder.current?.stream?.getTracks().forEach(t => t.stop())
  }, [])

  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      analyser.current = ctx.createAnalyser()
      analyser.current.fftSize = 256
      source.connect(analyser.current)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/mp4'

      mediaRecorder.current = new MediaRecorder(stream, { mimeType })
      audioChunks.current = []

      mediaRecorder.current.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.current.push(e.data)
      }
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: mimeType })
        audioBlob.current = blob
        audioUrl.current = URL.createObjectURL(blob)
        setPhase('preview')
      }

      mediaRecorder.current.start(100)
      setPhase('recording')
      setDuration(0)
      durationRef.current = 0

      timer.current = setInterval(() => {
        durationRef.current += 1
        setDuration(durationRef.current)
        if (durationRef.current >= MAX_DURATION) stopRecording()
      }, 1000)

      animateWaveform()
    } catch (err) {
      setError('Microphone access denied. Allow microphone in your browser settings.')
    }
  }

  const sendVoiceNote = async () => {
    if (!audioBlob.current) return
    setPhase('sending')
    setError(null)
    try {
      const ext = audioBlob.current.type.includes('mp4') ? 'mp4' : 'webm'
      const path = `${senderId}/${conversationId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('voice-notes')
        .upload(path, audioBlob.current, { contentType: audioBlob.current.type })

      if (uploadError) throw uploadError

      const { data: msg, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: '🎙️ Voice note',
          message_type: 'voice',
          audio_url: path,
          audio_duration: durationRef.current,
          transcript_status: 'pending',
        })
        .select()
        .single()

      if (msgError) throw msgError

      // Update conversation last_message
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString(), last_message: '🎙️ Voice note' })
        .eq('id', conversationId)

      // Fire transcription in background — don't block UI
      supabase.functions.invoke('transcribe-voice-note', {
        body: { messageId: msg.id, audioPath: path },
      }).catch(() => {})

      onSent && onSent(msg)
    } catch (err) {
      console.error('Voice send failed:', err)
      setError('Failed to send. Try again.')
      setPhase('preview')
    }
  }

  const discard = () => {
    clearInterval(timer.current)
    cancelAnimationFrame(animFrame.current)
    mediaRecorder.current?.stream?.getTracks().forEach(t => t.stop())
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    audioBlob.current = null
    audioUrl.current = null
    durationRef.current = 0
    setDuration(0)
    setBars(Array(WAVEFORM_BARS).fill(0.1))
    setPhase('idle')
    onCancel && onCancel()
  }

  return (
    <div style={s.wrap}>
      {error && <p style={s.error}>{error}</p>}

      {phase === 'idle' && (
        <button style={s.micBtn} onClick={startRecording} title="Record voice note">
          <MicIcon />
        </button>
      )}

      {phase === 'recording' && (
        <div style={s.row}>
          <button style={s.iconBtn} onClick={discard} title="Cancel"><TrashIcon /></button>
          <div style={s.waveWrap}>
            {bars.map((h, i) => (
              <div key={i} style={{ ...s.bar, height: Math.max(3, h * 32) + 'px', opacity: 0.5 + h * 0.5 }} />
            ))}
          </div>
          <span style={s.timer}>{formatTime(duration)}</span>
          <button style={{ ...s.iconBtn, background: '#ef4444' }} onClick={stopRecording} title="Stop">
            <StopIcon />
          </button>
        </div>
      )}

      {phase === 'preview' && (
        <div style={s.row}>
          <button style={s.iconBtn} onClick={discard} title="Discard"><TrashIcon /></button>
          <audio src={audioUrl.current} controls style={s.audio} />
          <span style={s.timer}>{formatTime(durationRef.current)}</span>
          <button style={{ ...s.iconBtn, background: '#7C6FF7' }} onClick={sendVoiceNote} title="Send">
            <SendIcon />
          </button>
        </div>
      )}

      {phase === 'sending' && (
        <div style={s.row}>
          <div style={s.spinner} />
          <span style={s.timer}>Sending…</span>
        </div>
      )}
    </div>
  )
}

const MicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/>
    <line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
  </svg>
)
const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>
)
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)

const s = {
  wrap: { display: 'flex', alignItems: 'center', gap: 8, width: '100%' },
  row: { display: 'flex', alignItems: 'center', gap: 8, width: '100%' },
  micBtn: {
    width: 40, height: 40, borderRadius: '50%', border: 'none',
    background: '#7C6FF7', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: '50%', border: 'none',
    background: 'rgba(255,255,255,0.1)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  waveWrap: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 36, overflow: 'hidden',
  },
  bar: {
    flex: 1, background: '#7C6FF7', borderRadius: 2, minWidth: 2,
    transition: 'height 0.05s ease',
  },
  timer: { fontSize: 12, color: '#999', minWidth: 36, textAlign: 'right', flexShrink: 0 },
  audio: { flex: 1, height: 30, minWidth: 0 },
  error: { color: '#ef4444', fontSize: 12, margin: '0 0 4px' },
  spinner: {
    width: 20, height: 20, border: '2px solid rgba(124,111,247,0.2)',
    borderTop: '2px solid #7C6FF7', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', flexShrink: 0,
  },
}
