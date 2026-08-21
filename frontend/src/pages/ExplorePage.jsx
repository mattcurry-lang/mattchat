import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/* ============================================================
   EXPLORE — "A day with Mattchat"
   Scroll-driven day-in-the-life story. Self-contained, matches
   the landing page's visual language (glass, aurora, gradients).
   ============================================================ */

const COLORS = {
  bg: '#090909',
  glass: 'rgba(255,255,255,0.045)',
  glassBorder: 'rgba(255,255,255,0.08)',
  purple: '#6C63FF',
  blue: '#4CC9F0',
  violet: '#C77DFF',
  text: '#F5F5FA',
  muted: '#9A9AB0',
}

/* ---------- shared small pieces (mirrors LandingPage.jsx) ---------- */

function Eyebrow({ children }) {
  return <div className="ex-eyebrow">{children}</div>
}

function GlowButton({ children, primary, onClick, href }) {
  const Tag = href ? 'a' : 'button'
  return (
    <Tag href={href} onClick={onClick} className={`ex-btn ${primary ? 'ex-btn-primary' : 'ex-btn-secondary'}`}>
      {children}
    </Tag>
  )
}

function BrandMark({ size = 28 }) {
  return (
    <img
      src="/logo.png"
      alt="Mattchat logo"
      className="ex-logo-mark"
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  )
}

function BrandLockup({ size = 26 }) {
  return (
    <span className="ex-brand-lockup">
      <BrandMark size={size} />
      <span className="ex-nav-logo">Mattchat</span>
    </span>
  )
}

function Icon({ name, size = 20 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'voice':
      return <svg {...common}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
    case 'mail':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
    case 'calendar':
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
    case 'task':
      return <svg {...common}><path d="M9 11l2 2 4-4" /><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
    case 'meeting':
      return <svg {...common}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3" /></svg>
    case 'weather':
      return <svg {...common}><circle cx="9" cy="10" r="4" /><path d="M13 15h4a3 3 0 0 0 0-6 5 5 0 0 0-9.6-1.5" /></svg>
    case 'music':
      return <svg {...common}><circle cx="7" cy="18" r="2.5" /><circle cx="17" cy="16" r="2.5" /><path d="M9.5 18V6l10-2v12" /></svg>
    case 'moon':
      return <svg {...common}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>
    default:
      return null
  }
}

/* ---------- the day's moments (edit copy/times freely) ---------- */

const MOMENTS = [
  {
    time: '6:42 AM',
    icon: 'voice',
    title: 'Wake up to a night that already took care of itself',
    body: "A message landed at 1 AM. Curry noticed, and had three reply options ready before you'd even opened your eyes.",
    chat: [
      { from: 'them', text: 'sent the slides, sorry so late 😅' },
      { from: 'curry', text: 'Suggested: "On it, thanks!" · "Perfect timing" · "Reviewing now"' },
    ],
  },
  {
    time: '8:15 AM',
    icon: 'mail',
    title: 'Your inbox, already summarized',
    body: 'Forty unread emails become three lines: what matters, what\'s urgent, what can wait until later.',
    chat: [
      { from: 'system', text: '12 new emails → 3 things that actually matter' },
    ],
  },
  {
    time: '9:30 AM',
    icon: 'calendar',
    title: 'Meetings that show up ready',
    body: 'Curry pulls up the shared doc and reminds everyone what was promised last time — before anyone has to ask.',
    chat: [
      { from: 'curry', text: "Here's the doc from Tuesday, plus 3 open items from last call" },
    ],
  },
  {
    time: '12:10 PM',
    icon: 'task',
    title: "Promises that don't get forgotten",
    body: 'You said "I\'ll send that by Friday" three days ago, mid-conversation. Curry remembered so you didn\'t have to.',
    chat: [
      { from: 'system', text: 'Reminder: send onboarding doc — due tomorrow' },
    ],
  },
  {
    time: '2:45 PM',
    icon: 'meeting',
    title: 'A call that takes its own notes',
    body: "While you're actually present in the conversation, Curry quietly captures who said what — nobody has to be the note-taker again.",
    chat: [
      { from: 'system', text: 'Live transcript on · Summary ready when the call ends' },
    ],
  },
  {
    time: '5:30 PM',
    icon: 'weather',
    title: 'It knows what you need before you ask',
    body: "Rain's coming and your ride isn't booked. Curry already flagged it — genuinely useful, not a gimmick bolted onto a chat app.",
    chat: [
      { from: 'curry', text: 'Might want to head out — rain forecast for 6 PM' },
    ],
  },
  {
    time: '8:00 PM',
    icon: 'music',
    title: 'Unwind, still connected',
    body: 'Music syncs with the people you\'re talking to — movie night, playlists, plans, all in the same thread as everything else.',
    chat: [
      { from: 'system', text: 'Now playing · shared with 2 friends in this chat' },
    ],
  },
  {
    time: '11:20 PM',
    icon: 'moon',
    title: 'Tomorrow, already a little lighter',
    body: "Curry's flagged what's worth your attention first thing — so tomorrow starts a step ahead, not from zero.",
    chat: [
      { from: 'system', text: 'Tomorrow at a glance: 1 reply pending · 1 meeting at 10 AM' },
    ],
  },
]

/* ---------- a single moment, scroll-revealed ---------- */

function Moment({ moment, index, onVisible }) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          onVisible(index)
        }
      },
      { threshold: 0.4 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [index, onVisible])

  const align = index % 2 === 0 ? 'left' : 'right'

  return (
    <div ref={ref} className={`ex-moment ${align} ${inView ? 'in-view' : ''}`}>
      <div className="ex-moment-dot" />
      <div className="ex-moment-card">
        <div className="ex-moment-time">
          <Icon name={moment.icon} size={15} />
          {moment.time}
        </div>
        <h3 className="ex-moment-title">{moment.title}</h3>
        <p className="ex-moment-body">{moment.body}</p>
        <div className="ex-moment-chat">
          {moment.chat.map((c, i) => (
            <div key={i} className={`ex-chat-line ${c.from}`}>
              {c.from === 'curry' && <span className="ex-chat-tag">Curry</span>}
              {c.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- scroll progress rail ---------- */

function ProgressRail({ containerRef, activeIndex, total }) {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      const total = rect.height - vh
      const scrolled = Math.min(Math.max(-rect.top, 0), total)
      setPct(total > 0 ? (scrolled / total) * 100 : 0)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [containerRef])

  return (
    <div className="ex-rail">
      <div className="ex-rail-track">
        <div className="ex-rail-fill" style={{ height: `${pct}%` }} />
      </div>
      <span className="ex-rail-label">{Math.min(activeIndex + 1, total)} / {total}</span>
    </div>
  )
}
function useNaturalPageScroll() {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')

    const targets = [html, body, root].filter(Boolean)
    const prev = targets.map((el) => ({
      el,
      overflow: el.style.overflow,
      overflowY: el.style.overflowY,
      height: el.style.height,
      maxHeight: el.style.maxHeight,
      position: el.style.position,
    }))

    targets.forEach((el) => {
      el.style.overflow = 'visible'
      el.style.overflowY = 'auto'
      el.style.height = 'auto'
      el.style.maxHeight = 'none'
      if (el.style.position === 'fixed') el.style.position = 'static'
    })

    return () => {
      prev.forEach(({ el, overflow, overflowY, height, maxHeight, position }) => {
        el.style.overflow = overflow
        el.style.overflowY = overflowY
        el.style.height = height
        el.style.maxHeight = maxHeight
        el.style.position = position
      })
    }
  }, [])
}
/* ---------- root ---------- */

export default function ExplorePage() {
  const navigate = useNavigate()
  useNaturalPageScroll()
  const storyRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const goTo = useCallback((e, path) => {
    if (e) e.preventDefault()
    navigate(path)
  }, [navigate])

  const handleVisible = useCallback((i) => {
    setActiveIndex((prev) => Math.max(prev, i))
  }, [])

  return (
    <div className="ex-root">
      <nav className="ex-nav">
        <a href="/" className="ex-nav-brand" onClick={(e) => goTo(e, '/')} aria-label="Mattchat home">
          <BrandLockup size={26} />
        </a>
        <GlowButton primary onClick={() => navigate('/auth')}>Get Started</GlowButton>
      </nav>

      <section className="ex-hero">
        <Eyebrow>EXPLORE</Eyebrow>
        <h1 className="ex-h1">A day with Mattchat.</h1>
        <p className="ex-hero-sub">
          Not a feature list. A normal day — and the moments where everything just… works.
          Scroll to follow it.
        </p>
      </section>

      <section className="ex-story" ref={storyRef}>
        <ProgressRail containerRef={storyRef} activeIndex={activeIndex} total={MOMENTS.length} />
        <div className="ex-story-line" />
        {MOMENTS.map((m, i) => (
          <Moment key={m.time} moment={m} index={i} onVisible={handleVisible} />
        ))}
      </section>

      <section className="ex-final">
        <h2 className="ex-h2 ex-center">This is one day.<br />Imagine all of them like this.</h2>
        <GlowButton primary onClick={() => navigate('/auth')}>Launch Mattchat</GlowButton>
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');

        * { box-sizing: border-box; }

        .ex-root {
          background: ${COLORS.bg}; color: ${COLORS.text};
          font-family: 'Inter', system-ui, sans-serif; min-height: 100vh;
        }

        .ex-eyebrow {
          font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; letter-spacing: 2.5px;
          color: ${COLORS.blue}; margin-bottom: 18px; font-weight: 500;
        }
        .ex-h1 {
          font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: clamp(38px, 6vw, 64px);
          line-height: 1.06; letter-spacing: -1.5px; margin: 0 0 20px;
          background: linear-gradient(120deg, #fff 40%, ${COLORS.blue} 80%, ${COLORS.violet});
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .ex-h2 {
          font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: clamp(26px, 3.4vw, 38px);
          line-height: 1.25; margin: 0 0 28px;
        }
        .ex-center { text-align: center; margin: 0 auto 28px; }

        .ex-brand-lockup { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; }
        .ex-logo-mark { display: inline-block; flex-shrink: 0; }
        .ex-nav-logo { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; }

        .ex-nav {
          position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between;
          padding: 18px 32px; backdrop-filter: blur(14px);
          background: rgba(9,9,9,0.6); border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .ex-nav-brand { text-decoration: none; color: inherit; }

        .ex-btn {
          display: inline-flex; align-items: center; justify-content: center; text-decoration: none;
          font-weight: 600; font-size: 14.5px; padding: 12px 24px; border-radius: 999px; cursor: pointer;
          border: 1px solid transparent; transition: all 0.25s ease;
        }
        .ex-btn-primary {
          background: linear-gradient(120deg, ${COLORS.purple}, ${COLORS.violet}); color: #fff;
        }
        .ex-btn-primary:hover { box-shadow: 0 0 32px 4px rgba(108,99,255,0.5); transform: translateY(-2px); }

        .ex-hero { max-width: 720px; margin: 0 auto; padding: 100px 24px 40px; text-align: center; }
        .ex-hero-sub { color: ${COLORS.muted}; font-size: 17px; line-height: 1.6; }

        /* ---------- story rail ---------- */
        .ex-story { position: relative; max-width: 900px; margin: 0 auto; padding: 60px 24px 100px; }
        .ex-story-line {
          position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; transform: translateX(-50%);
          background: linear-gradient(${COLORS.glassBorder}, ${COLORS.glassBorder});
        }

        .ex-rail {
          position: fixed; right: 28px; top: 50%; transform: translateY(-50%); z-index: 25;
          display: flex; flex-direction: column; align-items: center; gap: 10px;
        }
        .ex-rail-track {
          width: 3px; height: 160px; border-radius: 3px; background: rgba(255,255,255,0.08); overflow: hidden;
        }
        .ex-rail-fill {
          width: 100%; background: linear-gradient(${COLORS.blue}, ${COLORS.violet}); transition: height 0.15s ease-out;
        }
        .ex-rail-label {
          font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: ${COLORS.muted};
        }

        .ex-moment {
          position: relative; display: flex; padding: 60px 0; opacity: 0; transform: translateY(24px);
          transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1);
        }
        .ex-moment.in-view { opacity: 1; transform: translateY(0); }
        .ex-moment.left { justify-content: flex-start; }
        .ex-moment.right { justify-content: flex-end; }

        .ex-moment-dot {
          position: absolute; left: 50%; top: 66px; width: 10px; height: 10px; border-radius: 50%;
          transform: translateX(-50%); background: rgba(255,255,255,0.15); transition: background 0.4s ease, box-shadow 0.4s ease;
        }
        .ex-moment.in-view .ex-moment-dot {
          background: ${COLORS.blue}; box-shadow: 0 0 14px ${COLORS.blue};
        }

        .ex-moment-card {
          width: calc(50% - 40px); background: ${COLORS.glass}; border: 1px solid ${COLORS.glassBorder};
          border-radius: 18px; padding: 26px 24px; backdrop-filter: blur(18px);
          box-shadow: 0 20px 50px rgba(0,0,0,0.35);
        }
        .ex-moment-time {
          display: flex; align-items: center; gap: 6px; font-family: 'IBM Plex Mono', monospace;
          font-size: 12px; color: ${COLORS.blue}; margin-bottom: 12px; font-weight: 500;
        }
        .ex-moment-title {
          font-family: 'Space Grotesk', sans-serif; font-size: 19px; font-weight: 600; margin: 0 0 10px; line-height: 1.3;
        }
        .ex-moment-body { color: ${COLORS.muted}; font-size: 14px; line-height: 1.6; margin: 0 0 18px; }

        .ex-moment-chat { display: flex; flex-direction: column; gap: 8px; }
        .ex-chat-line {
          font-size: 12.5px; padding: 9px 12px; border-radius: 10px; line-height: 1.5;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.06);
        }
        .ex-chat-line.curry {
          background: linear-gradient(120deg, ${COLORS.purple}22, ${COLORS.violet}22); border-color: rgba(108,99,255,0.3);
        }
        .ex-chat-tag {
          display: inline-block; font-weight: 700; color: ${COLORS.violet}; margin-right: 6px; font-size: 11px;
        }

        .ex-final { text-align: center; padding: 100px 24px 140px; }

        @media (max-width: 760px) {
          .ex-story-line { left: 20px; }
          .ex-moment-dot { left: 20px; }
          .ex-moment.left, .ex-moment.right { justify-content: flex-start; padding-left: 44px; }
          .ex-moment-card { width: 100%; }
          .ex-rail { display: none; }
        }
      `}</style>
    </div>
  )
}
