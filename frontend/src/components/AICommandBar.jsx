import { useState, useRef, useEffect } from 'react'
import { callCurryAI } from './CurryAI'
import { IconSparkle, IconMic, IconMail, IconCloudSun, IconX } from './Icons'

const HINTS = [
  'Ask Curry anything…',
  'Search your chats…',
  'Draft an email to Rose…',
  'What’s the weather today?',
  'Summarize my unread messages…',
]

// mode 'ask'  -> sends straight to Curry (the input stays empty so your chat list isn't filtered)
// mode 'fill' -> puts the start of a sentence in the box for you to finish
const PROMPTS = [
  { icon: IconSparkle, label: 'Summarize my unread chats', mode: 'ask', text: 'Summarize my unread chats' },
  { icon: IconCloudSun, label: 'Weather today', mode: 'ask', text: 'What is the weather today?' },
  { icon: IconMail, label: 'Draft an email…', mode: 'fill', text: 'Draft an email to ' },
  { icon: IconMic, label: 'Remind me to…', mode: 'fill', text: 'Remind me to ' },
]

const QUICK_CHIPS = [
  { icon: IconMic, label: 'Voice', fill: 'voice' },
  { icon: IconMail, label: 'Email', fill: 'email' },
  { icon: IconCloudSun, label: 'Weather', fill: 'weather' },
]

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '')
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function AICommandBar({ session, value, onSearchChange, onOpenCurry, hasLocalMatches }) {
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState('')
  const [asked, setAsked] = useState('')
  const [focused, setFocused] = useState(false)
  const [hintIdx, setHintIdx] = useState(0)
  const inputRef = useRef(null)

  // clearing the box dismisses the answer (only when the TEXT changes, so a chip-asked answer survives)
  useEffect(() => { if (value === '') setAnswer('') }, [value])

  // rotate the hint while the bar is idle (skipped for reduced-motion users)
  useEffect(() => {
    if (focused || value || prefersReducedMotion()) return undefined
    const id = setInterval(() => setHintIdx((i) => (i + 1) % HINTS.length), 3800)
    return () => clearInterval(id)
  }, [focused, value])

  // Ctrl/⌘+K focuses the bar from anywhere; "/" does too when you're not typing in a field
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      const typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus(); inputRef.current?.select()
      } else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function askCurry(text) {
    const q = (text ?? value ?? '').trim()
    if (!q || asking) return
    setAsking(true)
    setAnswer('')
    setAsked(q)
    try {
      const data = await callCurryAI('chat', { message: q }, session)
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

  const runPrompt = (p) => {
    if (p.mode === 'ask') { askCurry(p.text); inputRef.current?.blur() }
    else { onSearchChange(p.text); inputRef.current?.focus() }
  }

  const showPanel = focused && !value.trim() && !answer && !asking
  const kbd = isMac() ? '⌘ K' : 'Ctrl K'

  return (
    <div className="mc-bar-wrap" role="search">
      <div className={`mc-bar${focused ? ' is-focused' : ''}${asking ? ' is-asking' : ''}`}>
        <div className="mc-bar-in">
          <span className="mc-orb" aria-hidden><IconSparkle size={13} /></span>

          <div className="mc-field">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-label="Search chats or ask Curry"
              autoComplete="off"
              spellCheck={false}
            />
            {!value && (
              focused
                ? <span className="mc-ph" aria-hidden>Search chats or ask Curry…</span>
                : <span key={hintIdx} className="mc-ph mc-ph-rot" aria-hidden>{HINTS[hintIdx]}</span>
            )}
          </div>

          {asking ? (
            <span className="mc-dots" aria-label="Curry is thinking"><i /><i /><i /></span>
          ) : value.trim() ? (
            <>
              <button className="mc-ico" onClick={() => onSearchChange('')} aria-label="Clear" title="Clear"><IconX size={12} /></button>
              <button className="mc-ico mc-go" onClick={() => askCurry()} aria-label="Ask Curry" title="Ask Curry (Enter)">→</button>
            </>
          ) : (
            <>
              {!focused && <kbd className="mc-kbd" aria-hidden>{kbd}</kbd>}
              <button className="mc-ico" onClick={onOpenCurry} aria-label="Open Curry" title="Open Curry"><IconMic size={14} /></button>
            </>
          )}
        </div>
      </div>

      {showPanel && (
        <div className="mc-panel" onMouseDown={(e) => e.preventDefault()}>
          <div className="mc-panel-title">Try asking Curry</div>
          <div className="mc-chips">
            {PROMPTS.map((p) => (
              <button key={p.label} className="mc-chip" onClick={() => runPrompt(p)}>
                <p.icon size={12} /> {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {value.trim() && !answer && !asking && (
        <div className="mc-quick">
          {QUICK_CHIPS.map(({ icon: Icon, label, fill }) => (
            <button key={label} className="mc-chip mc-chip-sm" onClick={() => { onSearchChange(fill + ' '); inputRef.current?.focus() }}>
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>
      )}

      {(asking || answer) && (
        <div className="mc-answer" aria-live="polite">
          <div className="mc-answer-head">
            <span className="mc-answer-who"><IconSparkle size={11} /> Curry</span>
            <button className="mc-ico mc-ico-sm" onClick={() => { setAnswer(''); setAsked('') }} aria-label="Dismiss answer"><IconX size={10} /></button>
          </div>
          {asked && <div className="mc-answer-q">“{asked}”</div>}
          {asking ? (
            <div className="mc-skel" aria-hidden><i style={{ width: '92%' }} /><i style={{ width: '78%' }} /><i style={{ width: '55%' }} /></div>
          ) : (
            <>
              <div className="mc-answer-text">{answer}</div>
              <button className="mc-continue" onClick={onOpenCurry}>Continue in Curry →</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

if (typeof document !== 'undefined' && !document.getElementById('curry-cmdbar-styles')) {
  const el = document.createElement('style')
  el.id = 'curry-cmdbar-styles'
  el.textContent = `
    /* keyframes other components already rely on */
    @keyframes currySpin { to { transform: rotate(360deg); } }
    @keyframes curryFadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
    @keyframes commandBarGlow { 0%,100% { box-shadow:0 0 0 rgba(167,139,250,0); } 50% { box-shadow:0 0 18px rgba(102,126,234,.35), 0 0 4px rgba(240,147,251,.25); } }

    @property --mc-ang { syntax:'<angle>'; inherits:false; initial-value:0deg; }
    @keyframes mc-orbit { to { --mc-ang:360deg; } }
    @keyframes mc-ph-in { from { opacity:0; transform:translateY(-35%); } to { opacity:1; transform:translateY(-50%); } }
    @keyframes mc-pop { from { opacity:0; transform:translateY(-6px) scale(.985); } to { opacity:1; transform:none; } }
    @keyframes mc-bounce { 0%,80%,100% { transform:translateY(0); opacity:.5; } 40% { transform:translateY(-4px); opacity:1; } }
    @keyframes mc-shimmer { 0% { background-position:-200px 0; } 100% { background-position:200px 0; } }
    @keyframes mc-orb { 0%,100% { box-shadow:0 0 0 0 rgba(167,139,250,.5); } 50% { box-shadow:0 0 0 5px rgba(167,139,250,0); } }

    .mc-bar-wrap { position:relative; z-index:40; width:100%; --mc-bar-bg:rgba(22,18,40,.86); --mc-ink:var(--dark-text,#f0f0f0); --mc-mute:var(--dark-muted,rgba(255,255,255,.5)); }

    /* the border IS the animation: a rotating conic gradient behind a glass fill */
    .mc-bar {
      border-radius:999px; padding:1.5px;
      background:conic-gradient(from var(--mc-ang), rgba(108,99,255,.22), rgba(167,139,250,.7), rgba(240,147,251,.6), rgba(94,234,212,.5), rgba(108,99,255,.22));
      animation:mc-orbit 10s linear infinite;
      transition:box-shadow .3s ease, transform .3s ease;
    }
    .mc-bar.is-focused {
      animation-duration:4s;
      background:conic-gradient(from var(--mc-ang), #6c63ff, #a78bfa, #f093fb, #5eead4, #6c63ff);
      box-shadow:0 0 0 4px rgba(167,139,250,.14), 0 12px 38px rgba(108,99,255,.38);
    }
    .mc-bar.is-asking { animation-duration:1.4s; }

    .mc-bar-in {
      display:flex; align-items:center; gap:10px; padding:9px 12px 9px 10px; border-radius:999px;
      background:var(--mc-bar-bg);
      -webkit-backdrop-filter:blur(14px) saturate(160%); backdrop-filter:blur(14px) saturate(160%);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.1);
    }
    .mc-orb { width:24px; height:24px; flex-shrink:0; border-radius:50%; display:grid; place-items:center; color:#fff; background:linear-gradient(135deg,#6c63ff,#a78bfa 60%,#f093fb); animation:mc-orb 2.8s ease-in-out infinite; }

    .mc-field { position:relative; flex:1; min-width:0; }
    .mc-field input { width:100%; background:none; border:none; outline:none; color:var(--mc-ink); font-size:14px; font-family:inherit; padding:0; }
    .mc-ph { position:absolute; left:0; top:50%; transform:translateY(-50%); max-width:100%; pointer-events:none; color:var(--mc-mute); font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .mc-ph-rot { animation:mc-ph-in .45s ease both; }

    .mc-kbd { font-family:inherit; font-size:10.5px; font-weight:700; letter-spacing:.2px; padding:3px 7px; border-radius:7px; white-space:nowrap; color:var(--mc-mute); background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); }
    @media (hover:none) { .mc-kbd { display:none; } }

    .mc-ico { width:28px; height:28px; flex-shrink:0; border:none; border-radius:50%; display:grid; place-items:center; cursor:pointer; padding:0; background:transparent; color:#a78bfa; font-family:inherit; transition:background .15s, transform .12s; }
    .mc-ico:hover { background:rgba(167,139,250,.16); }
    .mc-ico:active { transform:scale(.9); }
    .mc-ico:focus-visible, .mc-chip:focus-visible, .mc-continue:focus-visible { outline:2px solid #a78bfa; outline-offset:2px; }
    .mc-ico-sm { width:22px; height:22px; color:var(--mc-mute); }
    .mc-go { color:#fff; font-size:14px; font-weight:700; background:linear-gradient(135deg,#6c63ff,#a78bfa); box-shadow:0 4px 14px rgba(108,99,255,.5); }
    .mc-go:hover { background:linear-gradient(135deg,#7a72ff,#b79cff); }

    .mc-dots { display:flex; gap:4px; align-items:center; padding:0 6px; }
    .mc-dots i { width:5px; height:5px; border-radius:50%; background:#a78bfa; animation:mc-bounce 1s ease-in-out infinite; }
    .mc-dots i:nth-child(2) { animation-delay:.15s; } .mc-dots i:nth-child(3) { animation-delay:.3s; }

    .mc-panel {
      position:absolute; left:0; right:0; top:calc(100% + 10px); padding:12px 12px 14px; border-radius:20px;
      background:rgba(24,20,44,.94); border:1px solid rgba(255,255,255,.12);
      -webkit-backdrop-filter:blur(18px) saturate(170%); backdrop-filter:blur(18px) saturate(170%);
      box-shadow:0 24px 60px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.12);
      animation:mc-pop .22s cubic-bezier(.2,.9,.3,1);
    }
    .mc-panel-title { font-size:10.5px; font-weight:800; letter-spacing:.7px; text-transform:uppercase; color:var(--mc-mute); margin:0 4px 9px; }
    .mc-chips { display:flex; flex-wrap:wrap; gap:7px; }
    .mc-chip { display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border-radius:999px; cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:600; color:var(--mc-ink); background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); transition:background .15s, border-color .15s, transform .12s; }
    .mc-chip:hover { background:rgba(167,139,250,.18); border-color:rgba(167,139,250,.5); }
    .mc-chip:active { transform:scale(.97); }
    .mc-chip svg { color:#a78bfa; }
    .mc-quick { display:flex; gap:6px; margin-top:8px; padding-left:4px; }
    .mc-chip-sm { padding:4px 10px; font-size:11px; }

    .mc-answer { margin-top:10px; padding:12px 14px; border-radius:18px; background:linear-gradient(135deg, rgba(102,126,234,.14), rgba(118,75,162,.14)); border:1px solid rgba(167,139,250,.28); animation:curryFadeIn .2s ease; }
    .mc-answer-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
    .mc-answer-who { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:800; color:#c4b5fd; }
    .mc-answer-q { font-size:11.5px; color:var(--mc-mute); margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .mc-answer-text { font-size:13px; line-height:1.55; color:var(--mc-ink); white-space:pre-wrap; }
    .mc-continue { margin-top:10px; background:none; border:none; padding:0; cursor:pointer; font-family:inherit; font-size:12px; font-weight:700; color:#a78bfa; }
    .mc-skel { display:flex; flex-direction:column; gap:7px; padding-top:4px; }
    .mc-skel i { display:block; height:9px; border-radius:5px; background:linear-gradient(90deg, rgba(255,255,255,.07) 25%, rgba(167,139,250,.28) 50%, rgba(255,255,255,.07) 75%); background-size:400px 100%; animation:mc-shimmer 1.3s linear infinite; }

    [data-theme="light"] .mc-bar-wrap { --mc-bar-bg:rgba(255,255,255,.92); --mc-ink:#1b1730; --mc-mute:rgba(27,23,48,.5); }
    [data-theme="light"] .mc-kbd { background:rgba(108,99,255,.07); border-color:rgba(108,99,255,.2); }
    [data-theme="light"] .mc-panel { background:rgba(255,255,255,.96); border-color:rgba(108,99,255,.2); box-shadow:0 24px 60px rgba(108,99,255,.2), inset 0 1px 0 #fff; }
    [data-theme="light"] .mc-chip { background:rgba(108,99,255,.06); border-color:rgba(108,99,255,.18); }
    [data-theme="light"] .mc-answer-text { color:#1b1730; }

    @media (prefers-reduced-motion: reduce) {
      .mc-bar, .mc-orb, .mc-ph-rot, .mc-dots i, .mc-skel i, .mc-panel { animation:none; }
      .mc-bar { background:linear-gradient(135deg, rgba(167,139,250,.6), rgba(108,99,255,.4)); }
      .mc-bar.is-focused { background:linear-gradient(135deg,#a78bfa,#6c63ff); }
    }
  `
  document.head.appendChild(el)
}
