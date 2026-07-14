import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import MemoryVault from './MemoryVault'

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

async function speakWithElevenLabs(text, session) {
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
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  const source = audioCtx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(audioCtx.destination)
  return new Promise((resolve) => {
    source.onended = resolve
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

// ── Voice Mode (full screen, like the reference) ─────────────
function VoiceMode({ session, voiceOn, onEnd, onNewMessages }) {
  const [status, setStatus] = useState('listening')
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [volume, setVolume] = useState(0)
  const [showMemoryVault, setShowMemoryVault] = useState(false)

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
        if (hasSpokenRef.current && !processingRef.current) finishRecording()
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
      monitorVolume()
    } catch (e) {
      console.error('Mic error:', e)
      onEnd()
    }
  }, [monitorVolume, onEnd])

  async function finishRecording() {
    if (processingRef.current) return
    processingRef.current = true
    cancelAnimationFrame(animFrameRef.current)
    clearTimeout(silenceTimerRef.current)
    recorderRef.current?.stop()
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

    try {
      const text = await transcribeAudio(blob, session)
      if (stoppedRef.current) { processingRef.current = false; return }
      if (!text?.trim()) { processingRef.current = false; if (!stoppedRef.current) startListening(); return }

      setTranscript(text)
      const data = await callCurryAI('chat', { message: text }, session)
      if (stoppedRef.current) { processingRef.current = false; return }

      if (data.ok) {
        const reply = data.response.replace(/<action>[\s\S]*?<\/action>/g, '').trim()
        setResponse(reply)
        onNewMessages(text, reply)
        if (voiceOn) {
          setStatus('speaking')
          await speakWithElevenLabs(reply, session)
        }
      }
    } catch (e) {
      console.error('Voice error:', e)
    }

    processingRef.current = false
    if (!stoppedRef.current) startListening()
  }

  useEffect(() => {
    stoppedRef.current = false
    startListening()
    return () => { stoppedRef.current = true; cleanup() }
  }, [])

  // Orb scale based on volume
  const orbScale = status === 'listening' ? 1 + Math.min(volume / 180, 0.18) : 1

  const statusLabel = { listening: 'Listening...', thinking: 'Thinking...', speaking: 'Speaking...' }[status]

  return (
    <div style={vm.container}>
      {/* Top: response text (like reference shows AI text above orb) */}
      <div style={vm.topText}>
        {response && status !== 'listening' && (
          <p style={vm.responseText}>{response}</p>
        )}
      </div>

      {/* Glowing orb */}
      <div style={vm.orbWrapper}>
        {/* Outer glow rings */}
        <div style={{ ...vm.glowRing, animation: status !== 'thinking' ? 'glowPulse 2s ease-in-out infinite' : 'none' }} />
        <div style={{ ...vm.glowRing2, animation: status !== 'thinking' ? 'glowPulse 2s 0.5s ease-in-out infinite' : 'none' }} />

        {/* Main orb */}
        <div style={{
          ...vm.orb,
          transform: `scale(${orbScale})`,
          animation: status === 'thinking'
            ? 'orbMorph 1.5s ease-in-out infinite'
            : status === 'speaking'
            ? 'orbSpeak 0.8s ease-in-out infinite alternate'
            : 'orbIdle 3s ease-in-out infinite',
        }}>
          <div style={vm.orbInner} />
          <div style={vm.orbShine} />
        </div>
      </div>

      {/* Transcript (what user said) */}
      <div style={vm.transcriptArea}>
        {transcript && <p style={vm.transcriptText}>"{transcript}"</p>}
      </div>

      {/* Status label */}
      <div style={vm.statusRow}>
        <div style={{ ...vm.statusDot, background: status === 'listening' ? '#a78bfa' : status === 'thinking' ? '#f093fb' : '#667eea', animation: 'dotPulse 1s ease-in-out infinite' }} />
        <span style={vm.statusLabel}>{statusLabel}</span>
      </div>

      {/* Bottom mic button */}
      <div style={vm.bottomBar}>
        <button style={vm.endBtn} onClick={onEnd}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <div style={{
          ...vm.micBtn,
          background: status === 'listening'
            ? 'linear-gradient(135deg,#667eea,#764ba2)'
            : status === 'speaking'
            ? 'linear-gradient(135deg,#764ba2,#f093fb)'
            : 'rgba(102,126,234,0.3)',
          boxShadow: status === 'listening' ? '0 0 30px rgba(102,126,234,0.6)' : '0 0 15px rgba(102,126,234,0.3)',
        }}>
          {status === 'listening' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
          ) : status === 'thinking' ? (
            <TypingDots />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          )}
        </div>

        <div style={{ width: 40 }} />
      </div>
    </div>
  )
}

// ── Daily Brief card ────────────────────────────────────────
const MOOD_EMOJI = {
  positive: '😊', excited: '🤩', neutral: '🙂',
  stressed: '😮\u200d💨', anxious: '😟', sad: '😔', negative: '😕',
}
const SUGGESTION_EMOJI = { music: '🎵', movie: '🎬', book: '📖', encouragement: '💜', none: '' }

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
      <div style={s.briefCard}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <TypingDots /> <span style={{ fontSize: 12.5, color: '#9ca3af' }}>Curry is thinking about your day...</span>
        </div>
      </div>
    )
  }
  if (!brief) return null

  const moodEmoji = MOOD_EMOJI[brief.mood] || '🙂'
  const suggestion = brief.suggestion
  const insights = Array.isArray(brief.insights) ? brief.insights : []

  return (
    <div style={s.briefCard}>
      <button style={s.briefClose} onClick={() => setDismissed(true)} title="Dismiss">✕</button>
      <div style={s.briefGreeting}>{moodEmoji} {brief.greeting}</div>
      {brief.mood_summary && <div style={s.briefMood}>{brief.mood_summary}</div>}

      {insights.length > 0 && (
        <div style={s.briefInsights}>
          {insights.map((ins, i) => (
            <div key={i} style={s.briefInsightRow}>
              <span style={{ color: '#a78bfa' }}>•</span> {ins.text}
            </div>
          ))}
        </div>
      )}
{Array.isArray(brief.reconnect_nudges) && brief.reconnect_nudges.length > 0 && (
        <div style={s.briefInsights}>
          {brief.reconnect_nudges.map((n, i) => (
            <div key={i} style={s.briefInsightRow}>
              <span style={{ color: '#a78bfa' }}>•</span>
              It's been {n.daysSince} days since you talked to {n.username} — usually it's about {n.usualGapDays}.
            </div>
          ))}
        </div>
      )}
      {suggestion && suggestion.type && suggestion.type !== 'none' && suggestion.title && (
        <div style={s.briefSuggestion}>
          <span style={{ fontSize: 15 }}>{SUGGESTION_EMOJI[suggestion.type] || '✨'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{suggestion.title}</div>
            <div style={{ fontSize: 12, color: '#a0aec0' }}>{suggestion.reason}</div>
          </div>
        </div>
      )}

      {brief.question && (
        <button style={s.briefQuestionBtn} onClick={() => onAskQuestion(brief.question)}>
          {brief.question} →
        </button>
      )}
    </div>
  )
}


// ── Main Curry AI Chat ────────────────────────────────────────
export default function CurryAIChat({ session, onOpenConversation }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hey! I'm Curry AI ✨ — your personal companion inside Mattchat.\n\nI can send messages, schedule them, summarize chats, translate, create polls & tasks, draft emails, and answer anything.\n\nShare a chat with me from its ⋮ menu and I'll start noticing patterns, moods, and things worth suggesting — like a friend would.` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [voiceOn, setVoiceOn] = useState(true)
  const [voiceMode, setVoiceMode] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, voiceMode])

  useEffect(() => {
    async function loadHistory() {
      const { data } = await supabase
        .from('curry_ai_messages')
        .select('role, content, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })
        .limit(50)
      if (data && data.length > 0) {
        setMessages([
          { role: 'assistant', content: `Welcome back! What can I help you with?` },
          ...data.map(m => ({ role: m.role, content: m.content }))
        ])
      }
    }
    loadHistory()
  }, [])

  async function sendMessage(overrideText) {
    const userMsg = (overrideText ?? input).trim()
    if (!userMsg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const data = await callCurryAI('chat', { message: userMsg }, session)
      if (data.ok) {
        const response = data.response.replace(/<action>[\s\S]*?<\/action>/g, '').trim()
        setMessages(prev => [...prev, { role: 'assistant', content: response }])
        if (voiceOn) {
          try { await speakWithElevenLabs(response, session) } catch (e) { console.error(e) }
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error.' }])
    }
    setLoading(false)
  }

  function handleVoiceModeMessages(userText, assistantText) {
    setMessages(prev => [...prev, { role: 'user', content: userText }, { role: 'assistant', content: assistantText }])
  }

  async function clearHistory() {
    await callCurryAI('clear_history', {}, session)
    setMessages([{ role: 'assistant', content: `Fresh start — what can I help you with?` }])
  }

  if (voiceMode) {
    return (
      <VoiceMode
        session={session}
        voiceOn={voiceOn}
        onEnd={() => setVoiceMode(false)}
        onNewMessages={handleVoiceModeMessages}
      />
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
  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.avatar}>✨</div>
          <div>
            <div style={s.headerName}>Curry AI</div>
            <div style={s.headerSub}>Always learning, always here</div>
          </div>
        </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setShowMemoryVault(true)} style={s.iconBtn} title="Memory Vault">🗂️</button>
          <button onClick={() => setVoiceOn(v => !v)} style={s.speakerBtn} title={voiceOn ? 'Mute' : 'Unmute'}>
            <SpeakerIcon on={voiceOn} />
          </button>
          <button style={s.iconBtn} onClick={clearHistory} title="Clear history"><TrashIcon /></button>
        </div>
      </div>

      {/* Messages */}
      <div style={s.messages}>
        <DailyBrief session={session} onAskQuestion={(q) => sendMessage(q)} />
        {messages.map((msg, i) => (
          <div key={i} style={{ ...s.row, ...(msg.role === 'user' ? s.rowUser : {}) }}>
            {msg.role === 'assistant' && <div style={s.aiAvatar}>✨</div>}
            <div style={{ ...s.bubble, ...(msg.role === 'user' ? s.bubbleUser : s.bubbleAI) }}>
              {msg.content.split('\n').map((line, j, arr) => (
                <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div style={s.row}>
            <div style={s.aiAvatar}>✨</div>
            <div style={{ ...s.bubble, ...s.bubbleAI, padding: '12px 16px' }}><TypingDots /></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={s.inputArea}>
        <textarea
          style={s.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Message Curry AI..."
          rows={1}
        />
        {/* Mic button to enter voice mode */}
        <button style={s.micBtn} onClick={() => setVoiceMode(true)} title="Voice mode">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
        </button>
        <button style={{ ...s.sendBtn, opacity: (!input.trim() || loading) ? 0.35 : 1 }} onClick={() => sendMessage()} disabled={!input.trim() || loading}>
          <SendIcon />
        </button>
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
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>✨ Curry AI</span>
        <button style={s.iconBtn} onClick={onClose}>✕</button>
      </div>

      {/* Share-with-Curry toggle — the trust boundary, front and center */}
      <button
        style={{ ...s.shareRow, ...(shared ? s.shareRowOn : {}) }}
        onClick={toggleShare}
        disabled={shareLoading}
      >
        <span style={{ fontSize: 15 }}>{shared ? '🧠' : '🔒'}</span>
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
          { id: 'smartreply', label: '💬 Smart Reply', action: handleSmartReply },
          { id: 'summarize', label: '📝 Summarize', action: handleSummarize },
          { id: 'translate', label: '🌍 Translate', action: () => setMode('translate') },
          { id: 'ask', label: '🤔 Ask AI', action: () => setMode('ask') },
        ].map(({ id, label, action }) => (
          <button key={id} style={{ ...s.chip, ...(mode === id ? s.chipActive : {}) }} onClick={action}>{label}</button>
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
        <span style={{ fontSize: 15 }}>{allConsented ? '✨' : myConsent ? '⏳' : '🗣️'}</span>
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
        <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '6px 10px' }}>
          ⚠️ {error}
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
function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
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
if (!document.getElementById('curry-styles')) { styleEl.id='curry-styles'; document.head.appendChild(styleEl) }
