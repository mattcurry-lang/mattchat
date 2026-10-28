import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import MemoryVault from './MemoryVault'
import {
  IconSparkle, IconX, IconMic, IconSend, IconTrash, IconFolder, IconMusic, IconFilm, IconBook, IconHeart,
  IconGlobe, IconMessageSquare, IconWand, IconLock, IconHourglass, IconAlertTriangle,
  IconMoreVertical, IconShield,
} from './Icons'

const SUPABASE_URL = 'https://bqerkvywgxoioocbkxif.supabase.co'

export async function callCurryAI(type, payload, session) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/curry-ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ type, ...payload }),
  })
  return res.json()
}

// One voice at a time, always stoppable.
let activeSpeech = null
let speechToken = 0

function stopSpeaking() {
  speechToken += 1
  const entry = activeSpeech
  if (!entry) return
  activeSpeech = null
  try { entry.source.stop() } catch (e) {}
  try { entry.ctx.close() } catch (e) {}
  entry.resolve()
}

async function speakWithElevenLabs(text, session) {
  stopSpeaking()
  const token = speechToken
  const res = await fetch(`${SUPABASE_URL}/functions/v1/curry-tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('TTS failed')
  const arrayBuffer = await res.arrayBuffer()
  if (token !== speechToken) return // stopped while downloading
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  if (token !== speechToken) { try { ctx.close() } catch (e) {} return }
  const source = ctx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(ctx.destination)
  return new Promise((resolve) => {
    const entry = { source, ctx, resolve }
    activeSpeech = entry
    source.onended = () => {
      if (activeSpeech === entry) activeSpeech = null
      try { ctx.close() } catch (e) {}
      resolve()
    }
    source.start(0)
  })
}

async function transcribeAudio(blob, session) {
  const formData = new FormData()
  formData.append('audio', blob, 'recording.webm')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/voice-transcribe`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}` },
    body: formData,
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Transcription failed')
  return data.text
}

// ── Orb ──────────────────────────────────────────────────────
// state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'still'
function CurryOrb({ size = 40, state = 'idle', scale = 1 }) {
  return (
    <div
      className={`cy-orb ${state}`}
      aria-hidden="true"
      style={{ width: size, height: size, '--g': `${Math.round(size * 0.35)}px`, transform: scale !== 1 ? `scale(${scale})` : undefined }}
    />
  )
}

// ── Small inline icons ───────────────────────────────────────
const svgProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
const BackIcon = () => <svg {...svgProps} width="20" height="20"><path d="M15 18l-6-6 6-6" /></svg>
const CopyIcon = () => <svg {...svgProps}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
const CheckIcon = () => <svg {...svgProps}><path d="M20 6L9 17l-5-5" /></svg>
const ListenIcon = () => <svg {...svgProps}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
const StopIcon = () => <svg {...svgProps}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
const MicIcon = () => <svg {...svgProps} width="18" height="18"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>

// ── Voice Mode ───────────────────────────────────────────────
// A visible state machine: listening → thinking → speaking, with an
// error state. The big orb is a real button: tap to send now while
// listening, tap to interrupt while speaking, tap to retry on error.
function VoiceMode({ session, onEnd, onNewMessages }) {
  const [status, setStatus] = useState('listening') // listening | thinking | speaking | error
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [errorText, setErrorText] = useState('')
  const [volume, setVolume] = useState(0)

  const stoppedRef = useRef(false)
  const processingRef = useRef(false)
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const silenceTimerRef = useRef(null)
  const hasSpokenRef = useRef(false)
  const animFrameRef = useRef(null)
  const finishRef = useRef(null)
  const reduceMotion = useRef(typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  const SILENCE_THRESHOLD = 8
  const SILENCE_DURATION = 1400

  const cleanup = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    clearTimeout(silenceTimerRef.current)
    try { recorderRef.current?.stop() } catch (e) {}
    streamRef.current?.getTracks().forEach(t => t.stop())
    try { audioCtxRef.current?.close() } catch (e) {}
  }, [])

  const monitorVolume = useCallback(() => {
    if (!analyserRef.current || stoppedRef.current) return
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)
    const avg = data.reduce((a, b) => a + b, 0) / data.length
    setVolume(avg)

    if (avg > SILENCE_THRESHOLD) {
      hasSpokenRef.current = true
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        if (hasSpokenRef.current && !processingRef.current) finishRef.current?.()
      }, SILENCE_DURATION)
    }
    animFrameRef.current = requestAnimationFrame(monitorVolume)
  }, [])

  const startListening = useCallback(async () => {
    if (stoppedRef.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser
      chunksRef.current = []
      hasSpokenRef.current = false
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start(100)
      recorderRef.current = recorder
      setStatus('listening')
      setTranscript('')
      setResponse('')
      setErrorText('')
      monitorVolume()
    } catch (e) {
      console.error('Mic error:', e)
      setErrorText('Microphone is blocked. Allow mic access in your browser, then tap the orb.')
      setStatus('error')
    }
  }, [monitorVolume])

  async function finishRecording() {
    if (processingRef.current) return
    processingRef.current = true
    cancelAnimationFrame(animFrameRef.current)
    clearTimeout(silenceTimerRef.current)
    try { recorderRef.current?.stop() } catch (e) {}
    streamRef.current?.getTracks().forEach(t => t.stop())
    try { audioCtxRef.current?.close() } catch (e) {}
    await new Promise(r => setTimeout(r, 200))

    if (chunksRef.current.length === 0) {
      processingRef.current = false
      if (!stoppedRef.current) startListening()
      return
    }

    setStatus('thinking')
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    let failed = false

    try {
      const text = await transcribeAudio(blob, session)
      if (stoppedRef.current) { processingRef.current = false; return }
      if (!text?.trim()) { processingRef.current = false; startListening(); return }

      setTranscript(text)
      const data = await callCurryAI('chat', { message: text }, session)
      if (stoppedRef.current) { processingRef.current = false; return }

      if (data.ok) {
        const reply = data.response.replace(/<action>[\s\S]*?<\/action>/g, '').trim()
        setResponse(reply)
        onNewMessages(text, reply)
        setStatus('speaking')
        try {
          await speakWithElevenLabs(reply, session)
        } catch (e) {
          // No voice available — give the person time to read the caption.
          console.error('TTS failed:', e)
          await new Promise(r => setTimeout(r, Math.min(6000, 1200 + reply.length * 35)))
        }
      } else {
        failed = true
      }
    } catch (e) {
      console.error('Voice error:', e)
      failed = true
    }

    processingRef.current = false
    if (stoppedRef.current) return
    if (failed) {
      setErrorText("I couldn't catch that. Tap the orb to try again.")
      setStatus('error')
    } else {
      startListening()
    }
  }
  finishRef.current = finishRecording

  useEffect(() => {
    stoppedRef.current = false
    startListening()
    return () => { stoppedRef.current = true; stopSpeaking(); cleanup() }
  }, [])

  const handleOrbTap = () => {
    if (status === 'speaking') stopSpeaking()          // flow resumes → listening
    else if (status === 'listening') finishRef.current?.()
    else if (status === 'error') startListening()
  }

  const orbScale = status === 'listening' && !reduceMotion.current ? 1 + Math.min(volume / 160, 0.2) : 1
  const orbState = status === 'error' ? 'still' : status
  const label = { listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking', error: 'Paused' }[status]
  const hint = { listening: "Tap the orb when you're done", thinking: '', speaking: 'Tap to interrupt', error: 'Tap to try again' }[status]
  const caption =
    status === 'error' ? errorText
    : status === 'speaking' ? response
    : transcript ? `“${transcript}”` : ''

  return (
    <div className="cy-voice">
      <div className="cy-voice-top">
        <button className="cy-iconbtn" onClick={onEnd} aria-label="End voice chat"><IconX size={18} /></button>
        <span className="cy-voice-badge">Voice</span>
        <span style={{ width: 36 }} />
      </div>

      <div className="cy-voice-caption" aria-live="polite">{caption}</div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <button
          className="cy-voice-orbbtn"
          onClick={handleOrbTap}
          disabled={status === 'thinking'}
          aria-label={status === 'speaking' ? 'Interrupt' : status === 'listening' ? 'Send now' : status === 'error' ? 'Try again' : 'Thinking'}
        >
          <CurryOrb size={190} state={orbState} scale={orbScale} />
        </button>
        <div className="cy-voice-status">{label}</div>
        <div className="cy-voice-hint">{hint}</div>
      </div>
    </div>
  )
}

// ── Daily Brief card ────────────────────────────────────────
const MOOD_COLOR = {
  positive: '#4ade80', excited: '#f472b6', neutral: '#9ca3af',
  stressed: '#fb923c', anxious: '#facc15', sad: '#60a5fa', negative: '#f87171',
}
function MoodDot({ mood, size = 9 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: MOOD_COLOR[mood] || '#9ca3af', flexShrink: 0 }} />
}
const SUGGESTION_ICON = { music: IconMusic, movie: IconFilm, book: IconBook, encouragement: IconHeart, none: null }

function DailyBrief({ session, onAskQuestion }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await callCurryAI('daily_insight', {}, session)
        if (!cancelled && data.ok) setBrief(data.insight)
      } catch (e) { console.error('Daily brief failed:', e) }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (dismissed) return null
  if (loading) {
    return (
      <div className="cy-brief" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <TypingDots /> <span style={{ fontSize: 12.5, color: '#8d8fb0' }}>Getting your day ready…</span>
      </div>
    )
  }
  if (!brief) return null

  const suggestion = brief.suggestion
  const insights = Array.isArray(brief.insights) ? brief.insights : []
  const nudges = Array.isArray(brief.reconnect_nudges) ? brief.reconnect_nudges : []

  return (
    <div className="cy-brief">
      <button className="cy-brief-close" onClick={() => setDismissed(true)} aria-label="Dismiss"><IconX size={12} /></button>
      <div style={{ fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, paddingRight: 24, lineHeight: 1.4 }}>
        <MoodDot mood={brief.mood} /> {brief.greeting}
      </div>
      {brief.mood_summary && <div className="cy-brief-text">{brief.mood_summary}</div>}

      {(insights.length > 0 || nudges.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {insights.map((ins, i) => <div key={`i${i}`} className="cy-brief-text">• {ins.text}</div>)}
          {nudges.map((n, i) => (
            <div key={`n${i}`} className="cy-brief-text">
              • It's been {n.daysSince} days since you talked to {n.username} — usually it's about {n.usualGapDays}.
            </div>
          ))}
        </div>
      )}

      {suggestion && suggestion.type && suggestion.type !== 'none' && suggestion.title && (
        <div className="cy-brief-suggest">
          <span style={{ color: '#c4b5fd', flexShrink: 0, marginTop: 1 }}>
            {(() => { const Icon = SUGGESTION_ICON[suggestion.type] || IconSparkle; return <Icon size={15} /> })()}
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{suggestion.title}</div>
            <div style={{ fontSize: 12, color: '#9a9cbc' }}>{suggestion.reason}</div>
          </div>
        </div>
      )}

      {brief.question && (
        <button className="cy-chip" style={{ textAlign: 'left' }} onClick={() => onAskQuestion(brief.question)}>
          {brief.question} →
        </button>
      )}
    </div>
  )
}

// ── Three-dot menu ───────────────────────────────────────────
function CurryMenu({ voiceOn, onMemory, onVoiceChat, onToggleVoice, onClear, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = (fn) => () => { onClose(); fn() }

  return (
    <>
      <div className="cy-scrim" onClick={onClose} />
      <div className="cy-menu" role="menu">
        <button className="cy-menu-item" role="menuitem" onClick={run(onMemory)}>
          <IconFolder size={16} /> <span style={{ flex: 1 }}>Memory Vault</span>
        </button>
        <button className="cy-menu-item" role="menuitem" onClick={run(onVoiceChat)}>
          <MicIcon /> <span style={{ flex: 1 }}>Voice chat</span>
        </button>
        <button className="cy-menu-item" role="menuitemcheckbox" aria-checked={voiceOn} onClick={() => { onToggleVoice() }}>
          <ListenIcon /> <span style={{ flex: 1 }}>Read replies aloud</span>
          <span className={`cy-pill ${voiceOn ? 'on' : ''}`}>{voiceOn ? 'On' : 'Off'}</span>
        </button>
        <div className="cy-menu-sep" />
        <button className="cy-menu-item danger" role="menuitem" onClick={run(onClear)}>
          <IconTrash size={16} /> <span style={{ flex: 1 }}>Clear conversation</span>
        </button>
      </div>
    </>
  )
}

const STARTERS = [
  'What can you do?',
  'Summarize my recent chats',
  'Help me write a message',
  'Plan my day',
]

// ── Main Curry AI Chat ────────────────────────────────────────
export default function CurryAIChat({ session, onBack, onOpenConversation, initialMessage, onInitialMessageSent }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [voiceOn, setVoiceOn] = useState(() => {
    try { return localStorage.getItem('curry_voice_replies') === '1' } catch { return false }
  })
  const [voiceMode, setVoiceMode] = useState(false)
  const [showMemoryVault, setShowMemoryVault] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [speakingIdx, setSpeakingIdx] = useState(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const sentInitialRef = useRef(null)

  useEffect(() => {
    try { localStorage.setItem('curry_voice_replies', voiceOn ? '1' : '0') } catch { /* ignore */ }
  }, [voiceOn])
useEffect(() => {
  onVoiceActive?.(voiceMode)
  return () => onVoiceActive?.(false)
}, [voiceMode])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading, voiceMode])

  // auto-grow the composer
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }, [input, voiceMode])

  useEffect(() => () => stopSpeaking(), [])

  useEffect(() => {
    async function loadHistory() {
      try {
        const { data } = await supabase
          .from('curry_ai_messages')
          .select('role, content, created_at')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true })
          .limit(50)
        if (data && data.length > 0) {
          setMessages(data.map(m => ({ role: m.role, content: m.content })))
        }
      } finally {
        setHistoryLoaded(true) // even on failure, so initialMessage can still send
      }
    }
    loadHistory()
  }, [])

  // Auto-sends a prefilled question once history has settled.
  useEffect(() => {
   if (!historyLoaded) return
if (!initialMessage) { sentInitialRef.current = null; return }
    sentInitialRef.current = initialMessage
    sendMessage(initialMessage)
    onInitialMessageSent?.()
  }, [historyLoaded, initialMessage])

  async function speakMessage(idx, text) {
    if (speakingIdx === idx) { stopSpeaking(); setSpeakingIdx(null); return }
    setSpeakingIdx(idx)
    try { await speakWithElevenLabs(text, session) }
    catch (e) { console.error('speak failed:', e); alert("Couldn't read that aloud right now.") }
    setSpeakingIdx(cur => (cur === idx ? null : cur))
  }

  async function copyMessage(idx, text) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(cur => (cur === idx ? null : cur)), 1500)
    } catch {
      alert("Couldn't copy — your browser blocked it.")
    }
  }

  async function sendMessage(overrideText, { retry = false } = {}) {
    const userMsg = (overrideText ?? input).trim()
    if (!userMsg || loading) return
    stopSpeaking()
    setSpeakingIdx(null)
    setInput('')
    setMessages(prev => (retry ? prev.filter(m => !m.error) : [...prev, { role: 'user', content: userMsg }]))
    setLoading(true)

    let reply = null
    try {
      const data = await callCurryAI('chat', { message: userMsg }, session)
      if (data.ok) {
        reply = data.response.replace(/<action>[\s\S]*?<\/action>/g, '').trim()
        setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', error: true, retryText: userMsg, content: "Something went wrong on my side. Your message wasn't lost." }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', error: true, retryText: userMsg, content: "I couldn't connect. Check your internet and try again." }])
    }
    setLoading(false)

    if (reply && voiceOn) {
      try { await speakWithElevenLabs(reply, session) } catch (e) { console.error('TTS failed:', e) }
    }
  }

  function handleVoiceModeMessages(userText, assistantText) {
    setMessages(prev => [...prev, { role: 'user', content: userText }, { role: 'assistant', content: assistantText }])
  }

  async function clearHistory() {
    if (!window.confirm("Clear this conversation? This can't be undone.")) return
    stopSpeaking()
    setSpeakingIdx(null)
    try {
      const data = await callCurryAI('clear_history', {}, session)
      if (data.ok === false) throw new Error(data.error || 'failed')
    } catch (e) {
      console.error('clear_history failed:', e)
      alert("Couldn't clear the conversation. Please try again.")
      return
    }
    setMessages([])
  }

  function toggleVoiceReplies() {
    setVoiceOn(v => {
      if (v) { stopSpeaking(); setSpeakingIdx(null) }
      return !v
    })
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (voiceMode) {
    return (
      <div className="cy-root">
        <VoiceMode
          session={session}
          onEnd={() => setVoiceMode(false)}
          onNewMessages={handleVoiceModeMessages}
        />
      </div>
    )
  }

  if (showMemoryVault) {
    return (
      <MemoryVault
        session={session}
        userId={session.user.id}
        onOpenConversation={onOpenConversation}
        onClose={() => setShowMemoryVault(false)}
      />
    )
  }

  const isEmpty = historyLoaded && messages.length === 0 && !loading

  return (
    <div className="cy-root">
      {/* Header */}
      <div className="cy-header">
        {onBack && <button className="cy-iconbtn" onClick={onBack} aria-label="Back"><BackIcon /></button>}
        <CurryOrb size={30} state="still" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cy-title">Curry</div>
          <div className="cy-sub"><IconShield size={11} /> Private to you</div>
        </div>
        <button
          className="cy-iconbtn"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <IconMoreVertical size={18} />
        </button>
        {menuOpen && (
          <CurryMenu
            voiceOn={voiceOn}
            onMemory={() => setShowMemoryVault(true)}
            onVoiceChat={() => setVoiceMode(true)}
            onToggleVoice={toggleVoiceReplies}
            onClear={clearHistory}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>

      {/* Conversation */}
      <div className="cy-scroll">
        <div className="cy-col">
          <DailyBrief session={session} onAskQuestion={(q) => sendMessage(q)} />

          {isEmpty && (
            <div className="cy-empty">
              <CurryOrb size={88} state="idle" />
              <h2>Hi, I'm Curry</h2>
              <p>Ask me anything, or start with one of these.</p>
              <div className="cy-chips">
                {STARTERS.map(t => (
                  <button key={t} className="cy-chip" onClick={() => sendMessage(t)}>{t}</button>
                ))}
              </div>
              <div className="cy-privacy">
                <IconShield size={13} />
                <span>Curry only learns from chats you choose to share. Your memories live under ⋯ → Memory Vault.</span>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            msg.role === 'user' ? (
              <div key={i} className="cy-row cy-row-user"><div className="cy-user">{msg.content}</div></div>
            ) : (
              <div key={i} className="cy-row">
                <div style={{ minWidth: 0 }}>
                  <div className={`cy-ai ${msg.error ? 'error' : ''}`}>{msg.content}</div>
                  {msg.error ? (
                    <button className="cy-retry" onClick={() => sendMessage(msg.retryText, { retry: true })}>Try again</button>
                  ) : (
                    <div className="cy-actions">
                      <button className="cy-act" onClick={() => copyMessage(i, msg.content)} aria-label="Copy reply">
                        {copiedIdx === i ? <CheckIcon /> : <CopyIcon />}
                      </button>
                      <button className="cy-act" onClick={() => speakMessage(i, msg.content)} aria-label={speakingIdx === i ? 'Stop reading' : 'Read aloud'}>
                        {speakingIdx === i ? <StopIcon /> : <ListenIcon />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          ))}

          {loading && (
            <div className="cy-thinking" aria-live="polite">
              <CurryOrb size={20} state="thinking" /> <span>Thinking…</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="cy-composer-wrap">
        <div className="cy-composer">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message Curry"
            rows={1}
            aria-label="Message Curry"
          />
          <button className="cy-iconbtn" onClick={() => setVoiceMode(true)} aria-label="Start voice chat"><MicIcon /></button>
          <button className="cy-send" onClick={() => sendMessage()} disabled={!input.trim() || loading} aria-label="Send">
            <IconSend size={16} />
          </button>
        </div>
        <div className="cy-foot">Curry can make mistakes. Double-check anything important.</div>
      </div>
    </div>
  )
}

// ── In-chat Assistant Panel ────────────────────────────────────
export function CurryAssistant({ session, conversationId, messages: chatMessages, onSuggestReply, onClose, onShareChange }) {
  const [mode, setMode] = useState(null)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [translateLang, setTranslateLang] = useState('English')
  const [askText, setAskText] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [shared, setShared] = useState(false)
  const [shareLoading, setShareLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function checkShared() {
      setShareLoading(true)
      const data = await callCurryAI('check_shared', { conversationId }, session)
      if (!cancelled) { setShared(!!data.shared); setShareLoading(false) }
    }
    if (conversationId) checkShared()
    return () => { cancelled = true }
  }, [conversationId])

  async function toggleShare() {
    setShareLoading(true)
    const type = shared ? 'unshare_conversation' : 'share_conversation'
    const data = await callCurryAI(type, { conversationId }, session)
    if (data.ok) {
      const nowShared = !shared
      setShared(nowShared)
      onShareChange?.(conversationId, nowShared)
    } else {
      alert(`Couldn't update sharing: ${data.error || 'unknown error'}`)
      console.error('toggleShare failed:', data)
    }
    setShareLoading(false)
  }

  async function handleSmartReply() {
    setMode('smartreply'); setLoading(true)
    const data = await callCurryAI('smart_reply', {
      messages: chatMessages.slice(-10).map(m => ({ isMe: m.sender_id === session.user.id, sender: m.profiles?.username || 'Them', content: m.content }))
    }, session)
    if (data.ok) setSuggestions(data.suggestions || [])
    setLoading(false)
  }
  async function handleSummarize() {
    setMode('summarize'); setLoading(true)
    const data = await callCurryAI('summarize', { conversationId }, session)
    if (data.ok) setResult(data.response)
    setLoading(false)
  }
  async function handleTranslate() {
    setMode('translate'); setLoading(true)
    const lastMsg = chatMessages.filter(m => m.message_type === 'text').slice(-1)[0]
    if (!lastMsg) { setResult('No text message.'); setLoading(false); return }
    const data = await callCurryAI('translate', { message: lastMsg.content, targetLanguage: translateLang }, session)
    if (data.ok) setResult(data.response)
    setLoading(false)
  }
  async function handleAsk() {
    if (!askText.trim()) return
    setLoading(true)
    const data = await callCurryAI('chat', { message: `About this conversation: ${askText}` }, session)
    if (data.ok) setResult(data.response)
    setLoading(false)
  }

  return (
    <div style={s.panel}>
      <div style={s.panelHeader}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}><IconSparkle size={13} /> Curry AI</span>
        <button style={s.iconBtn} onClick={onClose}><IconX size={13} /></button>
      </div>

      {/* Share-with-Curry toggle — the trust boundary, front and center */}
      <button
        style={{ ...s.shareRow, ...(shared ? s.shareRowOn : {}) }}
        onClick={toggleShare}
        disabled={shareLoading}
      >
        <span style={{ color: shared ? '#c4b5fd' : '#8b8fa3' }}>{shared ? <IconSparkle size={15} /> : <IconLock size={15} />}</span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: shared ? '#c4b5fd' : '#e2e8f0' }}>
            {shared ? 'Shared with Curry' : 'Share this chat with Curry'}
          </div>
          <div style={{ fontSize: 11, color: '#8b8fa3' }}>
            {shared ? 'Curry can learn from this conversation. Tap to stop.' : 'Let Curry notice patterns & moods here.'}
          </div>
        </div>
      </button>

      {/* In-chat "hey curry" mutual consent toggle — a separate trust
          boundary from the share toggle above. Sharing lets *your*
          personal Curry read this chat; this lets *both* people
          summon a Curry that lives inside the chat itself. */}
      <CurryChatToggle session={session} conversationId={conversationId} />

      <div style={s.actionRow}>
        {[
          { id: 'smartreply', icon: IconMessageSquare, label: 'Smart Reply', action: handleSmartReply },
          { id: 'summarize', icon: IconWand, label: 'Summarize', action: handleSummarize },
          { id: 'translate', icon: IconGlobe, label: 'Translate', action: () => setMode('translate') },
          { id: 'ask', icon: IconSparkle, label: 'Ask AI', action: () => setMode('ask') },
        ].map(({ id, icon: Icon, label, action }) => (
          <button key={id} style={{ ...s.chip, ...(mode === id ? s.chipActive : {}), display: 'flex', alignItems: 'center', gap: 5 }} onClick={action}><Icon size={13} /> {label}</button>
        ))}
      </div>
      {loading && <div style={s.hint}>Thinking...</div>}
      {mode === 'smartreply' && !loading && suggestions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={s.hint}>Tap to send:</div>
          {suggestions.map((sg, i) => <button key={i} style={s.suggestion} onClick={() => { onSuggestReply(sg); onClose() }}>{sg}</button>)}
        </div>
      )}
      {mode === 'summarize' && !loading && result && <div style={s.result}>{result}</div>}
      {mode === 'translate' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={s.miniInput} value={translateLang} onChange={e => setTranslateLang(e.target.value)} placeholder="Language..." />
            <button style={s.goBtn} onClick={handleTranslate}>Go</button>
          </div>
          {result && <div style={s.result}>{result}</div>}
        </div>
      )}
      {mode === 'ask' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={s.miniInput} value={askText} onChange={e => setAskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAsk()} placeholder="Ask about this chat..." />
            <button style={s.goBtn} onClick={handleAsk}>Ask</button>
          </div>
          {result && <div style={s.result}>{result}</div>}
        </div>
      )}
    </div>
  )
}

// ── In-chat "Hey Curry" mutual consent toggle ────────────────────
// Lives inside a conversation. Both members must turn this on before
// "hey curry" gets routed to Curry instead of to the other person
// (groups only need one member). Either side can revoke it at any
// time, which kills it instantly — enforced server-side
// (isChatCurryEnabled); this toggle is just the UI for that state.
//
// IMPORTANT: `toggle()` used to call the API and reload unconditionally,
// treating every response as success. If the write actually failed
// (missing table/column, RLS, edge function not redeployed, etc.) the
// button would just silently reset to "Turn on" with zero feedback —
// which is exactly what looked like "the button doesn't work". Now it
// checks `data.ok` and surfaces the real error so the failure is
// actually diagnosable instead of invisible.
export function CurryChatToggle({ session, conversationId }) {
  const [myConsent, setMyConsent] = useState(false)
  const [allConsented, setAllConsented] = useState(false)
  const [isGroup, setIsGroup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await callCurryAI('chat_consent_status', { conversationId }, session)
      if (data.ok) {
        setMyConsent(data.myConsent)
        setAllConsented(data.allConsented)
        setIsGroup(!!data.isGroup)
        setError('')
      } else {
        setError(data.error || 'Could not load Curry status')
        console.error('chat_consent_status failed:', data)
      }
    } catch (e) {
      setError('Network error loading Curry status')
      console.error('chat_consent_status threw:', e)
    }
    setLoading(false)
  }, [conversationId, session])

  useEffect(() => { if (conversationId) load() }, [load, conversationId])

  async function toggle() {
    setLoading(true)
    setError('')
    try {
      const data = await callCurryAI(myConsent ? 'disable_curry_chat' : 'enable_curry_chat', { conversationId }, session)
      if (!data.ok) {
        setError(data.error || 'Toggle failed — nothing was saved')
        console.error('Curry chat toggle failed:', data)
      }
    } catch (e) {
      setError('Network error — toggle did not go through')
      console.error('Curry chat toggle threw:', e)
    }
    await load()
  }

  // Groups are more public than a 1:1 by nature, so only one member
  // needs to opt in to activate Curry there — a 1:1 still needs both
  // people, since that's a private space by default. Either way,
  // turning this off never erases what Curry has learned about the
  // chat (curry_chat_memory) — it just goes quiet until re-enabled.
  const title = allConsented
    ? 'Curry is active in this chat'
    : myConsent
    ? 'Waiting on the other person'
    : 'Invite Curry into this chat'

  const subtitle = allConsented
    ? 'Say "hey curry" to get an opinion or suggestion'
    : isGroup
    ? 'Any one member can turn this on for the group'
    : 'Both people must turn this on'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <div style={{ ...s.shareRow, cursor: 'default', ...(allConsented ? s.shareRowOn : {}) }}>
        <span style={{ color: allConsented ? '#c4b5fd' : myConsent ? '#fbbf24' : '#9ca3af' }}>
          {allConsented ? <IconSparkle size={15} /> : myConsent ? <IconHourglass size={15} /> : <IconMessageSquare size={15} />}
        </span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: allConsented ? '#c4b5fd' : '#e2e8f0' }}>
            {title}
          </div>
          <div style={{ fontSize: 11, color: '#8b8fa3' }}>
            {subtitle}
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          style={{
            background: myConsent ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg,#667eea,#764ba2)',
            border: myConsent ? '1px solid rgba(239,68,68,0.3)' : 'none',
            borderRadius: 20, color: myConsent ? '#f87171' : '#fff',
            fontSize: 12, fontWeight: 700, padding: '6px 12px', cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
            fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          {loading ? '...' : myConsent ? 'Turn off' : 'Turn on'}
        </button>
      </div>
      {error && (
        <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconAlertTriangle size={12} /> {error}
        </div>
      )}
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────
function SpeakerIcon({ on }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      {on ? (<><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>) : (<><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>)}
    </svg>
  )
}
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#a78bfa', opacity: 0.8, animation: `typingDot 1.2s ${i*0.2}s infinite ease-in-out` }}/>)}
    </div>
  )
}

// ── Voice mode styles ──────────────────────────────────────────
const vm = {
  container: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'space-between',
    padding: '40px 24px 32px',
    background: 'linear-gradient(180deg, #0a0a18 0%, #120b24 50%, #0a0a18 100%)',
    position: 'relative', overflow: 'hidden',
  },
  topText: {
    width: '100%', maxWidth: 320, textAlign: 'center',
    minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  responseText: {
    fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6,
    fontWeight: 400, letterSpacing: '-0.01em',
    animation: 'fadeIn 0.4s ease',
  },
  orbWrapper: {
    position: 'relative', width: 200, height: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute', inset: -20, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(102,126,234,0.15) 0%, transparent 70%)',
  },
  glowRing2: {
    position: 'absolute', inset: -40, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(118,75,162,0.1) 0%, transparent 70%)',
  },
  orb: {
    width: 180, height: 180, borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 40%, #f093fb 80%, #667eea 100%)',
    backgroundSize: '200% 200%',
    position: 'relative', overflow: 'hidden',
    boxShadow: '0 0 60px rgba(102,126,234,0.5), 0 0 120px rgba(118,75,162,0.3), inset 0 0 60px rgba(255,255,255,0.05)',
    transition: 'transform 0.1s ease-out',
  },
  orbInner: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.25) 0%, transparent 60%)',
  },
  orbShine: {
    position: 'absolute', top: '15%', left: '20%',
    width: '35%', height: '25%', borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    filter: 'blur(8px)',
  },
  transcriptArea: {
    width: '100%', maxWidth: 280, textAlign: 'center', minHeight: 48,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  transcriptText: {
    fontSize: 14, color: 'rgba(167,139,250,0.9)',
    fontStyle: 'italic', lineHeight: 1.5,
  },
  statusRow: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  statusDot: {
    width: 8, height: 8, borderRadius: '50%',
  },
  statusLabel: {
    fontSize: 14, color: 'rgba(255,255,255,0.5)',
    fontWeight: 500, letterSpacing: '0.02em',
  },
  bottomBar: {
    width: '100%', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: 8,
  },
  endBtn: {
    width: 40, height: 40, borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  micBtn: {
    width: 72, height: 72, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.3s ease', cursor: 'default',
  },
}

// ── Chat styles ────────────────────────────────────────────────
const s = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'linear-gradient(180deg,#0d0d1a 0%,#111827 100%)', fontFamily: "'Inter',sans-serif" },
  header: { padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, boxShadow: '0 0 16px rgba(102,126,234,0.4)' },
  headerName: { fontSize: 15, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.02em' },
  headerSub: { fontSize: 11, color: '#667eea', marginTop: 1, fontWeight: 500 },
  speakerBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#667eea', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  messages: { flex: 1, overflowY: 'auto', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 16 },
  row: { display: 'flex', gap: 10, alignItems: 'flex-end' },
  rowUser: { flexDirection: 'row-reverse' },
  aiAvatar: { width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 },
  bubble: { maxWidth: '78%', padding: '11px 15px', fontSize: 14, lineHeight: 1.6, fontWeight: 400 },
  bubbleAI: { background: 'rgba(255,255,255,0.06)', color: '#e8e8f0', borderRadius: '4px 18px 18px 18px', border: '1px solid rgba(255,255,255,0.06)' },
  bubbleUser: { background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', borderRadius: '18px 4px 18px 18px', boxShadow: '0 4px 14px rgba(102,126,234,0.3)' },
  inputArea: { padding: '12px 16px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-end', gap: 8, background: 'rgba(255,255,255,0.02)' },
  textarea: { flex: 1, resize: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, padding: '11px 16px', fontSize: 14, fontFamily: 'inherit', background: 'rgba(255,255,255,0.05)', color: '#f0f0f0', outline: 'none', maxHeight: 120, lineHeight: 1.5 },
  micBtn: { width: 40, height: 40, borderRadius: '50%', background: 'rgba(102,126,234,0.15)', border: '1px solid rgba(102,126,234,0.3)', cursor: 'pointer', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtn: { width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(102,126,234,0.4)' },
  panel: { background: 'rgba(30,30,46,0.98)', borderTop: '1px solid rgba(102,126,234,0.3)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  actionRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, color: '#a0aec0', fontSize: 12, fontWeight: 600, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' },
  chipActive: { background: 'linear-gradient(135deg,#667eea,#764ba2)', border: '1px solid #667eea', color: '#fff' },
  hint: { fontSize: 12, color: '#666', fontWeight: 500 },
  result: { fontSize: 14, color: '#e2e8f0', lineHeight: 1.55, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)' },
  suggestion: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(102,126,234,0.3)', borderRadius: 10, color: '#e2e8f0', fontSize: 13, padding: '8px 12px', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit' },
  miniInput: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: 'inherit' },
  goBtn: { background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' },

  // Share-with-Curry toggle row
  shareRow: { display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
  shareRowOn: { background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.35)' },

  // Daily brief card
  briefCard: { position: 'relative', background: 'linear-gradient(135deg, rgba(102,126,234,0.14), rgba(118,75,162,0.14))', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 },
  briefClose: { position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', padding: 4 },
  briefGreeting: { fontSize: 15, fontWeight: 700, color: '#fff', paddingRight: 20, lineHeight: 1.4 },
  briefMood: { fontSize: 13, color: '#c9cbe0', lineHeight: 1.55 },
  briefInsights: { display: 'flex', flexDirection: 'column', gap: 4 },
  briefInsightRow: { fontSize: 13, color: '#d8dae8', lineHeight: 1.5, display: 'flex', gap: 6 },
  briefSuggestion: { display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '9px 12px' },
  briefQuestionBtn: { textAlign: 'left', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 10, color: '#e9d5ff', fontSize: 13, fontWeight: 600, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4 },
}

// Inject animations
const styleEl = document.createElement('style')
styleEl.textContent = `
  @keyframes typingDot { 0%,60%,100% { transform:translateY(0);opacity:0.4; } 30% { transform:translateY(-5px);opacity:1; } }
  @keyframes orbIdle { 0%,100% { background-position:0% 50%; box-shadow:0 0 60px rgba(102,126,234,0.5),0 0 120px rgba(118,75,162,0.3); } 50% { background-position:100% 50%; box-shadow:0 0 80px rgba(102,126,234,0.7),0 0 160px rgba(118,75,162,0.4); } }
  @keyframes orbMorph { 0%,100% { border-radius:50%; transform:scale(1); } 33% { border-radius:45% 55% 60% 40%/50% 45% 55% 50%; transform:scale(1.05); } 66% { border-radius:55% 45% 40% 60%/45% 55% 50% 55%; transform:scale(0.97); } }
  @keyframes orbSpeak { from { transform:scale(1); box-shadow:0 0 60px rgba(102,126,234,0.5); } to { transform:scale(1.08); box-shadow:0 0 90px rgba(240,147,251,0.6); } }
  @keyframes glowPulse { 0%,100% { opacity:0.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.05); } }
  @keyframes dotPulse { 0%,100% { opacity:0.5; transform:scale(1); } 50% { opacity:1; transform:scale(1.3); } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:none; } }
`
// Curry v2 styles
const cyStyleEl = document.createElement('style')
cyStyleEl.id = 'curry-styles-v2'
cyStyleEl.textContent = `
  .cy-root { display:flex; flex-direction:column; flex:1; min-height:0; height:100%; position:relative; color:#ecebf5;
    background: radial-gradient(120% 55% at 50% -8%, rgba(102,126,234,.18), transparent 60%), #0b0b16;
    font-family:'Inter',system-ui,sans-serif; }

  /* orb */
  .cy-orb { position:relative; border-radius:50%; overflow:hidden; flex-shrink:0; box-shadow:0 0 var(--g,24px) rgba(139,156,255,.45); }
  .cy-orb::before { content:""; position:absolute; inset:-25%; background:conic-gradient(from 0deg,#667eea,#a78bfa,#f093fb,#67e8f9,#667eea); animation:cySpin 10s linear infinite; }
  .cy-orb::after { content:""; position:absolute; inset:0; border-radius:50%;
    background: radial-gradient(circle at 32% 28%, rgba(255,255,255,.55), rgba(255,255,255,0) 45%), radial-gradient(circle at 70% 82%, rgba(10,8,30,.4), rgba(10,8,30,0) 60%); }
  .cy-orb.idle { animation:cyBreathe 4.5s ease-in-out infinite; }
  .cy-orb.thinking::before { animation-duration:2.2s; }
  .cy-orb.speaking { animation:cyBeat .9s ease-in-out infinite alternate; }
  .cy-orb.listening { transition:transform .1s ease-out; }
  .cy-orb.still::before { animation-duration:30s; }
  @keyframes cySpin { to { transform:rotate(360deg); } }
  @keyframes cyBreathe { 0%,100% { transform:scale(1); } 50% { transform:scale(1.05); } }
  @keyframes cyBeat { from { transform:scale(1); } to { transform:scale(1.08); } }
  @keyframes cyPop { from { opacity:0; transform:translateY(-4px) scale(.98); } to { opacity:1; transform:none; } }
  @media (prefers-reduced-motion: reduce) {
    .cy-orb, .cy-orb::before { animation:none !important; }
    .cy-menu { animation:none; }
  }

  /* header + buttons */
  .cy-header { display:flex; align-items:center; gap:10px; padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.06); flex-shrink:0; position:relative; }
  .cy-title { font-size:15px; font-weight:700; letter-spacing:-.01em; }
  .cy-sub { font-size:11px; color:#8d8fb0; display:flex; align-items:center; gap:4px; margin-top:1px; }
  .cy-iconbtn { width:36px; height:36px; border-radius:50%; border:none; background:transparent; color:#a9abc9; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:background .15s, color .15s; }
  .cy-iconbtn:hover { background:rgba(255,255,255,.07); color:#fff; }
  .cy-iconbtn:focus-visible, .cy-chip:focus-visible, .cy-act:focus-visible, .cy-menu-item:focus-visible, .cy-send:focus-visible, .cy-voice-orbbtn:focus-visible, .cy-retry:focus-visible { outline:2px solid #a78bfa; outline-offset:2px; }

  /* menu */
  .cy-scrim { position:fixed; inset:0; z-index:29; }
  .cy-menu { position:absolute; top:54px; right:10px; z-index:30; min-width:240px; padding:6px; border-radius:16px; background:rgba(22,21,38,.97); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); border:1px solid rgba(255,255,255,.09); box-shadow:0 18px 48px rgba(0,0,0,.5); animation:cyPop .16s ease; }
  .cy-menu-item { display:flex; align-items:center; gap:12px; width:100%; padding:11px 12px; border:none; border-radius:10px; background:none; color:#ecebf5; font:inherit; font-size:13.5px; font-weight:500; text-align:left; cursor:pointer; }
  .cy-menu-item:hover { background:rgba(255,255,255,.06); }
  .cy-menu-item.danger { color:#f87171; }
  .cy-menu-sep { height:1px; background:rgba(255,255,255,.07); margin:5px 4px; }
  .cy-pill { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:999px; color:#7d7f9c; background:rgba(255,255,255,.06); }
  .cy-pill.on { color:#c4b5fd; background:rgba(167,139,250,.18); }

  /* conversation */
  .cy-scroll { flex:1; min-height:0; overflow-y:auto; padding:18px 16px 8px; }
  .cy-col { width:100%; max-width:720px; margin:0 auto; display:flex; flex-direction:column; gap:18px; }
  .cy-row { display:flex; }
  .cy-row-user { justify-content:flex-end; }
  .cy-user { max-width:82%; padding:10px 14px; border-radius:18px 18px 4px 18px; background:rgba(139,156,255,.16); border:1px solid rgba(139,156,255,.22); font-size:14.5px; line-height:1.55; white-space:pre-wrap; word-break:break-word; }
  .cy-ai { max-width:94%; font-size:14.5px; line-height:1.7; color:#e6e5f2; white-space:pre-wrap; word-break:break-word; }
  .cy-ai.error { color:#fca5a5; }
  .cy-actions { display:flex; gap:2px; margin-top:6px; margin-left:-6px; }
  .cy-act { width:30px; height:30px; border:none; border-radius:8px; background:transparent; color:#7d7f9c; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; transition:background .15s, color .15s; }
  .cy-act:hover { background:rgba(255,255,255,.07); color:#fff; }
  .cy-retry { margin-top:8px; padding:6px 14px; border-radius:999px; border:1px solid rgba(248,113,113,.4); background:rgba(248,113,113,.1); color:#fca5a5; font:inherit; font-size:12.5px; font-weight:700; cursor:pointer; }
  .cy-thinking { display:flex; align-items:center; gap:10px; font-size:13px; color:#8d8fb0; }

  /* empty state */
  .cy-empty { display:flex; flex-direction:column; align-items:center; text-align:center; padding:28px 8px 8px; gap:6px; }
  .cy-empty h2 { margin:14px 0 0; font-size:22px; font-weight:800; letter-spacing:-.02em; }
  .cy-empty p { margin:0; font-size:14px; color:#9a9cbc; }
  .cy-chips { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:16px; }
  .cy-chip { padding:9px 14px; border-radius:999px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); color:#dcdcf0; font:inherit; font-size:13px; font-weight:600; cursor:pointer; transition:background .15s, border-color .15s; }
  .cy-chip:hover { background:rgba(167,139,250,.14); border-color:rgba(167,139,250,.4); }
  .cy-privacy { display:flex; align-items:flex-start; gap:7px; max-width:340px; margin-top:22px; font-size:11.5px; line-height:1.5; color:#8d8fb0; text-align:left; }
  .cy-privacy svg { flex-shrink:0; margin-top:2px; }

  /* daily brief */
  .cy-brief { position:relative; display:flex; flex-direction:column; gap:10px; padding:14px 16px; border-radius:18px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); }
  .cy-brief-close { position:absolute; top:10px; right:10px; width:24px; height:24px; border:none; border-radius:50%; background:transparent; color:rgba(255,255,255,.4); cursor:pointer; display:flex; align-items:center; justify-content:center; }
  .cy-brief-close:hover { background:rgba(255,255,255,.08); color:#fff; }
  .cy-brief-text { font-size:13px; line-height:1.55; color:#c9cbe0; }
  .cy-brief-suggest { display:flex; gap:10px; align-items:flex-start; padding:9px 12px; border-radius:12px; background:rgba(255,255,255,.05); }

  /* composer */
  .cy-composer-wrap { padding:8px 14px max(12px, env(safe-area-inset-bottom)); flex-shrink:0; }
  .cy-composer { display:flex; align-items:flex-end; gap:4px; max-width:720px; margin:0 auto; padding:6px 6px 6px 18px; border-radius:26px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); transition:border-color .15s, box-shadow .15s; }
  .cy-composer:focus-within { border-color:rgba(167,139,250,.55); box-shadow:0 0 0 4px rgba(167,139,250,.1); }
  .cy-composer textarea { flex:1; min-width:0; background:none; border:none; outline:none; resize:none; color:#f2f1fa; font:inherit; font-size:14.5px; line-height:1.5; padding:9px 0; max-height:140px; }
  .cy-composer textarea::placeholder { color:#7d7f9c; }
  .cy-send { width:36px; height:36px; border-radius:50%; border:none; background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:opacity .15s, transform .1s; }
  .cy-send:disabled { opacity:.3; cursor:default; }
  .cy-send:not(:disabled):active { transform:scale(.94); }
  .cy-foot { max-width:720px; margin:8px auto 0; text-align:center; font-size:11px; color:#6f7190; }

  /* voice mode */
  .cy-voice { flex:1; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:14px 20px max(32px, env(safe-area-inset-bottom));
    background: radial-gradient(80% 50% at 50% 48%, rgba(102,126,234,.24), transparent 70%), #080812; }
  .cy-voice-top { width:100%; display:flex; align-items:center; justify-content:space-between; }
  .cy-voice-badge { font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#8d8fb0; }
  .cy-voice-caption { width:100%; max-width:340px; min-height:90px; max-height:28vh; overflow-y:auto; text-align:center; font-size:16px; line-height:1.6; color:rgba(255,255,255,.88); }
  .cy-voice-orbbtn { background:none; border:none; padding:20px; border-radius:50%; cursor:pointer; display:flex; }
  .cy-voice-orbbtn:disabled { cursor:default; }
  .cy-voice-status { font-size:14px; font-weight:600; color:rgba(255,255,255,.75); letter-spacing:.02em; }
  .cy-voice-hint { min-height:16px; font-size:12px; color:#7d7f9c; }
`
if (!document.getElementById('curry-styles-v2')) document.head.appendChild(cyStyleEl)
