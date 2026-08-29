// AudioPreview.jsx
// Real waveform via Web Audio API — decodes actual peak data from the
// file/URL rather than faking a bar. Renders once, then just drives a
// CSS-based playhead over the static peaks (cheap, no re-render per frame).

import { useState, useRef, useEffect, useCallback } from 'react'

const BAR_COUNT = 48
const SPEEDS = [1, 1.25, 1.5, 2]

function mmss(s) {
  if (!isFinite(s)) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function AudioPreview({ src, filename, compact = false }) {
  const audioRef = useRef(null)
  const [peaks, setPeaks] = useState(null) // number[BAR_COUNT] 0..1
  const [decoding, setDecoding] = useState(true)
  const [decodeError, setDecodeError] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)

  // Decode peaks once per src. This fetches the audio bytes independently
  // of the <audio> element (which streams) so we can read the full buffer.
  useEffect(() => {
    if (!src) return
    let cancelled = false
    setDecoding(true)
    setDecodeError(false)

    ;(async () => {
      try {
        const res = await fetch(src)
        const arrayBuffer = await res.arrayBuffer()
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        const ctx = new AudioCtx()
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        if (cancelled) return

        const raw = audioBuffer.getChannelData(0)
        const blockSize = Math.floor(raw.length / BAR_COUNT)
        const next = []
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0
          const start = i * blockSize
          for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[start + j] || 0)
          next.push(sum / blockSize)
        }
        const max = Math.max(...next, 0.001)
        setPeaks(next.map(v => Math.max(0.08, v / max))) // floor so silence isn't invisible
        ctx.close()
      } catch (e) {
        console.error('[AudioPreview] waveform decode failed:', e)
        if (!cancelled) setDecodeError(true)
      } finally {
        if (!cancelled) setDecoding(false)
      }
    })()

    return () => { cancelled = true }
  }, [src])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrent(audio.currentTime)
    const onMeta = () => setDuration(audio.duration)
    const onEnd = () => { setPlaying(false); setCurrent(0) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnd)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play(); setPlaying(true) }
  }

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const seekTo = useCallback((clientX, trackEl) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = trackEl.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setCurrent(ratio * duration)
  }, [duration])

  const progressRatio = duration ? current / duration : 0

  return (
    <div style={{ ...wrapStyle, minWidth: compact ? 180 : 220 }}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button onClick={togglePlay} style={playBtnStyle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={waveTrackStyle}
          onClick={(e) => seekTo(e.clientX, e.currentTarget)}
        >
          {decoding ? (
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #c9c4dd)' }}>Decoding…</div>
          ) : decodeError || !peaks ? (
            // graceful fallback: flat bars still let seek/play work even
            // if peak decoding failed (e.g. unsupported codec for decodeAudioData)
            Array.from({ length: BAR_COUNT }).map((_, i) => (
              <span key={i} style={{ ...barStyle, height: '35%', opacity: i / BAR_COUNT < progressRatio ? 1 : 0.35 }} />
            ))
          ) : (
            peaks.map((p, i) => (
              <span
                key={i}
                style={{ ...barStyle, height: `${Math.round(p * 100)}%`, opacity: i / BAR_COUNT < progressRatio ? 1 : 0.35 }}
              />
            ))
          )}
        </div>
        <div style={metaRowStyle}>
          <span>{mmss(current)} / {mmss(duration)}</span>
          {filename && !compact && <span style={filenameStyle}>{filename}</span>}
        </div>
      </div>

      <button onClick={cycleSpeed} style={speedBtnStyle}>{speed}x</button>
    </div>
  )
}

function PlayIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
}
function PauseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
}

const wrapStyle = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
  borderRadius: 16, background: 'var(--surface-card, rgba(148,120,255,0.08))',
  border: '1px solid var(--border-subtle, rgba(148,120,255,0.16))',
}
const playBtnStyle = {
  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
  background: 'var(--accent, #7c5cff)', color: '#fff', border: 'none',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const waveTrackStyle = {
  display: 'flex', alignItems: 'flex-end', gap: 2, height: 28, cursor: 'pointer',
}
const barStyle = {
  flex: 1, minWidth: 2, borderRadius: 2, background: 'var(--accent, #a78bfa)', transition: 'opacity 0.1s',
}
const metaRowStyle = {
  display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4,
  fontSize: 10.5, color: 'var(--text-secondary, #c9c4dd)',
}
const filenameStyle = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }
const speedBtnStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #c9c4dd)',
  background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10,
  padding: '4px 8px', cursor: 'pointer', flexShrink: 0,
}
