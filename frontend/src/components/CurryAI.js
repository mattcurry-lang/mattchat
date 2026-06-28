import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

async function callCurryAI(type, payload, session) {
  const res = await fetch(
    'https://bqerkvywgxoioocbkxif.supabase.co/functions/v1/curry-ai',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ type, ...payload }),
    }
  )
  return res.json()
}

// ── Voice Engine ─────────────────────────────────────────────
function useVoiceEngine() {
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(null)
  const [speaking, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const utteranceRef = useRef(null)

  useEffect(() => {
    function loadVoices() {
      const available = window.speechSynthesis.getVoices()
      if (available.length === 0) return
      setVoices(available)
      // Pick best default: prefer Google/Microsoft natural voices in English
      const preferred = available.find(v =>
        v.name.includes('Google') && v.lang.startsWith('en')
      ) || available.find(v =>
        (v.name.includes('Microsoft') || v.name.includes('Samantha') || v.name.includes('Daniel')) && v.lang.startsWith('en')
      ) || available.find(v => v.lang.startsWith('en'))
      || available[0]
      setSelectedVoice(preferred)
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  const speak = useCallback((text) => {
    if (!voiceEnabled || !text) return
    window.speechSynthesis.cancel()

    // Clean text for speech (remove markdown, emojis, etc.)
    const clean = text
      .replace(/[*_~`#]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
      .trim()

    const utterance = new SpeechSynthesisUtterance(clean)
    if (selectedVoice) utterance.voice = selectedVoice
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [voiceEnabled, selectedVoice])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  return { voices, selectedVoice, setSelectedVoice, speaking, voiceEnabled, setVoiceEnabled, speak, stop }
}

// ── Voice Settings Panel ──────────────────────────────────────
function VoiceSettings({ voices, selectedVoice, setSelectedVoice, voiceEnabled, setVoiceEnabled, onClose }) {
  const grouped = {
    'English': voices.filter(v => v.lang.startsWith('en')),
    'Other Languages': voices.filter(v => !v.lang.startsWith('en')),
  }

  return (
    <div style={styles.settingsOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.settingsPanel}>
        <div style={styles.settingsHeader}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>🔊 Voice Settings</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Voice on/off toggle */}
        <div style={styles.toggleRow}>
          <span style={styles.toggleLabel}>Auto-speak responses</span>
          <button
            onClick={() => setVoiceEnabled(v => !v)}
            style={{
              ...styles.toggle,
              background: voiceEnabled ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#3a3a4e',
            }}
          >
            <div style={{
              ...styles.toggleThumb,
              transform: voiceEnabled ? 'translateX(20px)' : 'translateX(0)',
            }} />
          </button>
        </div>

        {voiceEnabled && (
          <>
            <div style={styles.sectionLabel}>Choose voice</div>
            <div style={styles.voiceList}>
              {Object.entries(grouped).map(([group, groupVoices]) =>
                groupVoices.length === 0 ? null : (
                  <div key={group}>
                    <div style={styles.voiceGroup}>{group}</div>
                    {groupVoices.map(voice => (
                      <button
                        key={voice.name}
                        style={{
                          ...styles.voiceOption,
                          ...(selectedVoice?.name === voice.name ? styles.voiceOptionActive : {}),
                        }}
                        onClick={() => setSelectedVoice(voice)}
                      >
                        <div style={styles.voiceName}>{voice.name}</div>
                        <div style={styles.voiceLang}>{voice.lang}</div>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main CurryAI Chat ─────────────────────────────────────────
export default function CurryAIChat({ session }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hey! I'm Curry AI ✨ — your personal assistant inside Mattchat.\n\nI can send messages, schedule them, summarize chats, translate, create polls & tasks, draft emails, and answer anything you ask.\n\nJust tell me what you need, or say "Hey Curry" anytime to activate me by voice!`
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [showVoiceSettings, setShowVoiceSettings] = useState(false)
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)

  const { voices, selectedVoice, setSelectedVoice, speaking, voiceEnabled, setVoiceEnabled, speak, stop } = useVoiceEngine()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load history
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
          { role: 'assistant', content: `Welcome back! I remember our previous conversations. What can I help you with?` },
          ...data.map(m => ({ role: m.role, content: m.content }))
        ])
      }
    }
    loadHistory()
  }, [])

  async function sendMessage(text) {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const data = await callCurryAI('chat', { message: userMsg }, session)
      if (data.ok) {
        const cleanResponse = data.response.replace(/<action>[\s\S]*?<\/action>/g, '').trim()
        const newMsg = { role: 'assistant', content: cleanResponse || data.response }
        setMessages(prev => [...prev, newMsg])
        // Auto-speak the response
        speak(cleanResponse || data.response)
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Please check your connection.' }])
    }

    setLoading(false)
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice input not supported in this browser. Try Chrome.'); return }

    stop() // Stop any current speech before listening

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = selectedVoice?.lang || 'en-US'
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onresult = (e) => { sendMessage(e.results[0][0].transcript) }
    recognition.onerror = () => setListening(false)
    recognition.start()
    recognitionRef.current = recognition
  }

  async function clearHistory() {
    await callCurryAI('clear_history', {}, session)
    stop()
    setMessages([{ role: 'assistant', content: `Chat cleared! Fresh start — what can I help you with?` }])
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.avatar}>✨</div>
          <div>
            <div style={styles.headerName}>Curry AI</div>
            <div style={styles.headerSub}>
              {speaking ? '🔊 Speaking...' : listening ? '🎙️ Listening...' : 'Always learning, always here'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {/* Voice toggle */}
          <button
            style={{ ...styles.iconBtn, color: voiceEnabled ? '#667eea' : '#555' }}
            onClick={() => setVoiceEnabled(v => !v)}
            title={voiceEnabled ? 'Voice on — click to mute' : 'Voice off — click to unmute'}
          >
            {voiceEnabled ? '🔊' : '🔇'}
          </button>
          {/* Voice settings */}
          <button
            style={styles.iconBtn}
            onClick={() => setShowVoiceSettings(true)}
            title="Voice settings"
          >
            ⚙️
          </button>
          <button style={styles.iconBtn} onClick={clearHistory} title="Clear history">🗑️</button>
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {messages.map((msg, i) => (
          <div key={i} style={{ ...styles.msgRow, ...(msg.role === 'user' ? styles.msgRowUser : {}) }}>
            {msg.role === 'assistant' && <div style={styles.aiAvatar}>✨</div>}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
              <div style={{ ...styles.bubble, ...(msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI) }}>
                {msg.content.split('\n').map((line, j) => (
                  <span key={j}>{line}{j < msg.content.split('\n').length - 1 && <br />}</span>
                ))}
              </div>
              {/* Replay button on AI messages */}
              {msg.role === 'assistant' && (
                <button
                  style={styles.replayBtn}
                  onClick={() => speak(msg.content)}
                  title="Replay voice"
                >
                  🔊 Replay
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={styles.msgRow}>
            <div style={styles.aiAvatar}>✨</div>
            <div style={{ ...styles.bubble, ...styles.bubbleAI }}>
              <div style={styles.typing}><span /><span /><span /></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        <button
          style={{ ...styles.voiceBtn, ...(listening ? styles.voiceBtnActive : {}) }}
          onClick={startVoice}
          title={listening ? 'Listening...' : 'Speak to Curry'}
        >
          {listening ? '🔴' : '🎙️'}
        </button>
        <textarea
          style={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Ask Curry anything..."
          rows={1}
        />
        {speaking && (
          <button style={styles.stopBtn} onClick={stop} title="Stop speaking">⏹</button>
        )}
        <button
          style={{ ...styles.sendBtn, opacity: (!input.trim() || loading) ? 0.4 : 1 }}
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
        >➤</button>
      </div>

      {/* Voice settings modal */}
      {showVoiceSettings && (
        <VoiceSettings
          voices={voices}
          selectedVoice={selectedVoice}
          setSelectedVoice={setSelectedVoice}
          voiceEnabled={voiceEnabled}
          setVoiceEnabled={setVoiceEnabled}
          onClose={() => setShowVoiceSettings(false)}
        />
      )}
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

  const { speak } = useVoiceEngine()

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
    if (data.ok) { setResult(data.response); speak(data.response) }
    setLoading(false)
  }

  async function handleTranslate() {
    setMode('translate'); setLoading(true)
    const lastMsg = chatMessages.filter(m => m.message_type === 'text').slice(-1)[0]
    if (!lastMsg) { setResult('No text message to translate.'); setLoading(false); return }
    const data = await callCurryAI('translate', { message: lastMsg.content, targetLanguage: translateLang }, session)
    if (data.ok) { setResult(data.response); speak(data.response) }
    setLoading(false)
  }

  async function handleAsk() {
    if (!askText.trim()) return
    setLoading(true)
    const data = await callCurryAI('chat', { message: `About this conversation: ${askText}` }, session)
    if (data.ok) { setResult(data.response); speak(data.response) }
    setLoading(false)
  }

  return (
    <div style={styles.assistantPanel}>
      <div style={styles.assistantHeader}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>✨ Curry AI</span>
        <button style={styles.iconBtn} onClick={onClose}>✕</button>
      </div>
      <div style={styles.actionGrid}>
        {[
          { id: 'smartreply', icon: '💬', label: 'Smart Reply', action: handleSmartReply },
          { id: 'summarize', icon: '📝', label: 'Summarize', action: handleSummarize },
          { id: 'translate', icon: '🌍', label: 'Translate', action: () => setMode('translate') },
          { id: 'ask', icon: '🤔', label: 'Ask AI', action: () => setMode('ask') },
        ].map(({ id, icon, label, action }) => (
          <button key={id} style={{ ...styles.actionBtn, ...(mode === id ? styles.actionBtnActive : {}) }} onClick={action}>
            {icon} {label}
          </button>
        ))}
      </div>
      <div style={styles.resultArea}>
        {loading && <div style={styles.statusText}>Curry AI is thinking...</div>}
        {mode === 'smartreply' && !loading && suggestions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={styles.statusText}>Tap a suggestion to send:</div>
            {suggestions.map((s, i) => (
              <button key={i} style={styles.suggestionBtn} onClick={() => { onSuggestReply(s); onClose() }}>{s}</button>
            ))}
          </div>
        )}
        {mode === 'summarize' && !loading && result && <div style={styles.resultText}>{result}</div>}
        {mode === 'translate' && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={styles.miniInput} value={translateLang} onChange={e => setTranslateLang(e.target.value)} placeholder="Target language..." />
              <button style={styles.goBtn} onClick={handleTranslate}>Go</button>
            </div>
            {result && <div style={styles.resultText}>{result}</div>}
          </div>
        )}
        {mode === 'ask' && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={styles.miniInput} value={askText} onChange={e => setAskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAsk()} placeholder="Ask about this chat..." />
              <button style={styles.goBtn} onClick={handleAsk}>Ask</button>
            </div>
            {result && <div style={styles.resultText}>{result}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'linear-gradient(180deg,#0f0f1a 0%,#1a1a2e 100%)' },
  header: { padding: '14px 16px', borderBottom: '1px solid #2a2a3e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1e1e2e' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 },
  headerName: { fontSize: 15, fontWeight: 700, color: '#fff' },
  headerSub: { fontSize: 11, color: '#667eea', marginTop: 1 },
  iconBtn: { background: 'none', border: 'none', color: '#888', fontSize: 16, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, transition: 'color 0.15s' },
  messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 },
  msgRow: { display: 'flex', gap: 8, alignItems: 'flex-end' },
  msgRowUser: { flexDirection: 'row-reverse' },
  aiAvatar: { width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 },
  bubble: { maxWidth: '75%', padding: '10px 14px', borderRadius: 16, fontSize: 14, lineHeight: 1.5 },
  bubbleAI: { background: '#2a2a3e', color: '#e2e8f0', borderRadius: '4px 16px 16px 16px' },
  bubbleUser: { background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', borderRadius: '16px 4px 16px 16px' },
  replayBtn: { background: 'none', border: 'none', color: '#555', fontSize: 11, cursor: 'pointer', padding: '2px 6px', borderRadius: 6, fontFamily: 'inherit', transition: 'color 0.15s' },
  typing: { display: 'flex', gap: 4, padding: '2px 0' },
  inputArea: { padding: '12px 16px', borderTop: '1px solid #2a2a3e', display: 'flex', alignItems: 'flex-end', gap: 8, background: '#1e1e2e' },
  voiceBtn: { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 6, borderRadius: '50%', flexShrink: 0, transition: 'background 0.15s' },
  voiceBtnActive: { background: 'rgba(252,129,129,0.2)' },
  stopBtn: { background: 'rgba(99,102,241,0.15)', border: 'none', borderRadius: 8, color: '#667eea', fontSize: 16, cursor: 'pointer', padding: '6px 10px', flexShrink: 0 },
  input: { flex: 1, resize: 'none', border: '1px solid #3a3a4e', borderRadius: 20, padding: '10px 16px', fontSize: 14, fontFamily: 'inherit', background: '#2a2a3e', color: '#fff', outline: 'none', maxHeight: 120 },
  sendBtn: { width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  // Voice settings
  settingsOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000, padding: '0 0 20px' },
  settingsPanel: { background: '#1e1e2e', borderRadius: 20, padding: 20, width: '100%', maxWidth: 420, maxHeight: '70vh', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 -8px 40px rgba(0,0,0,0.4)' },
  settingsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer' },
  toggleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' },
  toggleLabel: { fontSize: 14, color: '#e2e8f0', fontWeight: 500 },
  toggle: { width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 },
  toggleThumb: { position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'transform 0.2s' },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em' },
  voiceList: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  voiceGroup: { fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 0 4px' },
  voiceOption: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'none', border: '1px solid #2a2a3e', borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' },
  voiceOptionActive: { background: 'rgba(102,126,234,0.15)', borderColor: '#667eea' },
  voiceName: { fontSize: 13, color: '#e2e8f0', fontWeight: 500 },
  voiceLang: { fontSize: 11, color: '#555' },

  // Assistant panel
  assistantPanel: { background: '#1e1e2e', borderRadius: '16px 16px 0 0', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, borderTop: '2px solid #667eea' },
  assistantHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  actionGrid: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  actionBtn: { background: '#2a2a3e', border: '1px solid #3a3a4e', borderRadius: 20, color: '#a0aec0', fontSize: 12, padding: '6px 12px', cursor: 'pointer', transition: 'all 0.15s' },
  actionBtnActive: { background: 'linear-gradient(135deg,#667eea,#764ba2)', border: '1px solid #667eea', color: '#fff' },
  resultArea: { minHeight: 60 },
  statusText: { fontSize: 13, color: '#888', marginBottom: 8 },
  resultText: { fontSize: 14, color: '#e2e8f0', lineHeight: 1.5, background: '#2a2a3e', borderRadius: 10, padding: '10px 14px' },
  suggestionBtn: { background: '#2a2a3e', border: '1px solid #667eea', borderRadius: 10, color: '#e2e8f0', fontSize: 13, padding: '8px 12px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s' },
  miniInput: { flex: 1, background: '#2a2a3e', border: '1px solid #3a3a4e', borderRadius: 8, color: '#fff', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: 'inherit' },
  goBtn: { background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, padding: '7px 14px', cursor: 'pointer' },
}
