import React, { useState, useRef, useEffect } from 'react'

// Generate a seeded pseudo-random waveform from a message id
function generateWaveform(seed = '', bars = 32) {
  const heights = []
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  for (let i = 0; i < bars; i++) {
    hash = ((hash << 5) - hash) + i * 2654435761
    hash |= 0
    const val = Math.abs(hash % 100)
    // Shape: taller in the middle, quieter at edges
    const center = Math.sin((i / bars) * Math.PI) * 0.6
    heights.push(Math.max(8, Math.min(90, val * 0.6 + center * 50 + 15)))
  }
  return heights
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function VoiceMessage({ message, isMe }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(message.audio_duration || 0)
  const [showTranscript, setShowTranscript] = useState(false)
  const audioRef = useRef(null)
  const animFrameRef = useRef(null)
  const waveform = generateWaveform(message.id, 32)

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (audioRef.current) audioRef.current.pause()
    }
  }, [])

  function tick() {
    if (!audioRef.current) return
    const pct = audioRef.current.currentTime / (audioRef.current.duration || 1)
    setProgress(pct)
    if (!audioRef.current.paused) {
      animFrameRef.current = requestAnimationFrame(tick)
    }
  }

  async function togglePlay() {
    if (!audioRef.current) {
      audioRef.current = new Audio(message.audio_url)
      audioRef.current.onloadedmetadata = () => setDuration(audioRef.current.duration)
      audioRef.current.onended = () => { setPlaying(false); setProgress(0) }
    }

    if (playing) {
      audioRef.current.pause()
      cancelAnimationFrame(animFrameRef.current)
      setPlaying(false)
    } else {
      await audioRef.current.play()
      setPlaying(true)
      animFrameRef.current = requestAnimationFrame(tick)
    }
  }

  function handleSeek(e) {
    if (!audioRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = pct * audioRef.current.duration
    setProgress(pct)
  }

  const playedBars = Math.floor(progress * waveform.length)
  const currentTime = audioRef.current ? audioRef.current.currentTime : 0

  const accentColor = isMe ? 'rgba(255,255,255,0.9)' : '#6c63ff'
  const dimColor    = isMe ? 'rgba(255,255,255,0.25)' : 'rgba(108,99,255,0.2)'

  return (
    <div className={`msg-bubble ${isMe ? '' : ''}`} style={{ padding: 0, overflow: 'hidden', minWidth: 220 }}>
      <div className="voice-msg">
        {/* Play/Pause */}
        <button
          className="voice-play-btn"
          onClick={togglePlay}
          style={{
            background: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(108,99,255,0.2)',
            color: isMe ? '#fff' : '#a78bfa',
          }}
        >
          {playing ? '⏸' : '▶'}
        </button>

        {/* Waveform */}
        <div
          className="waveform"
          onClick={handleSeek}
          style={{ cursor: 'pointer' }}
        >
          {waveform.map((h, i) => (
            <div
              key={i}
              className={`waveform-bar ${i < playedBars ? 'played' : ''}`}
              style={{
                height: `${h}%`,
                background: i < playedBars ? accentColor : dimColor,
                transition: playing ? 'background 0.1s' : 'none',
              }}
            />
          ))}
        </div>

        {/* Time */}
        <span className="voice-duration" style={{ color: isMe ? 'rgba(255,255,255,0.7)' : '#8891aa' }}>
          {playing ? formatDuration(currentTime) : formatDuration(duration)}
        </span>
      </div>

      {/* Transcript */}
      {message.transcript && (
        <div
          className="voice-transcript"
          onClick={() => setShowTranscript(v => !v)}
          style={{
            color: isMe ? 'rgba(255,255,255,0.6)' : '#8891aa',
            borderTopColor: isMe ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
          }}
        >
          {showTranscript ? message.transcript : '🔤 Show transcript'}
        </div>
      )}
      {message.transcript_status === 'processing' && (
        <div className="voice-transcript" style={{ color: '#8891aa' }}>
          ⏳ Transcribing...
        </div>
      )}
    </div>
  )
}
