import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './VoiceNotes.css'
import { Icon, VoiceWave, useAudioPlayer, fmt, fmtMs, resamplePeaks } from './voiceShared'
import { VOICE_FX, processVoice } from './voiceFx'

/*
  Hybrid recording:
    • HOLD the mic     → records while you hold, release to send, slide left to cancel
    • TAP the mic      → hands-free; stop, preview, then send (or discard)
*/

const MAX_MS = 5 * 60 * 1000 // auto-stop at 5 minutes
const MIN_MS = 600           // anything shorter is treated as an accident
const TAP_MS = 350           // a press shorter than this counts as a tap
const CANCEL_PX = 80         // slide-left distance that cancels
const PREVIEW_BARS = 44
const PEAK_EVERY_MS = 70

// Flip to true after adding a jsonb column `audio_waveform` to `messages`.
// Then the real waveform of each note is stored and shown in chat (VoiceMessage reads it automatically).
//   alter table messages add column audio_waveform jsonb;
const SAVE_WAVEFORM = false

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
const pickMime = () =>
  typeof MediaRecorder === 'undefined'
    ? ''
    : MIME_CANDIDATES.find(t => MediaRecorder.isTypeSupported(t)) || ''
const extFor = (type) =>
  type.includes('wav') ? 'wav' : type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'

export default function VoiceRecorder({ conversationId, senderId, onSent, onCancel }) {
  const [stage, setStage] = useState('idle') // idle | recording | preview | sending
  const [mode, setMode] = useState('hold')   // hold | locked (only while recording)
  const [elapsed, setElapsed] = useState(0)
  const [drag, setDrag] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [durationSec, setDurationSec] = useState(0)
  const [previewPeaks, setPreviewPeaks] = useState([])
  const [notice, setNotice] = useState(null)
  const [fx, setFx] = useState('original')   // selected voice
  const [fxBusy, setFxBusy] = useState(null) // voice being rendered right now

  // logic lives in refs so window-level gesture listeners never see stale state
  const stageRef = useRef('idle')
  const modeRef = useRef('hold')
  const startingRef = useRef(false)
  const mountedRef = useRef(true)
  const propsRef = useRef({})
  propsRef.current = { conversationId, senderId, onSent, onCancel }

  const gestureRef = useRef(null)
  const detachRef = useRef(null)
  const mediaRecRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)
  const bufRef = useRef(null)
  const mimeRef = useRef('')
  const timerRef = useRef(null)
  const rafRef = useRef(0)
  const lastPushRef = useRef(0)
  const startedAtRef = useRef(0)
  const peaksRef = useRef([])
  const levelRef = useRef(0)
  const cancelledRef = useRef(false)
  const autoSendRef = useRef(false)
  const urlRef = useRef(null)
  const noticeTimer = useRef(null)
  const canvasRef = useRef(null)
  const stripRef = useRef(null)
  const colorsRef = useRef({ brand: '#7c6ff7', signal: '#38e1ff' })
  const origRef = useRef(null)         // the untouched recording { blob, secs, peaks }
  const fxCacheRef = useRef(new Map()) // voice id -> rendered { blob, secs, peaks }
  const fxJobRef = useRef(0)           // bumps on reset so late results are ignored
  const autoplayRef = useRef(false)

  const player = useAudioPlayer(audioUrl, durationSec)

  // after picking a voice, play it straight away so people hear the change
  useEffect(() => {
    if (autoplayRef.current && audioUrl) {
      autoplayRef.current = false
      player.toggle()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cancelledRef.current = true
      detachRef.current?.()
      stopTimers()
      const rec = mediaRecRef.current
      if (rec && rec.state !== 'inactive') { try { rec.stop() } catch { /* noop */ } }
      releaseMedia()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      clearTimeout(noticeTimer.current)
    }
  }, [])

  /* ── small helpers ─────────────────────────────────────────── */
  function go(next) { stageRef.current = next; setStage(next) }
  function setModeBoth(next) { modeRef.current = next; setMode(next) }

  function flash(msg) {
    setNotice(msg)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => mountedRef.current && setNotice(null), 4200)
  }

  function stopTimers() {
    clearInterval(timerRef.current)
    cancelAnimationFrame(rafRef.current)
  }

  function releaseMedia() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    try { ctxRef.current?.close() } catch { /* noop */ }
    ctxRef.current = null
    analyserRef.current = null
    mediaRecRef.current = null
  }

  function clearAudio() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setAudioBlob(null)
    setAudioUrl(null)
    setPreviewPeaks([])
    setDurationSec(0)
  }

  function setBlob(blob, secs, peaks) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(blob)
    setAudioBlob(blob)
    setAudioUrl(urlRef.current)
    setDurationSec(secs)
    setPreviewPeaks(peaks)
  }

  /* ── live waveform (canvas, no React re-render per frame) ───── */
  function drawWave() {
    const c = canvasRef.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = c.clientWidth
    const h = c.clientHeight
    if (!w || !h) return
    const pw = Math.round(w * dpr)
    const ph = Math.round(h * dpr)
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph }

    const g = c.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)

    const { brand, signal } = colorsRef.current
    const step = 6
    const bw = 3
    const n = Math.floor(w / step)
    const peaks = peaksRef.current

    const fill = g.createLinearGradient(0, 0, w, 0)
    fill.addColorStop(0, brand)
    fill.addColorStop(1, signal)
    g.fillStyle = fill
    g.shadowColor = signal
    g.shadowBlur = 8
    g.beginPath()
    for (let k = 0; k < n; k++) {
      const idx = peaks.length - 1 - k // newest bar sits at the right edge
      const v = idx >= 0 ? peaks[idx] : 0.04
      const bh = Math.max(3, v * h * 0.92)
      const x = w - (k + 1) * step + (step - bw) / 2
      if (g.roundRect) g.roundRect(x, (h - bh) / 2, bw, bh, 1.5)
      else g.rect(x, (h - bh) / 2, bw, bh)
    }
    g.fill()

    // fade the oldest bars out on the left
    g.shadowBlur = 0
    g.globalCompositeOperation = 'destination-in'
    const mask = g.createLinearGradient(0, 0, w, 0)
    mask.addColorStop(0, 'rgba(0,0,0,0)')
    mask.addColorStop(0.35, 'rgba(0,0,0,1)')
    g.fillStyle = mask
    g.fillRect(0, 0, w, h)
    g.globalCompositeOperation = 'source-over'
  }

  function loop() {
    const an = analyserRef.current
    if (!an) return
    an.getByteTimeDomainData(bufRef.current)
    let sum = 0
    for (let i = 0; i < bufRef.current.length; i++) {
      const x = (bufRef.current[i] - 128) / 128
      sum += x * x
    }
    const level = Math.min(1, Math.sqrt(sum / bufRef.current.length) * 3.2)
    levelRef.current = levelRef.current * 0.6 + level * 0.4
    stripRef.current?.style.setProperty('--lvl', levelRef.current.toFixed(3))

    const now = performance.now()
    if (now - lastPushRef.current > PEAK_EVERY_MS) {
      peaksRef.current.push(Math.max(0.05, levelRef.current))
      lastPushRef.current = now
    }
    drawWave()
    rafRef.current = requestAnimationFrame(loop)
  }

  /* ── gesture: hold or tap ──────────────────────────────────── */
  function beginGesture(e) {
    if (stageRef.current !== 'idle' || startingRef.current) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // touch pointers are captured by the button, which is about to unmount
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* noop */ }

    const now = performance.now()
    gestureRef.current = { downAt: now, t0: now, upAt: 0, x0: e.clientX, dx: 0, released: false, interrupted: false }

    const onMove = (ev) => {
      const g = gestureRef.current
      if (!g) return
      g.dx = ev.clientX - g.x0
      if (modeRef.current === 'hold' && stageRef.current === 'recording') setDrag(g.dx)
    }
    const onUp = (ev) => {
      const g = gestureRef.current
      detachRef.current?.()
      if (!g) return
      g.released = true
      g.upAt = performance.now()
      g.interrupted = ev.type === 'pointercancel'
      if (stageRef.current === 'recording') resolveRelease()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    detachRef.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      detachRef.current = null
    }

    startRecording()
  }

  function resolveRelease() {
    const g = gestureRef.current
    gestureRef.current = null
    if (!g || modeRef.current !== 'hold') return
    setDrag(0)
    const held = g.upAt - g.t0
    if (g.interrupted || held < TAP_MS) { setModeBoth('locked'); return } // a tap → hands-free
    if (g.dx < -CANCEL_PX) { discard(); return }                          // slid away → cancel
    autoSendRef.current = true                                            // held and released → send
    stopRecording()
  }

  /* ── record / stop ─────────────────────────────────────────── */
  async function startRecording() {
    if (stageRef.current !== 'idle' || startingRef.current) return
    startingRef.current = true
    setNotice(null)

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      startingRef.current = false
      detachRef.current?.()
      gestureRef.current = null
      flash('Microphone is blocked. Allow access in your browser settings.')
      return
    }
    if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }

    streamRef.current = stream
    chunksRef.current = []
    peaksRef.current = []
    levelRef.current = 0
    cancelledRef.current = false
    autoSendRef.current = false

    const css = getComputedStyle(document.documentElement)
    colorsRef.current = { brand: css.getPropertyValue('--brand').trim() || '#7c6ff7', signal: '#38e1ff' }

    // analyser drives the live waveform and the orb glow
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC()
    ctx.resume?.()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analyser)
    ctxRef.current = ctx
    analyserRef.current = analyser
    bufRef.current = new Uint8Array(analyser.fftSize)

    const mime = pickMime()
    mimeRef.current = mime
    let rec
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    } catch {
      releaseMedia()
      startingRef.current = false
      detachRef.current?.()
      gestureRef.current = null
      flash("This browser can't record audio.")
      return
    }
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = handleStop
    rec.start(250)
    mediaRecRef.current = rec
    startedAtRef.current = Date.now()

    // if a long wait (permission prompt) or no pointer is involved, nobody is holding the button
    const g = gestureRef.current
    const nobodyHolding = !g || performance.now() - g.downAt > 600
    setModeBoth(nobodyHolding ? 'locked' : 'hold')
    if (g) g.t0 = performance.now()

    setElapsed(0)
    setDrag(0)
    go('recording')
    startingRef.current = false

    timerRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current
      setElapsed(ms)
      if (ms >= MAX_MS) { autoSendRef.current = false; stopRecording() }
    }, 100)
    lastPushRef.current = 0
    loop()

    if (g?.released) resolveRelease() // finger already lifted while we were starting
  }

  function stopRecording() {
    stopTimers()
    const rec = mediaRecRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }

  function handleStop() {
    const ms = Date.now() - startedAtRef.current
    const type = mediaRecRef.current?.mimeType || mimeRef.current || 'audio/webm'
    const chunks = chunksRef.current
    releaseMedia()
    if (!mountedRef.current || cancelledRef.current) return

    if (ms < MIN_MS) {
      resetToIdle()
      flash('Too short. Hold a little longer.')
      return
    }
    const blob = new Blob(chunks, { type })
    const secs = Math.max(1, Math.round(ms / 1000))
    const peaks = resamplePeaks(peaksRef.current, PREVIEW_BARS)

    if (autoSendRef.current) {
      autoSendRef.current = false
      sendBlob(blob, secs, peaks)
      return
    }
    origRef.current = { blob, secs, peaks }
    setBlob(blob, secs, peaks)
    go('preview')
  }

  function resetToIdle() {
    fxJobRef.current++
    origRef.current = null
    fxCacheRef.current.clear()
    setFx('original')
    setFxBusy(null)
    clearAudio()
    setModeBoth('hold')
    setDrag(0)
    setElapsed(0)
    go('idle')
  }

  function discard() {
    cancelledRef.current = true
    detachRef.current?.()
    gestureRef.current = null
    stopTimers()
    const rec = mediaRecRef.current
    if (rec && rec.state !== 'inactive') { try { rec.stop() } catch { /* noop */ } }
    releaseMedia()
    resetToIdle()
    propsRef.current.onCancel && propsRef.current.onCancel()
  }

  /* ── voice changer ─────────────────────────────────────────── */
  function showVersion(id, out) {
    autoplayRef.current = true
    setBlob(out.blob, out.secs, out.peaks)
    setFx(id)
  }

  async function applyFx(id) {
    const orig = origRef.current
    if (!orig || fxBusy || id === fx) return
    if (id === 'original') { showVersion(id, orig); return }
    const cached = fxCacheRef.current.get(id)
    if (cached) { showVersion(id, cached); return }

    const job = fxJobRef.current
    setFxBusy(id)
    setNotice(null)
    try {
      const out = await processVoice(orig.blob, id)
      if (!mountedRef.current || job !== fxJobRef.current) return
      fxCacheRef.current.set(id, out)
      showVersion(id, out)
    } catch (err) {
      console.error('voice changer failed:', err)
      if (mountedRef.current && job === fxJobRef.current) flash("Couldn't change the voice. Try another one.")
    } finally {
      if (mountedRef.current && job === fxJobRef.current) setFxBusy(null)
    }
  }

  /* ── send ──────────────────────────────────────────────────── */
  async function sendBlob(blob, secs, peaks) {
    const { conversationId: convId, senderId: uid, onSent: done } = propsRef.current
    go('sending')
    try {
      const type = (blob.type || 'audio/webm').split(';')[0]
      const filename = `${uid}/${Date.now()}.${extFor(type)}`
      const { error: upErr } = await supabase.storage
        .from('voice-notes')
        .upload(filename, blob, { contentType: type })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage
        .from('voice-notes')
        .getPublicUrl(filename)

      const row = {
        conversation_id: convId,
        sender_id: uid,
        content: '',
        message_type: 'voice',
        audio_url: publicUrl,
        audio_duration: secs,
        transcript_status: 'pending',
      }
      if (SAVE_WAVEFORM) row.audio_waveform = peaks.map(p => Math.round(p * 100))

      const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert(row)
        .select()
        .single()
      if (msgErr) throw msgErr

      // Trigger transcription (fire and forget)
      supabase.functions.invoke('transcribe-voice-note', {
        body: { messageId: msg.id, audioUrl: publicUrl },
      }).catch(() => {})

      if (mountedRef.current) resetToIdle()
      done && done(msg)
    } catch (err) {
      console.error('voice note send failed:', err)
      if (!mountedRef.current) return
      // keep the recording so nothing is lost: back to preview with a retry
      if (!urlRef.current) setBlob(blob, secs, peaks)
      if (!origRef.current) origRef.current = { blob, secs, peaks }
      go('preview')
      flash("Couldn't send. Check your connection and try again.")
    }
  }

  /* ── render ────────────────────────────────────────────────── */
  const toast = notice ? <div className="vn-notice" role="status">{notice}</div> : null

  if (stage === 'idle') {
    return (
      <div className="vn vn-idle">
        {toast}
        <button
          type="button"
          className="vn-orb is-idle"
          aria-label="Record voice note. Hold to record, tap for hands-free."
          title="Hold to record · tap for hands-free"
          onPointerDown={beginGesture}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startRecording() }
          }}
          onContextMenu={e => e.preventDefault()}
        >
          <Icon name="mic" />
        </button>
      </div>
    )
  }

  if (stage === 'recording') {
    const locked = mode === 'locked'
    const p = locked ? 0 : Math.min(1, Math.max(0, -drag / CANCEL_PX))
    const cancelling = !locked && p >= 1
    return (
      <div
        ref={stripRef}
        className={`vn vn-strip is-recording${cancelling ? ' is-cancel' : ''}`}
        style={{ '--p': p }}
      >
        {toast}
        {locked ? (
          <button type="button" className="vn-icon-btn is-danger" onClick={() => discard()} aria-label="Discard recording">
            <Icon name="trash" />
          </button>
        ) : (
          <span className="vn-slide" aria-hidden="true">
            <Icon name="chevron" size={16} />
            <span>{cancelling ? 'Release to cancel' : 'Slide to cancel'}</span>
          </span>
        )}

        <span className="vn-time"><i className="vn-live-dot" />{fmtMs(elapsed)}</span>
        <canvas ref={canvasRef} className="vn-canvas" aria-hidden="true" />

        <span className="vn-orbwrap">
          <span className="vn-halo" />
          {locked ? (
            <button type="button" className="vn-orb is-stop" onClick={stopRecording} aria-label="Stop recording">
              <Icon name="stop" />
            </button>
          ) : (
            <span className="vn-orb" aria-hidden="true"><Icon name="mic" /></span>
          )}
        </span>
      </div>
    )
  }

  if (stage === 'sending') {
    return (
      <div className="vn vn-strip is-sending" role="status">
        <span className="vn-spinner" />
        <span className="vn-shimmer">Sending voice note…</span>
      </div>
    )
  }

  // preview
  const shown = player.playing || player.progress > 0 ? player.current : durationSec
  return (
    <div className="vn vn-strip is-preview">
      {toast}
      <div className="vn-fx" role="radiogroup" aria-label="Voice changer" aria-busy={!!fxBusy}>
        {VOICE_FX.map(v => (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={fx === v.id}
            className={`vn-chip${fx === v.id ? ' is-on' : ''}`}
            disabled={!!fxBusy && fxBusy !== v.id}
            onClick={() => applyFx(v.id)}
          >
            {fxBusy === v.id && <span className="vn-spinner is-sm" />}
            {v.label}
          </button>
        ))}
      </div>
      <button type="button" className="vn-icon-btn is-danger" onClick={() => discard()} aria-label="Discard recording">
        <Icon name="trash" />
      </button>
      <button
        type="button"
        className={`vn-play${player.playing ? ' is-on' : ''}`}
        onClick={player.toggle}
        aria-label={player.playing ? 'Pause preview' : 'Play preview'}
      >
        <span className="vn-ring" />
        <Icon name={player.playing ? 'pause' : 'play'} size={18} />
      </button>
      <VoiceWave peaks={previewPeaks} progress={player.progress} playing={player.playing} onSeek={player.seek} />
      <span className="vn-time is-dim">{fmt(shown)}</span>
      <button
        type="button"
        className="vn-orb"
        onClick={() => sendBlob(audioBlob, durationSec, previewPeaks)}
        disabled={!!fxBusy}
        aria-label="Send voice note"
      >
        <Icon name="send" />
      </button>
    </div>
  )
}
