import { useState, useRef, useEffect } from 'react'
import { callCurryAI } from './CurryAI'

// Drop-in replacement for the plain search-icon row at the top of the
// sidebar. Visually it's the thing that says "this isn't WhatsApp" —
// a glowing pill that both searches conversations AND can be asked a
// direct question ("weather today", "draft an email to...", etc).
//
// Behavior:
// - Typing filters the conversation list live, same as your old search
//   input (calls onSearchChange on every keystroke, exactly like before).
// - Pressing Enter (or tapping the sparkle) with no local matches, or
//   explicitly tapping "Ask Curry" chip, sends the text to Curry via
//   the existing 'chat' endpoint and shows the answer inline in a
//   small popover under the bar — it does NOT open the full Curry
//   screen, so the user never loses their place in the list.
export default function AICommandBar({ session, value, onSearchChange, onOpenCurry, hasLocalMatches }) {
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { if (value === '') setAnswer('') }, [value])

  async function askCurry() {
    if (!value.trim() || asking) return
    setAsking(true)
    setAnswer('')
    try {
      const data = await callCurryAI('chat', { message: value.trim() }, session)
      setAnswer(data.ok ? data.response.replace(/<action>[\s\S]*?<\/action>/g, '').trim() : "Couldn't get an answer right now.")
    } catch {
      setAnswer('Network error asking Curry.')
    }
    setAsking(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!hasLocalMatches) askCurry()
    }
    if (e.key === 'Escape') { setAnswer(''); inputRef.current?.blur() }
  }

  return (
    <div style={c.wrap}>
      <div style={{ ...c.bar, ...(focused ? c.barFocused : {}) }}>
        <span style={c.sparkle}>✨</span>
        <input
          ref={inputRef}
          value={value}
          onChange={e => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ask Curry anything..."
          style={c.input}
        />
        {asking ? (
          <div style={c.spinner} />
        ) : value.trim() ? (
          <button style={c.goBtn} onClick={askCurry} title="Ask Curry">→</button>
        ) : (
          <button style={c.orbBtn} onClick={onOpenCurry} title="Open Curry">🎤</button>
        )}
      </div>

      {value.trim() && !answer && !asking && (
        <div style={c.quickRow}>
          {['🎤 Voice', '📧 Email', '🌦 Weather'].map(chip => (
            <button key={chip} style={c.chip} onClick={() => { onSearchChange(chip.split(' ')[1] + ' '); inputRef.current?.focus() }}>
              {chip}
            </button>
          ))}
        </div>
      )}

      {(asking || answer) && (
        <div style={c.answerCard}>
          <div style={c.answerHeader}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>✨ Curry</span>
            <button style={c.answerClose} onClick={() => setAnswer('')}>✕</button>
          </div>
          {asking ? (
            <div style={{ fontSize: 12.5, color: '#9ca3af' }}>Thinking...</div>
          ) : (
            <div style={c.answerText}>{answer}</div>
          )}
        </div>
      )}
    </div>
  )
}

const c = {
  wrap: { position: 'relative', width: '100%' },
  bar: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(167,139,250,0.25)',
    borderRadius: 24, padding: '9px 14px',
    transition: 'all 0.2s ease',
  },
bar: {
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(167,139,250,0.35)',
  borderRadius: 24, padding: '9px 14px',
  transition: 'all 0.2s ease',
  animation: 'commandBarGlow 2.8s ease-in-out infinite',
},
  sparkle: { fontSize: 14, flexShrink: 0 },
  input: { flex: 1, background: 'none', border: 'none', outline: 'none', color: '#f0f0f0', fontSize: 13.5, fontFamily: 'inherit' },
  goBtn: { width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  orbBtn: { background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', flexShrink: 0, opacity: 0.8 },
  spinner: { width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(167,139,250,0.25)', borderTopColor: '#a78bfa', animation: 'currySpin 0.7s linear infinite', flexShrink: 0 },
  quickRow: { display: 'flex', gap: 6, marginTop: 6, paddingLeft: 4 },
  chip: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, color: '#9ca3af', fontSize: 11, fontWeight: 600, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' },
  answerCard: {
    marginTop: 8, background: 'linear-gradient(135deg, rgba(102,126,234,0.12), rgba(118,75,162,0.12))',
    border: '1px solid rgba(167,139,250,0.25)', borderRadius: 14, padding: '10px 14px',
    animation: 'curryFadeIn 0.2s ease',
  },
  answerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  answerClose: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer' },
  answerText: { fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 },
}

if (typeof document !== 'undefined' && !document.getElementById('curry-cmdbar-styles')) {
  const el = document.createElement('style')
  el.id = 'curry-cmdbar-styles'
  el.textContent = `
    @keyframes currySpin { to { transform: rotate(360deg); } }
    @keyframes curryFadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
    @keyframes commandBarGlow {
  0%, 100% {
    box-shadow: 0 0 0px rgba(167,139,250,0);
  }
  50% {
    box-shadow: 0 0 18px rgba(102,126,234,0.35), 0 0 4px rgba(240,147,251,0.25);
  }
}
  `
  document.head.appendChild(el)
}
