import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
/* ============================================================
   MATTCHAT — "The Future of Human Communication" landing page
   Self-contained: styles live in the <style> block at the bottom
   of this file (same pattern used elsewhere in the app for
   component-scoped keyframes). No external deps beyond React.
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

/* ---------- small building blocks ---------- */

function Eyebrow({ children }) {
  return <div className="mc-eyebrow">{children}</div>
}

function GlassCard({ children, style, className = '', ...rest }) {
  return (
    <div className={`mc-glass ${className}`} style={style} {...rest}>
      {children}
    </div>
  )
}

function GlowButton({ children, primary, onClick, href, ariaLabel }) {
  const Tag = href ? 'a' : 'button'
  return (
    <Tag
      href={href}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`mc-btn ${primary ? 'mc-btn-primary' : 'mc-btn-secondary'}`}
    >
      {children}
    </Tag>
  )
}

/*
  ---------- BRAND MARK ----------
  TODO(Lainey): This project already has a real Mattchat logo asset /
  Logo component used elsewhere in the app (per the spec doc, item 5).
  I don't have that file in this conversation, so this is a placeholder
  monogram that matches the existing gradient language. Swap the <span
  className="mc-logo-mark"> block below for your real <Logo /> import,
  e.g.:

    import Logo from '../components/Logo' // <- real path
    ...
    <Logo className="mc-logo-mark" />

  Once wired up, remove this comment block.
*/
function BrandMark({ size = 28 }) {
  return (
    <span
      className="mc-logo-mark"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Mattchat logo"
    >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none">
        <path
          d="M4 12a8 8 0 1 1 3.2 6.4L4 20l1.4-3.6A7.96 7.96 0 0 1 4 12z"
          stroke="white"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function BrandLockup({ size = 28, textClassName = 'mc-nav-logo' }) {
  return (
    <span className="mc-brand-lockup">
      <BrandMark size={size} />
      <span className={textClassName}>Mattchat</span>
    </span>
  )
}

/* Simple line-icon set, drawn by hand so nothing depends on an
   external icon package. Kept minimal and consistent stroke weight. */
function Icon({ name, size = 22 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'spark':
      return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></svg>
    case 'link':
      return <svg {...common}><path d="M9 15L15 9" /><path d="M10 6l1-1a4 4 0 1 1 6 6l-1 1" /><path d="M14 18l-1 1a4 4 0 1 1-6-6l1-1" /></svg>
    case 'future':
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>
    case 'voice':
      return <svg {...common}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
    case 'calendar':
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
    case 'mail':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
    case 'reply':
      return <svg {...common}><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v2" /></svg>
    case 'meeting':
      return <svg {...common}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3" /></svg>
    case 'doc':
      return <svg {...common}><path d="M6 2h9l5 5v15H6z" /><path d="M15 2v5h5M9 13h6M9 17h6" /></svg>
    case 'weather':
      return <svg {...common}><circle cx="9" cy="10" r="4" /><path d="M13 15h4a3 3 0 0 0 0-6 5 5 0 0 0-9.6-1.5" /></svg>
    case 'task':
      return <svg {...common}><path d="M9 11l2 2 4-4" /><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
    default:
      return null
  }
}

/* ---------- section: hero ---------- */

function HeroDashboard() {
  return (
    <div className="mc-hero-dash" aria-hidden="true">
      <div className="mc-dash-card mc-dash-chat">
        <div className="mc-dash-head"><Icon name="voice" size={14} /> Messages</div>
        <div className="mc-dash-bubble mc-dash-bubble-them">Ready for the call?</div>
        <div className="mc-dash-bubble mc-dash-bubble-me">Two minutes out ✨</div>
      </div>
      <div className="mc-dash-card mc-dash-call">
        <div className="mc-dash-head"><Icon name="meeting" size={14} /> Video</div>
        <div className="mc-dash-avatars">
          <span className="mc-dash-avatar" /><span className="mc-dash-avatar" />
        </div>
      </div>
      <div className="mc-dash-card mc-dash-cal">
        <div className="mc-dash-head"><Icon name="calendar" size={14} /> Calendar</div>
        <div className="mc-dash-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className={`mc-dash-dot ${i === 5 ? 'active' : ''}`} />
          ))}
        </div>
      </div>
      <div className="mc-dash-card mc-dash-mail">
        <div className="mc-dash-head"><Icon name="mail" size={14} /> Inbox</div>
        <div className="mc-dash-line" style={{ width: '78%' }} />
        <div className="mc-dash-line" style={{ width: '54%' }} />
      </div>
      <div className="mc-dash-core">
        <div className="mc-dash-core-ring" />
        <div className="mc-dash-core-glow" />
        <span className="mc-dash-core-label">Curry</span>
      </div>
      <svg className="mc-dash-lines" viewBox="0 0 480 420" fill="none">
        <path d="M120 90 L235 205" className="mc-dash-path" />
        <path d="M360 100 L245 205" className="mc-dash-path" />
        <path d="M110 320 L230 225" className="mc-dash-path" />
        <path d="M370 320 L250 225" className="mc-dash-path" />
      </svg>
    </div>
  )
}

function HeroSection({ onGetStarted }) {
  return (
    <section className="mc-section mc-hero">
      <div className="mc-hero-grid">
        <div>
          <Eyebrow>MATTCHAT</Eyebrow>
          <h1 className="mc-h1">The Future of<br />Human Communication.</h1>
          <p className="mc-sub">
            Mattchat is the intelligent communication platform that unifies conversations, email,
            meetings, and AI assistance into one seamless experience.
          </p>
          <div className="mc-hero-actions">
            <GlowButton primary onClick={onGetStarted}>Get Started</GlowButton>
            <GlowButton href="#platform">Explore</GlowButton>
          </div>
        </div>
        <HeroDashboard />
      </div>
    </section>
  )
}

/* ---------- section: why mattchat ---------- */

const WHY_CARDS = [
  { icon: 'spark', title: 'Intelligent Conversations', body: 'AI understands context and helps naturally, right inside the conversation you\'re already having.' },
  { icon: 'link', title: 'Everything Connected', body: 'Messaging, email, meetings, and productivity — one platform instead of six open tabs.' },
  { icon: 'future', title: 'Built For The Future', body: 'Designed for how people will actually communicate tomorrow, not how apps have always worked.' },
]

function WhySection() {
  return (
    <section className="mc-section">
      <Eyebrow>WHY MATTCHAT</Eyebrow>
      <h2 className="mc-h2">A different kind of inbox for a different kind of day.</h2>
      <div className="mc-why-grid">
        {WHY_CARDS.map((c) => (
          <GlassCard key={c.title} className="mc-why-card">
            <div className="mc-why-icon"><Icon name={c.icon} /></div>
            <h3 className="mc-h3">{c.title}</h3>
            <p className="mc-p">{c.body}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  )
}

/* ---------- section: Curry AI core (signature moment) ---------- */

const CURRY_ABILITIES = [
  { icon: 'voice', label: 'Voice Assistant' },
  { icon: 'calendar', label: 'Scheduling' },
  { icon: 'mail', label: 'Email Intelligence' },
  { icon: 'reply', label: 'Smart Replies' },
  { icon: 'meeting', label: 'Meeting Assistant' },
  { icon: 'doc', label: 'Document Analysis' },
  { icon: 'weather', label: 'Weather' },
  { icon: 'task', label: 'Productivity' },
]

function CurryCore() {
  const wrapRef = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect() }
    }, { threshold: 0.35 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div className={`mc-curry-wrap ${inView ? 'in-view' : ''}`} ref={wrapRef}>
      <div className="mc-curry-orb">
        <div className="mc-curry-orb-core" />
        <div className="mc-curry-orb-ring r1" />
        <div className="mc-curry-orb-ring r2" />
      </div>
      <div className="mc-curry-abilities">
        {CURRY_ABILITIES.map((a, i) => {
          const angle = (360 / CURRY_ABILITIES.length) * i
          return (
            <div
              key={a.label}
              className="mc-ability"
              style={{ '--angle': `${angle}deg`, transitionDelay: `${i * 60}ms` }}
            >
              <div className="mc-ability-chip">
                <Icon name={a.icon} size={16} />
                <span>{a.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CurrySection() {
  return (
    <section className="mc-section mc-curry-section">
      <Eyebrow>MEET CURRY AI</Eyebrow>
      <h2 className="mc-h2 mc-center">An assistant woven into every conversation.</h2>
      <p className="mc-p mc-center mc-curry-sub">
        Not a chatbot bolted onto the side. A living layer of intelligence that understands
        what you're saying, who you're saying it to, and what needs to happen next.
      </p>
      <CurryCore />
    </section>
  )
}

/* ---------- section: platform preview ---------- */

function PhoneMock() {
  return (
    <div className="mc-phone">
      <div className="mc-phone-notch" />
      <div className="mc-phone-header">Mattchat</div>
      <div className="mc-phone-bubble them">Loved the deck — sending notes now</div>
      <div className="mc-phone-bubble me">Perfect, meeting Curry-summarized already ✨</div>
      <div className="mc-phone-pulse-row">
        <span className="mc-pulse-pill">📧 Gmail</span>
        <span className="mc-pulse-pill">📅 Today 3:00</span>
      </div>
    </div>
  )
}

function DesktopMock() {
  return (
    <div className="mc-desktop">
      <div className="mc-desktop-bar" />
      <div className="mc-desktop-body">
        <div className="mc-desktop-side">
          <div className="mc-side-item active" />
          <div className="mc-side-item" />
          <div className="mc-side-item" />
          <div className="mc-side-item" />
        </div>
        <div className="mc-desktop-main">
          <div className="mc-desktop-tile" style={{ gridColumn: 'span 2' }}>
            <span className="mc-tile-label">Video meeting</span>
            <div className="mc-tile-avatars"><span /><span /><span /></div>
          </div>
          <div className="mc-desktop-tile"><span className="mc-tile-label">Calendar</span></div>
          <div className="mc-desktop-tile"><span className="mc-tile-label">Inbox</span></div>
        </div>
      </div>
    </div>
  )
}

function PlatformSection() {
  return (
    <section className="mc-section" id="platform">
      <Eyebrow>PLATFORM PREVIEW</Eyebrow>
      <h2 className="mc-h2">One interface. Every conversation.</h2>
      <div className="mc-platform-grid">
        <PhoneMock />
        <DesktopMock />
      </div>
    </section>
  )
}

/* ---------- section: comparison ---------- */

function CompareSection() {
  return (
    <section className="mc-section">
      <Eyebrow>WHY MATTCHAT IS DIFFERENT</Eyebrow>
      <h2 className="mc-h2">Stop assembling your day from six different apps.</h2>
      <div className="mc-compare-grid">
        <GlassCard className="mc-compare-card muted">
          <div className="mc-compare-tag">Traditional apps</div>
          <ul className="mc-compare-list">
            <li>Separate messaging</li>
            <li>Separate email</li>
            <li>Separate meetings</li>
            <li>Separate AI, if any</li>
          </ul>
        </GlassCard>
        <div className="mc-compare-arrow" aria-hidden="true">→</div>
        <GlassCard className="mc-compare-card glow">
          <div className="mc-compare-tag accent">Mattchat</div>
          <ul className="mc-compare-list">
            <li>Everything connected</li>
            <li>AI built into every experience</li>
            <li>One thread of context, always</li>
            <li>Made for how you actually work</li>
          </ul>
        </GlassCard>
      </div>
    </section>
  )
}

/* ---------- section: integrations ---------- */

const INTEGRATIONS = [
  { name: 'YouTube', color: '#FF3B3B' },
  { name: 'Spotify', color: '#1DB954' },
  { name: 'Calendar', color: '#4CC9F0' },
  { name: 'Drive', color: '#6C63FF' },
  { name: 'Zoom', color: '#2D8CFF' },
  { name: 'Teams', color: '#5059C9' },
  { name: 'Notion', color: '#E8E8E8' },
  { name: 'GitHub', color: '#E8E8E8' },
  { name: 'GitLab', color: '#FC6D26' },
  { name: 'Slack', color: '#ECB22E' },
  { name: 'Discord', color: '#5865F2' },
  { name: 'Dropbox', color: '#0061FF' },
]

function IntegrationsSection() {
  return (
    <section className="mc-section">
      <Eyebrow>FUTURE INTEGRATIONS</Eyebrow>
      <h2 className="mc-h2 mc-center">Mattchat becomes the hub. Everything else plugs in.</h2>
      <div className="mc-integrations">
        <div className="mc-integrations-core" />
        <div className="mc-integrations-ring">
          {INTEGRATIONS.map((app, i) => {
            const angle = (360 / INTEGRATIONS.length) * i
            return (
              <div key={app.name} className="mc-integration" style={{ '--angle': `${angle}deg` }}>
                <div className="mc-integration-badge" style={{ boxShadow: `0 0 22px ${app.color}55`, borderColor: `${app.color}55` }}>
                  {app.name.slice(0, 2)}
                </div>
                <span className="mc-integration-label">{app.name}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ---------- section: testimonials ---------- */

const TESTIMONIALS = [
  { quote: 'I stopped switching apps mid-conversation. Everything I need is already there.', name: 'Amara O.', role: 'Product designer' },
  { quote: 'Curry catching my open promises before I forget them has quietly saved me weekly.', name: 'Tunde K.', role: 'Founder' },
  { quote: 'It feels like the messaging app got a decade ahead of everything else overnight.', name: 'Zanele M.', role: 'Student' },
]

function TestimonialsSection() {
  return (
    <section className="mc-section">
      <Eyebrow>PEOPLE ON MATTCHAT</Eyebrow>
      <h2 className="mc-h2">Designed for students, creators, teams, and professionals.</h2>
      <div className="mc-testimonial-grid">
        {TESTIMONIALS.map((t) => (
          <GlassCard key={t.name} className="mc-testimonial">
            <p className="mc-testimonial-quote">"{t.quote}"</p>
            <div className="mc-testimonial-person">
              <span className="mc-testimonial-avatar" />
              <div>
                <div className="mc-testimonial-name">{t.name}</div>
                <div className="mc-testimonial-role">{t.role}</div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  )
}

/* ---------- section: final CTA ---------- */

function FinalCTASection({ onGetStarted }) {
  return (
    <section className="mc-section mc-final" id="get-started">
      <div className="mc-final-glow" />
      <h2 className="mc-h1 mc-center">Experience Communication<br />Reimagined.</h2>
      <GlowButton primary onClick={onGetStarted}>Launch Mattchat</GlowButton>
    </section>
  )
}

/* ---------- footer ---------- */

function Footer({ onNavigate }) {
  const year = new Date().getFullYear()
  return (
    <footer className="mc-footer">
      <div className="mc-footer-grid">
        <div className="mc-footer-brand">
          <BrandLockup size={26} textClassName="mc-footer-logo-text" />
          <p className="mc-footer-tagline">The future of human communication.</p>
        </div>

        <nav className="mc-footer-col" aria-label="Footer navigation">
          <div className="mc-footer-col-title">Navigate</div>
          <a href="/" onClick={(e) => onNavigate(e, '/')}>Home</a>
          <a href="/explore" onClick={(e) => onNavigate(e, '/explore')}>Explore</a>
          <a href="/auth" onClick={(e) => onNavigate(e, '/auth')}>Get Started</a>
        </nav>

        <nav className="mc-footer-col" aria-label="Legal">
          <div className="mc-footer-col-title">Legal</div>
          <a href="/privacy" onClick={(e) => onNavigate(e, '/privacy')}>Privacy Policy</a>
          <a href="/terms" onClick={(e) => onNavigate(e, '/terms')}>Terms of Service</a>
        </nav>

        <nav className="mc-footer-col" aria-label="More">
          <div className="mc-footer-col-title">More</div>
          <a href="/about" onClick={(e) => onNavigate(e, '/about')}>About</a>
          <a href="/contact" onClick={(e) => onNavigate(e, '/contact')}>Contact</a>
        </nav>
      </div>

      <div className="mc-footer-bottom">
        <span>© {year} Mattchat. All rights reserved.</span>
      </div>
    </footer>
  )
}

/* ---------- ambient background: aurora + particles ---------- */

function AmbientBackground() {
  const particles = useRef(
    Array.from({ length: 26 }).map(() => ({
      left: Math.random() * 100,
      delay: Math.random() * 12,
      duration: 14 + Math.random() * 10,
      size: 1 + Math.random() * 2.5,
    }))
  ).current

  const [mouse, setMouse] = useState({ x: 50, y: 50 })
  const frame = useRef(null)

  const handleMove = useCallback((e) => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      setMouse({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 })
      frame.current = null
    })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [handleMove])

  return (
    <div className="mc-ambient" aria-hidden="true">
      <div className="mc-aurora a1" />
      <div className="mc-aurora a2" />
      <div className="mc-aurora a3" />
      <div className="mc-cursor-glow" style={{ left: `${mouse.x}%`, top: `${mouse.y}%` }} />
      {particles.map((p, i) => (
        <span
          key={i}
          className="mc-particle"
          style={{
            left: `${p.left}%`,
            width: p.size, height: p.size,
            animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

/*
  ---------- SCROLL FIX ----------
  Nothing in this file traps scroll. When the whole page is clipped to
  the viewport, it's almost always because a global rule meant for the
  *authenticated* app (which needs a fixed, non-scrolling shell with its
  own internal scroll containers) is being applied to `html`, `body`, or
  `#root` — and the landing page inherits it because it mounts into the
  same DOM.

  This hook forces those three elements back to normal, scrollable
  behavior while the landing page is mounted, and restores whatever was
  there before on unmount — so the authenticated app's layout is
  completely unaffected once you navigate away from this page.
*/
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

export default function LandingPage() {
  const navigate = useNavigate()
  useNaturalPageScroll()

  const goTo = useCallback((e, path) => {
    if (e) e.preventDefault()
    navigate(path)
  }, [navigate])

  return (
    <div className="mc-root">
      <AmbientBackground />
      <nav className="mc-nav">
        <a href="/" className="mc-nav-brand" onClick={(e) => goTo(e, '/')} aria-label="Mattchat home">
          <BrandLockup size={26} />
        </a>
        <div className="mc-nav-links">
          <a href="/explore" className="mc-nav-link" onClick={(e) => goTo(e, '/explore')}>Explore</a>
          <GlowButton primary onClick={() => navigate('/auth')}>Get Started</GlowButton>
        </div>
      </nav>

      <HeroSection onGetStarted={() => navigate('/auth')} />
      <WhySection />
      <CurrySection />
      <PlatformSection />
      <CompareSection />
      <IntegrationsSection />
      <TestimonialsSection />
      <FinalCTASection onGetStarted={() => navigate('/auth')} />

      <Footer onNavigate={goTo} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');

        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }

        .mc-root {
          position: relative;
          background: ${COLORS.bg};
          color: ${COLORS.text};
          font-family: 'Inter', system-ui, sans-serif;
          overflow-x: hidden;
          min-height: 100vh;
          height: auto;
        }

        /* ---------- ambient ---------- */
        .mc-ambient { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
        .mc-aurora {
          position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.35;
          animation: mcDrift 26s ease-in-out infinite alternate;
        }
        .mc-aurora.a1 { width: 640px; height: 640px; top: -180px; left: -120px; background: radial-gradient(circle, ${COLORS.purple}, transparent 70%); }
        .mc-aurora.a2 { width: 560px; height: 560px; top: 30%; right: -160px; background: radial-gradient(circle, ${COLORS.blue}, transparent 70%); animation-duration: 32s; animation-delay: -6s; }
        .mc-aurora.a3 { width: 520px; height: 520px; bottom: -160px; left: 20%; background: radial-gradient(circle, ${COLORS.violet}, transparent 70%); animation-duration: 22s; animation-delay: -12s; }
        @keyframes mcDrift { from { transform: translate(0,0) scale(1); } to { transform: translate(40px,-30px) scale(1.08); } }

        .mc-cursor-glow {
          position: absolute; width: 420px; height: 420px; border-radius: 50%;
          background: radial-gradient(circle, ${COLORS.purple}22, transparent 65%);
          transform: translate(-50%,-50%); transition: left 0.25s ease-out, top 0.25s ease-out;
        }

        .mc-particle {
          position: absolute; bottom: -10px; border-radius: 50%; background: rgba(255,255,255,0.5);
          animation-name: mcFloatUp; animation-timing-function: linear; animation-iteration-count: infinite;
        }
        @keyframes mcFloatUp {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.4; }
          100% { transform: translateY(-100vh); opacity: 0; }
        }

        /* ---------- layout base ---------- */
        .mc-section { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 128px 24px; }
        .mc-center { text-align: center; margin-left: auto; margin-right: auto; }

        .mc-eyebrow {
          font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; letter-spacing: 2.5px;
          color: ${COLORS.blue}; margin-bottom: 18px; font-weight: 500;
        }
        .mc-h1 {
          font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: clamp(38px, 5.6vw, 66px);
          line-height: 1.06; letter-spacing: -1.5px; margin: 0 0 22px;
          background: linear-gradient(120deg, #fff 40%, ${COLORS.blue} 80%, ${COLORS.violet});
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .mc-h2 {
          font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: clamp(26px, 3.4vw, 38px);
          letter-spacing: -0.5px; line-height: 1.2; margin: 0 0 48px; max-width: 640px;
        }
        .mc-h3 { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 600; margin: 18px 0 8px; }
        .mc-p { color: ${COLORS.muted}; font-size: 15px; line-height: 1.65; margin: 0; }
        .mc-sub { color: ${COLORS.muted}; font-size: 17px; line-height: 1.65; max-width: 480px; margin-bottom: 36px; }

        /* ---------- glass / buttons ---------- */
        .mc-glass {
          background: ${COLORS.glass}; border: 1px solid ${COLORS.glassBorder}; border-radius: 20px;
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.35);
          transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), border-color 0.35s ease;
        }

        .mc-btn {
          display: inline-flex; align-items: center; justify-content: center; text-decoration: none;
          font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14.5px; padding: 13px 26px;
          border-radius: 999px; cursor: pointer; border: 1px solid transparent; transition: all 0.25s ease;
        }
        .mc-btn:focus-visible {
          outline: 2px solid ${COLORS.blue}; outline-offset: 3px;
        }
        .mc-btn-primary {
          background: linear-gradient(120deg, ${COLORS.purple}, ${COLORS.violet});
          color: #fff; box-shadow: 0 0 0 0 rgba(108,99,255,0.5);
        }
        .mc-btn-primary:hover { box-shadow: 0 0 32px 4px rgba(108,99,255,0.55); transform: translateY(-2px); }
        .mc-btn-secondary { background: rgba(255,255,255,0.04); color: ${COLORS.text}; border-color: ${COLORS.glassBorder}; }
        .mc-btn-secondary:hover { background: rgba(255,255,255,0.08); }

        /* ---------- brand lockup ---------- */
        .mc-brand-lockup { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; }
        .mc-logo-mark {
          display: inline-flex; align-items: center; justify-content: center; border-radius: 9px; flex-shrink: 0;
          background: linear-gradient(135deg, ${COLORS.purple}, ${COLORS.violet});
          box-shadow: 0 0 18px rgba(108,99,255,0.35);
        }

        /* ---------- nav ---------- */
        .mc-nav {
          position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between;
          padding: 18px 32px; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          background: rgba(9,9,9,0.55); border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .mc-nav-brand { text-decoration: none; color: inherit; }
        .mc-nav-logo { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: -0.3px; }
        .mc-nav-links { display: flex; align-items: center; gap: 22px; }
        .mc-nav-link {
          font-size: 14.5px; font-weight: 600; color: ${COLORS.muted}; text-decoration: none; transition: color 0.2s ease;
        }
        .mc-nav-link:hover, .mc-nav-link:focus-visible { color: ${COLORS.text}; }
        .mc-nav-link:focus-visible { outline: 2px solid ${COLORS.blue}; outline-offset: 3px; border-radius: 4px; }

        /* ---------- hero ---------- */
        .mc-hero { padding-top: 88px; }
        .mc-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; }
        .mc-hero-actions { display: flex; gap: 14px; }

        .mc-hero-dash { position: relative; height: 420px; }
        .mc-dash-card {
          position: absolute; width: 168px; padding: 14px; border-radius: 16px;
          background: ${COLORS.glass}; border: 1px solid ${COLORS.glassBorder};
          backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
          box-shadow: 0 18px 50px rgba(0,0,0,0.4);
          animation: mcFloat 7s ease-in-out infinite;
        }
        .mc-dash-head { display: flex; align-items: center; gap: 6px; font-size: 11px; color: ${COLORS.muted}; margin-bottom: 10px; font-weight: 600; }
        .mc-dash-chat { top: 0; left: 10px; animation-delay: 0s; }
        .mc-dash-call { top: 30px; right: 0; animation-delay: -2s; }
        .mc-dash-cal  { bottom: 40px; left: 0; animation-delay: -4s; }
        .mc-dash-mail { bottom: 0; right: 20px; animation-delay: -1s; }
        @keyframes mcFloat { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }

        .mc-dash-bubble { font-size: 11px; padding: 7px 10px; border-radius: 10px; margin-top: 6px; max-width: 90%; }
        .mc-dash-bubble-them { background: rgba(255,255,255,0.06); }
        .mc-dash-bubble-me { background: linear-gradient(120deg, ${COLORS.purple}88, ${COLORS.violet}88); margin-left: auto; }
        .mc-dash-avatars { display: flex; gap: 8px; }
        .mc-dash-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, ${COLORS.blue}, ${COLORS.purple}); }
        .mc-dash-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
        .mc-dash-dot { width: 100%; aspect-ratio: 1; border-radius: 4px; background: rgba(255,255,255,0.08); }
        .mc-dash-dot.active { background: ${COLORS.blue}; box-shadow: 0 0 8px ${COLORS.blue}; }
        .mc-dash-line { height: 6px; border-radius: 4px; background: rgba(255,255,255,0.09); margin-top: 8px; }

        .mc-dash-core {
          position: absolute; top: 50%; left: 50%; width: 80px; height: 80px; transform: translate(-50%,-50%);
        }
        .mc-dash-core-ring { position: absolute; inset: 0; border-radius: 50%; border: 1px solid ${COLORS.purple}66; animation: mcSpin 12s linear infinite; }
        .mc-dash-core-glow {
          position: absolute; inset: 8px; border-radius: 50%;
          background: radial-gradient(circle, ${COLORS.purple}, ${COLORS.violet}66 60%, transparent 75%);
          animation: mcPulse 3.2s ease-in-out infinite;
        }
        .mc-dash-core-label { position: relative; display: block; text-align: center; line-height: 80px; font-size: 11px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; }
        @keyframes mcSpin { to { transform: rotate(360deg); } }
        @keyframes mcPulse { 0%, 100% { opacity: 0.75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
        .mc-dash-lines { position: absolute; inset: 0; width: 100%; height: 100%; }
        .mc-dash-path { stroke: ${COLORS.purple}; stroke-width: 1; opacity: 0.35; stroke-dasharray: 4 5; }

        /* ---------- why cards ---------- */
        .mc-why-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .mc-why-card { padding: 30px 26px; }
        .mc-why-card:hover { transform: translateY(-6px); border-color: rgba(108,99,255,0.4); }
        .mc-why-icon {
          width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, ${COLORS.purple}33, ${COLORS.blue}22); color: ${COLORS.blue};
        }

        /* ---------- curry section ---------- */
        .mc-curry-section { text-align: center; }
        .mc-curry-sub { max-width: 540px; margin: 0 auto 60px; }
        .mc-curry-wrap { position: relative; height: 460px; max-width: 560px; margin: 0 auto; }
        .mc-curry-orb { position: absolute; top: 50%; left: 50%; width: 130px; height: 130px; transform: translate(-50%,-50%); }
        .mc-curry-orb-core {
          position: absolute; inset: 20px; border-radius: 50%;
          background: radial-gradient(circle, #fff, ${COLORS.purple} 40%, ${COLORS.violet} 75%, transparent 100%);
          animation: mcPulse 3.6s ease-in-out infinite; filter: blur(0.5px);
        }
        .mc-curry-orb-ring { position: absolute; inset: 0; border-radius: 50%; border: 1px solid ${COLORS.purple}44; }
        .mc-curry-orb-ring.r1 { animation: mcSpin 16s linear infinite; }
        .mc-curry-orb-ring.r2 { inset: -22px; border-color: ${COLORS.blue}33; animation: mcSpin 24s linear infinite reverse; }

        .mc-curry-abilities { position: absolute; inset: 0; }
        .mc-ability {
          position: absolute; top: 50%; left: 50%; width: 0; height: 0;
          transform: rotate(var(--angle)) translate(210px) rotate(calc(-1 * var(--angle)));
        }
        .mc-ability-chip {
          display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px;
          background: ${COLORS.glass}; border: 1px solid ${COLORS.glassBorder}; backdrop-filter: blur(14px);
          font-size: 11.5px; font-weight: 600; white-space: nowrap; color: ${COLORS.text};
          transform: translate(-50%, -50%) scale(0.7); opacity: 0;
          transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1);
        }
        .in-view .mc-ability-chip { opacity: 1; transform: translate(-50%, -50%) scale(1); }

        /* ---------- platform mockups ---------- */
        .mc-platform-grid { display: grid; grid-template-columns: 300px 1fr; gap: 40px; align-items: center; }
        .mc-phone {
          position: relative; width: 280px; height: 420px; border-radius: 34px; padding: 20px 16px;
          background: linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          border: 1px solid ${COLORS.glassBorder}; backdrop-filter: blur(20px);
          box-shadow: 0 30px 70px rgba(0,0,0,0.5);
        }
        .mc-phone-notch { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 64px; height: 6px; border-radius: 4px; background: rgba(255,255,255,0.15); }
        .mc-phone-header { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px; margin: 20px 0 16px; }
        .mc-phone-bubble { font-size: 12px; padding: 9px 12px; border-radius: 12px; margin-bottom: 8px; max-width: 85%; }
        .mc-phone-bubble.them { background: rgba(255,255,255,0.07); }
        .mc-phone-bubble.me { background: linear-gradient(120deg, ${COLORS.purple}99, ${COLORS.violet}99); margin-left: auto; }
        .mc-phone-pulse-row { display: flex; gap: 8px; margin-top: 24px; flex-wrap: wrap; }
        .mc-pulse-pill { font-size: 10.5px; padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid ${COLORS.glassBorder}; }

        .mc-desktop {
          border-radius: 18px; overflow: hidden; border: 1px solid ${COLORS.glassBorder};
          background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); box-shadow: 0 30px 70px rgba(0,0,0,0.5);
        }
        .mc-desktop-bar { height: 34px; background: rgba(255,255,255,0.04); border-bottom: 1px solid ${COLORS.glassBorder}; }
        .mc-desktop-body { display: grid; grid-template-columns: 64px 1fr; min-height: 300px; }
        .mc-desktop-side { display: flex; flex-direction: column; gap: 14px; padding: 20px 0; align-items: center; background: rgba(255,255,255,0.02); }
        .mc-side-item { width: 30px; height: 30px; border-radius: 10px; background: rgba(255,255,255,0.06); }
        .mc-side-item.active { background: linear-gradient(135deg, ${COLORS.purple}, ${COLORS.blue}); }
        .mc-desktop-main { padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .mc-desktop-tile { border-radius: 14px; background: rgba(255,255,255,0.04); border: 1px solid ${COLORS.glassBorder}; padding: 16px; min-height: 100px; }
        .mc-tile-label { font-size: 12px; color: ${COLORS.muted}; font-weight: 600; }
        .mc-tile-avatars { display: flex; gap: -4px; margin-top: 12px; }
        .mc-tile-avatars span { width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, ${COLORS.violet}, ${COLORS.blue}); margin-left: -8px; border: 2px solid ${COLORS.bg}; }

        /* ---------- compare ---------- */
        .mc-compare-grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 22px; align-items: center; }
        .mc-compare-card { padding: 32px 28px; }
        .mc-compare-card.muted { opacity: 0.6; }
        .mc-compare-card.glow { border-color: rgba(108,99,255,0.4); box-shadow: 0 0 50px rgba(108,99,255,0.12), 0 20px 60px rgba(0,0,0,0.35); }
        .mc-compare-tag { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 1.5px; margin-bottom: 18px; color: ${COLORS.muted}; }
        .mc-compare-tag.accent { color: ${COLORS.blue}; }
        .mc-compare-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; font-size: 14.5px; }
        .mc-compare-arrow { font-size: 22px; color: ${COLORS.purple}; text-align: center; }

        /* ---------- integrations ---------- */
        .mc-integrations { position: relative; height: 480px; max-width: 560px; margin: 0 auto; }
        .mc-integrations-core {
          position: absolute; top: 50%; left: 50%; width: 60px; height: 60px; transform: translate(-50%,-50%);
          border-radius: 16px; background: linear-gradient(135deg, ${COLORS.purple}, ${COLORS.violet});
          box-shadow: 0 0 40px rgba(108,99,255,0.5);
        }
        .mc-integrations-ring { position: absolute; inset: 0; }
        .mc-integration {
          position: absolute; top: 50%; left: 50%; width: 0; height: 0;
          transform: rotate(var(--angle)) translate(220px) rotate(calc(-1 * var(--angle)));
          display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .mc-integration-badge {
          width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.05); border: 1px solid; font-size: 12px; font-weight: 700;
          transform: translate(-50%,-50%); animation: mcFloat 6s ease-in-out infinite;
        }
        .mc-integration-label { font-size: 10.5px; color: ${COLORS.muted}; transform: translate(-50%, 8px); position: absolute; white-space: nowrap; }

        /* ---------- testimonials ---------- */
        .mc-testimonial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .mc-testimonial { padding: 28px; display: flex; flex-direction: column; justify-content: space-between; min-height: 200px; }
        .mc-testimonial-quote { font-size: 14.5px; line-height: 1.6; color: ${COLORS.text}; margin: 0 0 24px; }
        .mc-testimonial-person { display: flex; align-items: center; gap: 10px; }
        .mc-testimonial-avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, ${COLORS.blue}, ${COLORS.purple}); box-shadow: 0 0 16px rgba(108,99,255,0.4); }
        .mc-testimonial-name { font-size: 13px; font-weight: 700; }
        .mc-testimonial-role { font-size: 11.5px; color: ${COLORS.muted}; }

        /* ---------- final CTA ---------- */
        .mc-final { text-align: center; padding: 160px 24px; position: relative; }
        .mc-final-glow {
          position: absolute; top: 50%; left: 50%; width: 700px; height: 700px; transform: translate(-50%,-50%);
          background: radial-gradient(circle, ${COLORS.purple}33, transparent 70%); filter: blur(60px); z-index: -1;
        }
        .mc-final .mc-btn { margin-top: 28px; }

        /* ---------- footer ---------- */
        .mc-footer {
          position: relative; z-index: 1; padding: 64px 32px 32px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.015);
        }
        .mc-footer-grid {
          max-width: 1180px; margin: 0 auto;
          display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 40px;
        }
        .mc-footer-brand { max-width: 260px; }
        .mc-footer-logo-text { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 17px; }
        .mc-footer-tagline { margin: 14px 0 0; font-size: 13.5px; color: ${COLORS.muted}; line-height: 1.6; }
        .mc-footer-col { display: flex; flex-direction: column; gap: 12px; }
        .mc-footer-col-title {
          font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: 1.5px;
          color: ${COLORS.muted}; text-transform: uppercase; margin-bottom: 4px;
        }
        .mc-footer-col a {
          font-size: 14px; color: ${COLORS.text}; opacity: 0.8; text-decoration: none; transition: opacity 0.2s ease;
        }
        .mc-footer-col a:hover, .mc-footer-col a:focus-visible { opacity: 1; color: ${COLORS.blue}; }
        .mc-footer-col a:focus-visible { outline: 2px solid ${COLORS.blue}; outline-offset: 3px; border-radius: 3px; }
        .mc-footer-bottom {
          max-width: 1180px; margin: 48px auto 0; padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.05);
          font-size: 12.5px; color: ${COLORS.muted};
        }

        /* ---------- reduced motion ---------- */
        @media (prefers-reduced-motion: reduce) {
          .mc-aurora, .mc-particle, .mc-dash-card, .mc-dash-core-ring, .mc-dash-core-glow,
          .mc-curry-orb-core, .mc-curry-orb-ring, .mc-integration-badge { animation: none !important; }
          .mc-ability-chip { transition: none; }
        }

        /* ---------- responsive ---------- */
        @media (max-width: 900px) {
          .mc-hero-grid { grid-template-columns: 1fr; }
          .mc-hero-dash { height: 320px; margin-top: 20px; }
          .mc-why-grid { grid-template-columns: 1fr; }
          .mc-platform-grid { grid-template-columns: 1fr; justify-items: center; }
          .mc-compare-grid { grid-template-columns: 1fr; }
          .mc-compare-arrow { transform: rotate(90deg); }
          .mc-testimonial-grid { grid-template-columns: 1fr; }
          .mc-curry-wrap, .mc-integrations { transform: scale(0.72); }
          .mc-footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
          .mc-footer-brand { max-width: none; grid-column: span 2; }
        }
        @media (max-width: 520px) {
          .mc-section { padding: 88px 18px; }
          .mc-nav { padding: 14px 18px; }
          .mc-nav-links { gap: 14px; }
          .mc-footer-grid { grid-template-columns: 1fr; }
          .mc-footer-brand { grid-column: auto; }
        }
      `}</style>
    </div>
  )
}
