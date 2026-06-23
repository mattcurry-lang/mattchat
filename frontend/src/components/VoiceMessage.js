import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

function seededBars(seed, count = 28) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  return Array.from({ length: count }, (_, i) => {
    h = (Math.imul(1664525, h) + 1013904223) | 0
    const v = ((h >>> 0) % 75) / 100 + 0.15
    const edge = Math.min(i, count - 1 - i) / (count * 0.3)
    return Math.min(1, v * Math.min(1, edge + 0.4))
  })
}

export default function VoiceMessage({ message, isMe }) {
  const [audioSrc, setAudioSrc] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const audioEl = useRef(null)
  const bars = seededBars(message.id)

  useEffect(() => {
    if (!message.audio_url) return
    supabase.storage.from('voice-notes').createSignedUrl(message.audio_url, 3600)
      .then(({ data, error }) => {
        if (error || !data?.signedUrl) { setLoadError(true); return }
        setAudioSrc(data.signedUrl)
      })
  }, [message.audio_url])

  useEffect(() => {
    const el = audioEl.current
    if (!el) return
    const onTime = () => {
      setCurrentTime(el.currentTime)
      setProgress(el.duration ? el.currentTime / el.duration : 0)
    }
    const onEnd = () => { setPlaying(false); setProgress(0); setCurrentTime(0); el.currentTime = 0 }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnd)
    return () => { el.removeEventListener('timeupdate', onTime); el.removeEventListener('ended', onEnd) }
  }, [audioSrc])

  const togglePlay = async () => {
    const el = audioEl.current
    if (!el || loadError) return
    if (playing) { el.pause(); setPlaying(false) }
    else {
      try { await el.play(); setPlaying(true) }
      catch { setLoadError(true) }
    }
  }

  const seek = e => {
    const el = audioEl.current
    if (!el || !el.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    el.currentTime = ratio * el.duration
    setProgress(ratio)
  }

  const totalDuration = audioEl.current?.duration || message.audio_duration || 0
  const displayTime = (playing || progress > 0) ? currentTime : totalDuration
  const accent = isMe ? '#c4b5fd' : '#7C6FF7'

  return (
    <div style={{ ...s.bubble, background: isMe ? '#3730a3' : '#1e1b4b' }}>
      {audioSrc && <audio ref={audioEl} src={audioSrc} preload="metadata" />}

      <div style={s.row}>
        <button
          style={{ ...s.playBtn, background: accent }}
          onClick={togglePlay}
          disabled={!audioSrc || loadError}
        >
          {loadError ? '!' : playing ? '⏸' : '▶'}
        </button>

        <div style={s.track} onClick={seek}>
          {bars.map((h, i) => {
            const filled = i / bars.length < progress
            return (
              <div key={i} style={{
                ...s.bar,
                height: Math.max(3, h * 26) + 'px',
                background: filled ? accent : 'rgba(255,255,255,0.15)',
              }} />
            )
          })}
        </div>

        <span style={s.time}>{formatTime(displayTime)}</span>
      </div>

      {message.transcript_status === 'done' && message.transcript && (
        <div style={s.transcriptWrap}>
          <button style={s.toggle} onClick={() => setShowTranscript(v => !v)}>
            {showTranscript ? 'Hide transcript' : 'Show transcript'}
          </button>
          {showTranscript && <p style={s.transcriptText}>{message.transcript}</p>}
        </div>
      )}
      {message.transcript_status === 'processing' && (
        <p style={s.meta}>Transcribing…</p>
      )}
    </div>
  )
}

const s = {
  bubble: { borderRadius: 16, padding: '10px 12px', maxWidth: 260, minWidth: 180 },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  playBtn: {
    width: 34, height: 34, borderRadius: '50%', border: 'none',
    cursor: 'pointer', color: 'white', fontSize: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  track: { flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 30, cursor: 'pointer' },
  bar: { flex: 1, borderRadius: 2, minWidth: 2, transition: 'background 0.1s' },
  time: { fontSize: 11, color: 'rgba(255,255,255,0.5)', minWidth: 30, textAlign: 'right', flexShrink: 0 },
  transcriptWrap: { marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 },
  toggle: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' },
  transcriptText: { margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, fontStyle: 'italic' },
  meta: { margin: '6px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)' },
}
