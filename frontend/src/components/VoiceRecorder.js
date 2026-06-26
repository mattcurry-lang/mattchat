import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const BARS = 28

export default function VoiceRecorder({ conversationId, senderId, onSent, onCancel }) {
  const [state, setState] = useState('idle') // idle | recording | preview
  const [seconds, setSeconds] = useState(0)
  const [bars, setBars] = useState(Array(BARS).fill(8))
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [sending, setSending] = useState(false)

  const mediaRecRef  = useRef(null)
  const chunksRef    = useRef([])
  const timerRef     = useRef(null)
  const analyserRef  = useRef(null)
  const animFrameRef = useRef(null)
  const streamRef    = useRef(null)

  useEffect(() => () => cleanup(), [])

  function cleanup() {
    clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  function animateBars() {
    if (!analyserRef.current) return
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)
    const slice = Math.floor(data.length / BARS)
    setBars(
      Array.from({ length: BARS }, (_, i) => {
        const avg = data.slice(i * slice, (i + 1) * slice).reduce((a, b) => a + b, 0) / slice
        return Math.max(8, Math.min(100, avg * 1.2))
      })
    )
    animFrameRef.current = requestAnimationFrame(animateBars)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      // Set up analyser for live waveform
      const ctx      = new AudioContext()
      const src      = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      src.connect(analyser)
      analyserRef.current = analyser

      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        setState('preview')
      }
      rec.start(100)
      mediaRecRef.current = rec

      setState('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
      animateBars()
    } catch {
      alert('Microphone access denied.')
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    mediaRecRef.current?.stop()
  }

  function discard() {
    cleanup()
    setAudioBlob(null)
    setAudioUrl(null)
    setState('idle')
    setSeconds(0)
    setBars(Array(BARS).fill(8))
    onCancel()
  }

  async function send() {
    if (!audioBlob || sending) return
    setSending(true)
    try {
      const filename = `${senderId}/${Date.now()}.webm`
      const { error: upErr } = await supabase.storage
        .from('voice-notes')
        .upload(filename, audioBlob, { contentType: 'audio/webm' })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage
        .from('voice-notes')
        .getPublicUrl(filename)

      const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: '',
          message_type: 'voice',
          audio_url: publicUrl,
          audio_duration: seconds,
          transcript_status: 'pending',
        })
        .select()
        .single()
      if (msgErr) throw msgErr

      // Trigger transcription (fire and forget)
      supabase.functions.invoke('transcribe-voice-note', {
        body: { messageId: msg.id, audioUrl: publicUrl },
      }).catch(() => {})

      onSent()
    } catch (err) {
      alert('Failed to send voice note.')
      setSending(false)
    }
  }

  function fmt(s) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  }

  // ── IDLE: just the mic button ──
  if (state === 'idle') {
    return (
      <button
        className="attach-btn"
        onClick={startRecording}
        title="Record voice note"
        style={{ fontSize: 20 }}
      >
        🎙️
      </button>
    )
  }

  // ── RECORDING ──
  if (state === 'recording') {
    return (
      <div className="voice-recorder">
        <div className="rec-dot" />
        <span className="rec-time">{fmt(seconds)}</span>
        <div className="rec-waves">
          {bars.map((h, i) => (
            <div
              key={i}
              className="rec-wave-bar"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <button
          className="attach-btn"
          onClick={stopRecording}
          title="Stop recording"
          style={{ fontSize: 18, background: 'rgba(248,113,113,0.15)', borderColor: 'rgba(248,113,113,0.4)', color: '#f87171' }}
        >
          ⏹
        </button>
      </div>
    )
  }

  // ── PREVIEW ──
  return (
    <div className="voice-recorder" style={{ borderColor: 'rgba(108,99,255,0.3)' }}>
      <audio src={audioUrl} controls style={{ flex: 1, height: 32, borderRadius: 8 }} />
      <span className="rec-time" style={{ color: '#a78bfa' }}>{fmt(seconds)}</span>
      <button
        className="attach-btn"
        onClick={discard}
        title="Discard"
        style={{ fontSize: 18, color: '#f87171' }}
      >
        🗑
      </button>
      <button
        className="send-btn"
        onClick={send}
        disabled={sending}
        style={{ fontSize: 16 }}
      >
        {sending ? '…' : '➤'}
      </button>
    </div>
  )
}
