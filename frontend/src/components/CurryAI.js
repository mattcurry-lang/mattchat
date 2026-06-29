import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = 'https://bqerkvywgxoioocbkxif.supabase.co'

async function callCurryAI(type, payload, session) {
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

// ── ElevenLabs TTS ────────────────────────────────────────────
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

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  return new Promise((resolve, reject) => {
    audio.onended = () => { URL.revokeObjectURL(url); resolve() }
    audio.onerror = reject
    audio.play()
  })
}

// ── Main Curry AI Chat ────────────────────────────────────────
export default function CurryAIChat({ session }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hey! I'm Curry AI ✨ — your personal assistant inside Mattchat.\n\nI can send messages, schedule them, summarize chats, translate, create polls & tasks, draft emails, and answer anything you ask.\n\nJust tell me what you need!`
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [voiceOn, setVoiceOn] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const messagesEndRef = useRef(null)
  const audioRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load history on mount
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

  const speak = useCallback(async (text) => {
    if (!voiceOn) return
    setSpeaking(true)
    try {
      await speakWithElevenLabs(text, session)
    } catch (e) {
      console.error('TTS error:', e)
    }
    setSpeaking(false)
  }, [voiceOn, session])

  const stopSpeaking = useCallback(() => {
    // Stop any playing audio
    const audios = document.querySelectorAll('audio')
    audios.forEach(a => { a.pause(); a.currentTime = 0 })
    setSpeaking(false)
  }, [])

  async function sendMessage() {
    const userMsg = input.trim()
    if (!userMsg || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const data = await callCurryAI('chat', { message: userMsg }, session)
      if (data.ok) {
        const response = data.response.replace(/<action>[\s\S]*?<\/action>/g, '').trim()
        setMessages(prev => [...prev, { role: 'assistant', content: response }])
        speak(response)
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Please check your connection.' }])
    }

    setLoading(false)
  }

  async function clearHistory() {
    stopSpeaking()
    await callCurryAI('clear_history', {}, session)
    setMessages([{ role: 'assistant', content: `Fresh start — what can I help you with?` }])
  }

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.avatar}>✨</div>
          <div>
            <div style={s.headerName}>Curry AI</div>
            <div style={s.headerSub}>
              {speaking ? 'Speaking...' : 'Always learning, always here'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Speaker toggle — clean like Claude */}
          <button
            onClick={() => { if (speaking) stopSpeaking(); setVoiceOn(v => !v) }}
            style={s.speakerBtn}
            title={voiceOn ? 'Voice on — click to mute' : 'Voice off — click to unmute'}
          >
            <SpeakerIcon on={voiceOn} speaking={speaking} />
          </button>

          <button style={s.iconBtn} onClick={clearHistory} title="Clear history">
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={s.messages}>
        {messages.map((msg, i) => (
          <div key={i} style={{ ...s.row, ...(msg.role === 'user' ? s.rowUser : {}) }}>
            {msg.role === 'assistant' && (
              <div style={s.aiAvatar}>✨</div>
            )}
            <div style={{
              ...s.bubble,
              ...(msg.role === 'user' ? s.bubbleUser : s.bubbleAI),
            }}>
              {msg.content.split('\n').map((line, j, arr) => (
                <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div style={s.row}>
            <div style={s.aiAvatar}>✨</div>
            <div style={{ ...s.bubble, ...s.bubbleAI, padding: '12px 16px' }}>
              <TypingDots />
            </div>
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
        <button
          style={{ ...s.sendBtn, opacity: (!input.trim() || loading) ? 0.35 : 1 }}
          onClick={sendMessage}
          disabled={!input.trim() || loading}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}

// ── In-chat Assistant Panel ───────────────────────────────────
export function CurryAssistant({ session, conversationId, messages: chatMessages, onSuggestReply, onClose }) {
  const [mode, setMode] = useState(null)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [translateLang, setTranslateLang] = useState('English')
  const [askText, setAskText] = useState('')
  const [suggestions, setSuggestions] = useState([])

  async function handleSmartReply() {
    setMode('smartreply'); setLoading(true)
    const data = await callCurryAI('smart_reply', {
      messages: chatMessages.slice(-10).map(m => ({
        isMe: m.sender_id === session.user.id,
        sender: m.profiles?.username || 'Them',
        content: m.content,
      }))
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
    if (!lastMsg) { setResult('No text message to translate.'); setLoading(false); return }
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
      <div style={s.actionRow}>
        {[
          { id: 'smartreply', label: '💬 Smart Reply', action: handleSmartReply },
          { id: 'summarize', label: '📝 Summarize', action: handleSummarize },
          { id: 'translate', label: '🌍 Translate', action: () => setMode('translate') },
          { id: 'ask', label: '🤔 Ask AI', action: () => setMode('ask') },
        ].map(({ id, label, action }) => (
          <button key={id}
            style={{ ...s.chip, ...(mode === id ? s.chipActive : {}) }}
            onClick={action}
          >{label}</button>
        ))}
      </div>

      {loading && <div style={s.hint}>Curry AI is thinking...</div>}

      {mode === 'smartreply' && !loading && suggestions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={s.hint}>Tap to send:</div>
          {suggestions.map((sg, i) => (
            <button key={i} style={s.suggestion}
              onClick={() => { onSuggestReply(sg); onClose() }}>{sg}</button>
          ))}
        </div>
      )}

      {(mode === 'summarize') && !loading && result && (
        <div style={s.result}>{result}</div>
      )}

      {mode === 'translate' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={s.miniInput} value={translateLang}
              onChange={e => setTranslateLang(e.target.value)} placeholder="Language..." />
            <button style={s.goBtn} onClick={handleTranslate}>Go</button>
          </div>
          {result && <div style={s.result}>{result}</div>}
        </div>
      )}

      {mode === 'ask' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={s.miniInput} value={askText}
              onChange={e => setAskText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
              placeholder="Ask about this chat..." />
            <button style={s.goBtn} onClick={handleAsk}>Ask</button>
          </div>
          {result && <div style={s.result}>{result}</div>}
        </div>
      )}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────
function SpeakerIcon({ on, speaking }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {on ? (
        <>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" opacity={speaking ? 1 : 0.5} />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </>
      ) : (
        <>
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      )}
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#667eea', opacity: 0.7,
          animation: `typingDot 1.2s ${i * 0.2}s infinite ease-in-out`,
        }} />
      ))}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────
const s = {
  container: {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: 'linear-gradient(180deg, #0d0d1a 0%, #111827 100%)',
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    padding: '14px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'rgba(255,255,255,0.03)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'linear-gradient(135deg,#667eea,#764ba2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
    boxShadow: '0 0 16px rgba(102,126,234,0.4)',
  },
  headerName: { fontSize: 15, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.02em' },
  headerSub: { fontSize: 11, color: '#667eea', marginTop: 1, fontWeight: 500 },
  speakerBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#888', padding: '6px', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color 0.15s, background 0.15s',
  },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#666', padding: '6px', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color 0.15s',
  },
  messages: {
    flex: 1, overflowY: 'auto', padding: '20px 18px',
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  row: { display: 'flex', gap: 10, alignItems: 'flex-end' },
  rowUser: { flexDirection: 'row-reverse' },
  aiAvatar: {
    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg,#667eea,#764ba2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
    boxShadow: '0 0 8px rgba(102,126,234,0.3)',
  },
  bubble: {
    maxWidth: '78%', padding: '11px 15px',
    fontSize: 14, lineHeight: 1.6, fontWeight: 400,
    letterSpacing: '-0.01em',
  },
  bubbleAI: {
    background: 'rgba(255,255,255,0.06)',
    color: '#e8e8f0',
    borderRadius: '4px 18px 18px 18px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  bubbleUser: {
    background: 'linear-gradient(135deg,#667eea,#764ba2)',
    color: '#fff',
    borderRadius: '18px 4px 18px 18px',
    boxShadow: '0 4px 14px rgba(102,126,234,0.3)',
  },
  inputArea: {
    padding: '12px 16px 14px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'flex-end', gap: 10,
    background: 'rgba(255,255,255,0.02)',
  },
  textarea: {
    flex: 1, resize: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 22, padding: '11px 16px',
    fontSize: 14, fontFamily: 'inherit',
    background: 'rgba(255,255,255,0.05)',
    color: '#f0f0f0', outline: 'none',
    maxHeight: 120, lineHeight: 1.5,
    transition: 'border-color 0.2s',
    letterSpacing: '-0.01em',
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: '50%',
    background: 'linear-gradient(135deg,#667eea,#764ba2)',
    border: 'none', cursor: 'pointer', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all 0.15s',
    boxShadow: '0 4px 12px rgba(102,126,234,0.4)',
  },

  // Assistant panel
  panel: {
    background: 'rgba(30,30,46,0.98)',
    borderTop: '1px solid rgba(102,126,234,0.3)',
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
    backdropFilter: 'blur(12px)',
  },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  actionRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20, color: '#a0aec0',
    fontSize: 12, fontWeight: 600, padding: '5px 12px',
    cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
  },
  chipActive: {
    background: 'linear-gradient(135deg,#667eea,#764ba2)',
    border: '1px solid #667eea', color: '#fff',
  },
  hint: { fontSize: 12, color: '#666', fontWeight: 500 },
  result: {
    fontSize: 14, color: '#e2e8f0', lineHeight: 1.55,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 10, padding: '10px 14px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  suggestion: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(102,126,234,0.3)',
    borderRadius: 10, color: '#e2e8f0',
    fontSize: 13, padding: '8px 12px',
    cursor: 'pointer', textAlign: 'left',
    width: '100%', fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  miniInput: {
    flex: 1, background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#fff',
    fontSize: 13, padding: '7px 10px',
    outline: 'none', fontFamily: 'inherit',
  },
  goBtn: {
    background: 'linear-gradient(135deg,#667eea,#764ba2)',
    border: 'none', borderRadius: 8, color: '#fff',
    fontSize: 13, fontWeight: 700, padding: '7px 14px',
    cursor: 'pointer', fontFamily: 'inherit',
  },
}

// Inject typing dot animation
const style = document.createElement('style')
style.textContent = `
  @keyframes typingDot {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-5px); opacity: 1; }
  }
  .curry-textarea:focus { border-color: rgba(102,126,234,0.5) !important; }
`
document.head.appendChild(style)
