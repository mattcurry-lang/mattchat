import React, { useCallback, useEffect, useRef, useState } from 'react'

/* ── formatting ─────────────────────────────────────────────── */
export function fmt(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function fmtMs(ms) {
  const total = Math.max(0, ms) / 1000
  const m = Math.floor(total / 60)
  const s = Math.floor(total % 60)
  const t = Math.floor((total * 10) % 10)
  return `${m}:${String(s).padStart(2, '0')}.${t}`
}

/* ── waveform data ──────────────────────────────────────────── */

// Stable, natural-looking fake waveform for messages that have no stored peaks
export function seededPeaks(seed = '', n = 40) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
  let prev = 0.5
  return Array.from({ length: n }, (_, i) => {
    prev = prev * 0.55 + rand() * 0.45 // neighbours stay related
    const envelope = 0.55 + Math.sin((i / (n - 1)) * Math.PI) * 0.45
    return Math.max(0.14, Math.min(1, prev * 1.25 * envelope))
  })
}

// Accepts stored peaks (0..1 or 0..100) and returns 0..1, or null if unusable
export function normalizePeaks(raw) {
  if (!Array.isArray(raw)) return null
  const nums = raw.map(Number).filter(Number.isFinite)
  if (nums.length < 4) return null
  const scale = Math.max(...nums) > 1 ? 100 : 1
  return nums.map(n => Math.max(0.14, Math.min(1, n / scale)))
}

// Squeeze a long list of live levels down to n bars (loudest value per bucket)
export function resamplePeaks(peaks, n) {
  if (!peaks.length) return Array(n).fill(0.14)
  const out = []
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i / n) * peaks.length)
    const b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length))
    let m = 0
    for (let k = a; k < b && k < peaks.length; k++) m = Math.max(m, peaks[k])
    out.push(m)
  }
  const top = Math.max(...out) || 1
  return out.map(v => Math.max(0.14, Math.min(1, (v / top) * 0.95 + 0.05)))
}

/* ── icons ──────────────────────────────────────────────────── */
const SOLID = { fill: 'currentColor', stroke: 'none' }
const PATHS = {
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" {...SOLID} />,
  play: <path d="M8.5 5.5v13l10.5-6.5z" {...SOLID} />,
  pause: (
    <>
      <rect x="6.5" y="5" width="4" height="14" rx="1.3" {...SOLID} />
      <rect x="13.5" y="5" width="4" height="14" rx="1.3" {...SOLID} />
    </>
  ),
  send: <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />,
  chevron: <path d="M14.5 6l-6 6 6 6" />,
  lines: <path d="M4 7h16M4 12h16M4 17h10" />,
}

export function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      className={`vn-ico ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

/* ── scrubbable waveform ────────────────────────────────────── */
export function VoiceWave({ peaks, progress = 0, playing = false, onSeek }) {
  const ref = useRef(null)
  const dragging = useRef(false)

  const pctFrom = (e) => {
    const r = ref.current.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }
  const down = (e) => {
    if (!onSeek) return
    dragging.current = true
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ }
    onSeek(pctFrom(e))
  }
  const move = (e) => { if (dragging.current && onSeek) onSeek(pctFrom(e)) }
  const up = () => { dragging.current = false }
  const key = (e) => {
    if (!onSeek) return
    if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(Math.min(1, progress + 0.05)) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(Math.max(0, progress - 0.05)) }
  }

  const played = Math.round(progress * peaks.length)
  const last = Math.max(1, peaks.length - 1)

  return (
    <div
      ref={ref}
      className={`vn-wave${playing ? ' is-playing' : ''}${progress > 0 ? ' has-progress' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      {peaks.map((p, i) => (
        <span
          key={i}
          className={`vn-bar${i < played ? ' is-played' : ''}`}
          style={{ '--h': p, '--t': i / last }}
        />
      ))}
      <span className="vn-head" style={{ left: `${progress * 100}%` }} />
    </div>
  )
}

/* ── audio player hook ──────────────────────────────────────── */
const RATES = [1, 1.5, 2]
let activeStop = null // only one voice note plays at a time

export function useAudioPlayer(src, knownDuration = 0) {
  const audioRef = useRef(null)
  const rafRef = useRef(0)
  const durRef = useRef(knownDuration)
  const rateRef = useRef(1)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(knownDuration)
  const [rate, setRate] = useState(1)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    durRef.current = knownDuration
    setDuration(knownDuration)
  }, [knownDuration])

  const stopSelf = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    audioRef.current?.pause()
    setPlaying(false)
  }, [])

  // new source (or unmount): drop the old audio element
  useEffect(() => {
    setPlaying(false)
    setProgress(0)
    setFailed(false)
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
      if (activeStop === stopSelf) activeStop = null
    }
  }, [src, stopSelf])

  // recorded webm blobs often report Infinity as duration, so fall back to what we measured
  const totalOf = (a) => (isFinite(a.duration) && a.duration > 0 ? a.duration : durRef.current)

  function tick() {
    const a = audioRef.current
    if (!a) return
    const total = totalOf(a)
    setProgress(total ? Math.min(1, a.currentTime / total) : 0)
    if (!a.paused) rafRef.current = requestAnimationFrame(tick)
  }

  function ensure() {
    if (audioRef.current) return audioRef.current
    const a = new Audio(src)
    a.preload = 'metadata'
    a.playbackRate = rateRef.current
    a.onloadedmetadata = () => {
      if (isFinite(a.duration) && a.duration > 0) { durRef.current = a.duration; setDuration(a.duration) }
    }
    a.onplay = () => setPlaying(true)
    a.onpause = () => setPlaying(false)
    a.onended = () => { cancelAnimationFrame(rafRef.current); setPlaying(false); setProgress(0) }
    a.onerror = () => { setFailed(true); setPlaying(false) }
    audioRef.current = a
    return a
  }

  const toggle = async () => {
    if (!src) return
    const a = ensure()
    if (!a.paused) { stopSelf(); return }
    if (activeStop && activeStop !== stopSelf) activeStop()
    activeStop = stopSelf
    try {
      setFailed(false)
      await a.play()
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setFailed(true)
      setPlaying(false)
    }
  }

  const seek = (pct) => {
    if (!src) return
    const a = ensure()
    const total = totalOf(a)
    if (!total) return
    a.currentTime = pct * total
    setProgress(pct)
  }

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]
    rateRef.current = next
    setRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  return { playing, progress, duration, current: progress * duration, rate, failed, toggle, seek, cycleRate }
}
