import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRAND_ICONS } from '../../lib/brandIcons'
/* ============================================================
   MATTCHAT — "The Future of Human Communication" landing page
   Self-contained: styles live in the <style> block at the bottom
   of this file (same pattern used elsewhere in the app for
   component-scoped keyframes). No external deps beyond React.
   ============================================================ */

const COLORS = {
  bg: '#F6F7F9',
  glass: '#FFFFFF',
  glassBorder: 'rgba(15,23,32,0.10)',
  purple: '#2457F5',   // kept as the key name so nothing else breaks; now the single accent
  blue: '#2457F5',
  violet: '#1B44C8',
  text: '#0F1720',
  muted: '#5B6573',
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
    <img
      src="/logo.png"
      alt="Mattchat logo"
      className="mc-logo-mark"
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
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

 
/* ---------- section: hero ---------- */
function HeroShowcase() {
  return (
    <div className="mc-showcase">
      <div className="mc-showcase-glow" aria-hidden="true" />
      <figure className="mc-frame">
        <div className="mc-frame-bar" aria-hidden="true"><i /><i /><i /></div>
        <img
          src="/screens/curry-chat.webp"
          alt="Curry AI drafting an email inside a Mattchat conversation"
          width="1100" height="826"
          fetchpriority="high" decoding="async"
        />
      </figure>
      <figure className="mc-frame mc-frame-side">
        <img
          src="/screens/pulse.webp"
          alt="Mattchat Pulse showing live team fixtures and a daily brief"
          width="440" height="561"
          loading="lazy" decoding="async"
        />
      </figure>
    </div>
  )
}

function HeroSection({ onGetStarted }) {
  return (
    <section className="mc-section mc-hero">
      <div className="mc-hero-grid">
        <div>
         <Eyebrow>Private, ad-free messaging</Eyebrow>
          <h1 className="mc-h1">One private place for every conversation.</h1>
          <p className="mc-sub">
            Chat, call, and manage Gmail, WhatsApp and your calendar in one app, while
            Curry AI drafts your replies and catches what you'd forget. No ads, ever.
          </p>
          <div className="mc-hero-actions">
            <GlowButton primary onClick={onGetStarted}>Create your account</GlowButton>
            <GlowButton href="#platform">See how it works</GlowButton>
          </div>
          <ul className="mc-hero-proof">
            <li>Ad-free</li>
            <li>Phone and desktop</li>
            
          </ul>
           <figure className="mc-hero-quote">
  <blockquote>“I stopped switching apps mid-conversation. Everything I need is already there.”</blockquote>
  <figcaption>Jerry Wendo, Product designer</figcaption>
</figure>
        </div>
        <HeroShowcase />
      </div>
       <div className="mc-works-with">
          <CollabRow />
  <span>Connects with</span>
  {['gmail', 'whatsapp', 'googlecalendar', 'googledrive', 'instagram'].map((id) => (
    <BrandLogo key={id} id={id} size={22} />
  ))}
</div>
    </section>
  )
}

/* ---------- section: why mattchat ---------- */

const WHY_POINTS = [
  { title: 'Private by default', body: 'No ads, and no selling your attention. Your conversations are not the product.' },
  { title: 'Your other apps, in the same place', body: 'Manage Gmail, WhatsApp and your calendar from the same app you chat in.' },
  { title: 'An assistant inside the conversation', body: 'Curry drafts replies and reminds you of what you promised, right where you are talking.' },
]

function WhySection() {
  return (
    <section className="mc-section">
      <div className="mc-why2">
        <h2 className="mc-h2" style={{ marginBottom: 0 }}>
          Messaging that works for you, not for advertisers.
        </h2>
        <div className="mc-why2-list">
          {WHY_POINTS.map((p) => (
            <div key={p.title} className="mc-why2-item">
              <h3 className="mc-h3" style={{ marginTop: 0 }}>{p.title}</h3>
              <p className="mc-p">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- section: Curry AI core (signature moment) ---------- */
const CURRY_POINTS = [
  { title: 'Smart replies', body: 'Suggested answers in your own conversations, one tap to send.' },
  { title: 'Email drafts', body: 'Curry writes the first version of a Gmail reply for you to edit.' },
  { title: 'Promise reminders', body: 'When you say you will do something, Curry offers to remind you.' },
  { title: 'Scheduling and voice', body: 'Ask for your day, the weather or a meeting time by typing or speaking.' },
   { title: 'Music and daily check-ins', body: 'Ask for a song and play it in the chat, or read Curry\'s daily check-in.' },
]

 

function CurrySection() {
  return (
    <section className="mc-section">
      <div className="mc-curry2">
        <div>
          <h2 className="mc-h2">Curry helps while you talk.</h2>
          <p className="mc-p" style={{ marginBottom: 32, maxWidth: 460 }}>
            Curry is the AI assistant built into Mattchat. It reads the conversation you are in
            and offers the next useful thing, so you stop switching apps to get it done.
          </p>
          <div className="mc-curry2-list">
            {CURRY_POINTS.map((p) => (
              <div key={p.title} className="mc-curry2-item">
                <h3 className="mc-h3" style={{ margin: '0 0 4px', fontSize: 16 }}>{p.title}</h3>
                <p className="mc-p" style={{ fontSize: 14.5 }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
       <figure className="mc-frame">
<img
  src="/screens/curry-music.webp"
  alt="Curry sending a daily check-in and playing a song inside Mattchat"
  width="1273" height="914" loading="lazy" decoding="async"
/>
</figure>
      </div>
    </section>
  )
}

/* ---------- section: platform preview ---------- */
const BENTO_APPS = ['gmail', 'whatsapp', 'googlecalendar', 'googledrive', 'instagram', 'tiktok', 'pinterest']

function PlatformSection() {
  return (
    <section className="mc-section" id="platform">
      <Eyebrow>More than messaging</Eyebrow>
      <h2 className="mc-h2">Everything you use to stay in touch, in one place.</h2>
      <div className="mc-bento">
        <figure className="mc-tile mc-tile-pulse">
          <img src="/screens/pulse.webp" alt="Mattchat Pulse showing live updates and a daily brief" loading="lazy" decoding="async" />
          <figcaption className="mc-tile-body">
            <strong>Pulse</strong>
            <span>Live updates and your daily brief in one view.</span>
          </figcaption>
        </figure>

        <figure className="mc-tile mc-tile-checkin">
          <img src="/screens/curry-checkin.webp" alt="Curry's daily check-in with a song suggestion" loading="lazy" decoding="async" />
          <figcaption className="mc-tile-body">
            <strong>A daily check-in from Curry</strong>
            <span>A friendly note to start your day, with a song to match.</span>
          </figcaption>
        </figure>

        <figure className="mc-tile mc-tile-music">
          <img src="/screens/curry-music-card.webp" alt="A song from YouTube playing inside a Curry chat" loading="lazy" decoding="async" />
          <figcaption className="mc-tile-body">
            <strong>Music in the chat</strong>
            <span>Ask for a song and play it without leaving the conversation.</span>
          </figcaption>
        </figure>

        <div className="mc-tile mc-tile-apps mc-tile-body">
          <strong>Connect the apps you already use</strong>
          <span>You choose what to connect.</span>
          <div className="mc-tile-logos">
            {BENTO_APPS.map((id) => <BrandLogo key={id} id={id} size={26} />)}
          </div>
        </div>

        <div className="mc-tile mc-tile-calls mc-tile-body">
          <strong>Voice and video calls</strong>
          <span>Call from the same place you chat.</span>
        </div>

        <div className="mc-tile mc-tile-draw mc-tile-body">
          <strong>Draw Together</strong>
          <span>Sketch on a shared canvas and play drawing games with friends.</span>
        </div>

        <div className="mc-tile mc-tile-private mc-tile-body">
          <strong>Private to you</strong>
          <span>Your chats with Curry stay private to you, and there are no ads.</span>
        </div>
      </div>
    </section>
  )
}


/* ---------- section: comparison ---------- */

function CompareSection() {
  return (
    <section className="mc-section">
      <Eyebrow>Why Mattchat is different</Eyebrow>
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

/* ---------- section: how it works ---------- */

const STEPS = [
  { n: '01', title: 'Create your account', body: 'Sign up and set up your profile. Your chats, calls and status are ready right away.' },
  { n: '02', title: 'Connect your apps', body: 'Link Gmail, Calendar, WhatsApp and more from Connected Apps. You choose what to connect.' },
  { n: '03', title: 'Let Curry help', body: 'Smart replies, email drafts and reminders for promises you made, right inside your chats.' },
]

function HowItWorksSection() {
  return (
    <section className="mc-section">
      <Eyebrow>How it works</Eyebrow>
      <h2 className="mc-h2">Up and running in three steps.</h2>
      <div className="mc-steps">
        {STEPS.map((s) => (
          <GlassCard key={s.n} className="mc-step">
            <div className="mc-step-num">{s.n}</div>
            <h3 className="mc-h3" style={{ marginTop: 0 }}>{s.title}</h3>
            <p className="mc-p">{s.body}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  )
}

/* ---------- section: integrations ---------- */

const LIVE_APPS = ['gmail', 'googlecalendar', 'googledrive', 'youtube', 'spotify', 'whatsapp', 'instagram', 'tiktok', 'pinterest']
const SOON_APPS = ['zoom', 'notion', 'github', 'gitlab', 'discord', 'dropbox']

function BrandLogo({ id, size = 26 }) {
  const b = BRAND_ICONS[id]
  if (!b) return null
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={b.color} role="img" aria-label={b.name}>
      <path d={b.path} />
    </svg>
  )
}

function IntegrationsSection() {
  return (
    <section className="mc-section">
     <Eyebrow>Integrations</Eyebrow>
      <h2 className="mc-h2">Your apps, all in Mattchat.</h2>

      <div className="mc-int-label"><span className="mc-live-dot" />Live now</div>
      <div className="mc-int-grid">
        {LIVE_APPS.map((id) => (
          <GlassCard key={id} className="mc-int-tile">
            <BrandLogo id={id} />
            <span className="mc-int-name">{BRAND_ICONS[id].name}</span>
          </GlassCard>
        ))}
      </div>

      <div className="mc-int-label">Coming soon</div>
      <div className="mc-int-grid">
        {SOON_APPS.map((id) => (
          <GlassCard key={id} className="mc-int-tile soon">
            <BrandLogo id={id} />
            <span className="mc-int-name">{BRAND_ICONS[id].name}</span>
          </GlassCard>
        ))}
      </div>
    </section>
  )
}
const COLLABS = [] // e.g. { name: 'Partner name', logo: '/collabs/partner.svg' }

function CollabRow() {
  if (!COLLABS.length) return null
  return (
    <div className="mc-collabs">
      <span>Built with</span>
      {COLLABS.map((c) => <img key={c.name} src={c.logo} alt={c.name} loading="lazy" />)}
    </div>
  )
}
/* ---------- section: testimonials ---------- */

const TESTIMONIALS = [
  { quote: 'I stopped switching apps mid-conversation. Everything I need is already there.', name: 'Jerry Wendo', role: 'Product designer' },
  { quote: 'Curry catching my open promises before I forget them has quietly saved me weekly.', name: 'Mathew Mutai', role: 'Founder' },
  { quote: 'It feels like the messaging app got a decade ahead of everything else overnight.', name: 'Shallom Blessing', role: 'Student' },
]

function TestimonialsSection({ onGetStarted }) {
  return (
    <section className="mc-section">
     <Eyebrow>People on Mattchat</Eyebrow>
      <h2 className="mc-h2">Designed for students, creators, teams, and professionals.</h2>
      <div className="mc-testimonial-grid">
        {TESTIMONIALS.map((t) => (
          <GlassCard key={t.name} className="mc-testimonial">
            <p className="mc-testimonial-quote">"{t.quote}"</p>
            <div className="mc-testimonial-person">
              <span className="mc-testimonial-avatar">{t.name[0]}</span>
              <div>
                <div className="mc-testimonial-name">{t.name}</div>
                <div className="mc-testimonial-role">{t.role}</div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
      <div className="mc-center" style={{ marginTop: 44, textAlign: 'center' }}>
        <GlowButton primary onClick={onGetStarted}>Create your account</GlowButton>
      </div>
    </section>
  )
}
/* ---------- section: final CTA ---------- */

function FinalCTASection({ onGetStarted }) {
  return (
    <section className="mc-section mc-final" id="get-started">
      <div className="mc-final-panel">
        <h2 className="mc-h1">Bring your conversations somewhere private.</h2>
        <p>Create your account, connect the apps you use, and let Curry handle the busywork.</p>
        <GlowButton primary onClick={onGetStarted}>Create your account</GlowButton>
      </div>
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
          <a href="/explore" onClick={(e) => onNavigate(e, '/explore')}>Explore</a>
          <a href="/auth" onClick={(e) => onNavigate(e, '/auth')}>Get Started</a>
        </nav>

        <nav className="mc-footer-col" aria-label="Legal">
          <div className="mc-footer-col-title">Legal</div>
          <a href="/privacy" onClick={(e) => onNavigate(e, '/privacy')}>Privacy Policy</a>
          <a href="/terms" onClick={(e) => onNavigate(e, '/terms')}>Terms of Service</a>
        </nav>
      </div>

      <div className="mc-footer-bottom">
        <span>© {year} Mattchat. All rights reserved.</span>
      </div>
    </footer>
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
function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
    </svg>
  )
}

function useInstallApp() {
  const [promptEvent, setPromptEvent] = useState(() => (typeof window !== 'undefined' ? window.__mcInstall || null : null))
  const [installed, setInstalled] = useState(() =>
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)
  )
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); window.__mcInstall = e; setPromptEvent(e) }
    const onInstalled = () => { window.__mcInstall = null; setPromptEvent(null); setInstalled(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!promptEvent) { setHelpOpen(true); return }
    promptEvent.prompt()
    try { await promptEvent.userChoice } catch (e) { /* ignore */ }
    window.__mcInstall = null
    setPromptEvent(null)
  }, [promptEvent])

  return { installed, install, helpOpen, closeHelp: () => setHelpOpen(false) }
}

function detectInstallHelp() {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  if (/Firefox/i.test(ua)) return 'firefox'
  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua)) return 'safari'
  return 'desktop'
}

const HELP_STEPS = {
  ios: ['Tap the Share button in Safari.', 'Scroll down and tap Add to Home Screen.', 'Tap Add. Mattchat appears on your home screen.'],
  android: ['Open your browser menu (the three dots).', 'Tap Install app or Add to Home screen.', 'Confirm, and Mattchat appears with your other apps.'],
  safari: ['In the menu bar, choose File.', 'Choose Add to Dock.', 'Mattchat opens in its own window from your Dock.'],
  firefox: ['Firefox on desktop cannot install web apps.', 'Open Mattchat in Chrome or Edge to install it, or keep using it right here in your browser.'],
  desktop: ['Look for the install icon at the right end of the address bar and click it.', 'No icon? Open the browser menu and look for Install Mattchat.', 'Mattchat then opens in its own window.'],
}

function InstallHelp({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const steps = HELP_STEPS[detectInstallHelp()]
  return (
    <div className="mc-modal" role="presentation" onClick={onClose}>
      <div className="mc-modal-panel" role="dialog" aria-modal="true" aria-labelledby="mc-install-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="mc-install-title" className="mc-h3" style={{ marginTop: 0 }}>Install Mattchat</h2>
        <ol className="mc-modal-steps">
          {steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <button type="button" className="mc-btn mc-btn-primary" onClick={onClose} autoFocus>Got it</button>
      </div>
    </div>
  )
}
export default function LandingPage() {
  const navigate = useNavigate()
  useNaturalPageScroll()
const { installed, install, helpOpen, closeHelp } = useInstallApp()
  const goTo = useCallback((e, path) => {
    if (e) e.preventDefault()
    navigate(path)
  }, [navigate])

  return (
    <div className="mc-root">
      
   <nav className="mc-nav" aria-label="Main">
  <a href="/" className="mc-nav-brand" onClick={(e) => goTo(e, '/')} aria-label="Mattchat home">
    <BrandLockup size={26} />
  </a>
  <div className="mc-nav-center">
    <a href="#curry" className="mc-nav-link">Curry</a>
    <a href="#platform" className="mc-nav-link">Features</a>
    <a href="#how" className="mc-nav-link">How it works</a>
    <a href="#apps" className="mc-nav-link">Apps</a>
    <a href="/explore" className="mc-nav-link" onClick={(e) => goTo(e, '/explore')}>Explore</a>
  </div>
  <div className="mc-nav-links">
    {!installed && (
      <button type="button" className="mc-btn mc-btn-secondary mc-install" onClick={install} aria-label="Install the Mattchat app">
        <DownloadIcon /><span className="mc-install-text">Install app</span>
      </button>
    )}
    <a href="/auth" className="mc-nav-link mc-nav-signin" onClick={(e) => goTo(e, '/auth')}>Sign in</a>
      <GlowButton primary onClick={() => navigate('/auth')}>Get started</GlowButton>
  </div>
</nav>
<InstallHelp open={helpOpen} onClose={closeHelp} />
<HeroSection onGetStarted={() => navigate('/auth')} />
<WhySection />
<div id="curry" className="mc-band"><CurrySection /></div>
<PlatformSection />
<div id="how" className="mc-band"><HowItWorksSection /></div>
<CompareSection />
<div id="apps" className="mc-band"><IntegrationsSection /></div>
<TestimonialsSection onGetStarted={() => navigate('/auth')} />
<FinalCTASection onGetStarted={() => navigate('/auth')} />
      <Footer onNavigate={goTo} />

      <style>{`
       @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700&family=Instrument+Sans:wght@400;500;600&display=swap');
@media (max-width: 900px) {
  .mc-aurora { filter: blur(60px); opacity: 0.28; }
  .mc-why2, .mc-curry2 { grid-template-columns: 1fr; gap: 36px; }
  
}
@media (hover: none) {
  .mc-cursor-glow { display: none; }
}
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }

        .mc-root {
          position: relative;
          background: ${COLORS.bg};
          color: ${COLORS.text};
          font-family: 'Instrument Sans', system-ui, sans-serif;
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
       .mc-section { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 88px 24px; }
        .mc-center { text-align: center; margin-left: auto; margin-right: auto; }

        .mc-eyebrow {
  font-family: 'Instrument Sans', system-ui, sans-serif; font-size: 14px; font-weight: 600;
  color: ${COLORS.purple}; margin-bottom: 14px;
}
    .mc-h1 {
  font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700;
  font-size: clamp(38px, 5.4vw, 64px); line-height: 1.04; letter-spacing: -1.6px;
  margin: 0 0 22px; color: ${COLORS.text};
}
        .mc-h2 {
          font-family: 'Bricolage Grotesque', sans-serif; font-weight: 600; font-size: clamp(26px, 3.4vw, 38px);
          letter-spacing: -0.5px; line-height: 1.2; margin: 0 0 48px; max-width: 640px;
        }
        .mc-h3 { font-family: 'Bricolage Grotesque', sans-serif; font-size: 18px; font-weight: 600; margin: 18px 0 8px; }
        .mc-p { color: ${COLORS.muted}; font-size: 15px; line-height: 1.65; margin: 0; }
        .mc-sub { color: ${COLORS.muted}; font-size: 17px; line-height: 1.65; max-width: 480px; margin-bottom: 36px; }

        /* ---------- glass / buttons ---------- */
       .mc-glass {
  background: ${COLORS.glass}; border: 1px solid ${COLORS.glassBorder}; border-radius: 16px;
  box-shadow: 0 1px 2px rgba(15,23,32,0.04), 0 8px 24px rgba(15,23,32,0.05);
  transition: transform 0.25s ease, border-color 0.25s ease;
}
        .mc-btn {
          display: inline-flex; align-items: center; justify-content: center; text-decoration: none;
          font-family: 'Instrument Sans', system-ui, sans-serif; font-weight: 600; font-size: 14.5px; padding: 13px 26px;
          border-radius: 999px; cursor: pointer; border: 1px solid transparent; transition: all 0.25s ease;
        }
        .mc-btn:focus-visible {
          outline: 2px solid ${COLORS.blue}; outline-offset: 3px;
        }
        .mc-btn-primary { background: ${COLORS.purple}; color: #fff; }
.mc-btn-primary:hover { background: ${COLORS.violet}; transform: translateY(-1px); }
.mc-btn-secondary { background: #fff; color: ${COLORS.text}; border-color: ${COLORS.glassBorder}; }
.mc-btn-secondary:hover { background: #F0F2F6; }

        /* ---------- brand lockup ---------- */
        .mc-brand-lockup { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; }
        .mc-logo-mark {
  display: inline-block; flex-shrink: 0;
}

        /* ---------- nav ---------- */
        .mc-nav {
  position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between;
  padding: 16px 32px; background: rgba(246,247,249,0.88);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(15,23,32,0.08);
}
        .mc-nav-brand { text-decoration: none; color: inherit; }
        .mc-nav-logo { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: -0.3px; }
        .mc-nav-links { display: flex; align-items: center; gap: 22px; }
        .mc-nav-link {
          font-size: 14.5px; font-weight: 600; color: ${COLORS.muted}; text-decoration: none; transition: color 0.2s ease;
        }
        .mc-nav-link:hover, .mc-nav-link:focus-visible { color: ${COLORS.text}; }
        .mc-nav-link:focus-visible { outline: 2px solid ${COLORS.blue}; outline-offset: 3px; border-radius: 4px; }

        /* ---------- hero ---------- */
        .mc-hero { padding-top: 72px; padding-bottom: 48px; }
        .mc-band { background: #fff; border-top: 1px solid ${COLORS.glassBorder}; border-bottom: 1px solid ${COLORS.glassBorder}; }
        .mc-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; }
        .mc-hero-actions { display: flex; gap: 14px; }
        .mc-hero-proof { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 0; margin: 26px 0 0; font-size: 12.5px; color: ${COLORS.muted}; }
.mc-hero-proof li::before { content: '✓'; color: ${COLORS.blue}; margin-right: 6px; font-weight: 700; }

.mc-showcase { position: relative; padding-bottom: 36px; }
.mc-showcase-glow { display: none; }
.mc-frame {
  position: relative; margin: 0; border-radius: 14px; overflow: hidden;
  border: 1px solid ${COLORS.glassBorder}; background: #fff;
  box-shadow: 0 24px 60px rgba(15,23,32,0.14);
}
.mc-frame img { display: block; width: 100%; height: auto; }
.mc-frame-bar { display: flex; gap: 6px; padding: 10px 12px; background: #F0F2F6; border-bottom: 1px solid ${COLORS.glassBorder}; }
.mc-frame-bar i { width: 9px; height: 9px; border-radius: 50%; background: rgba(15,23,32,0.18); }
.mc-frame-side {
  position: absolute; right: -14px; bottom: 0; width: 38%;
  border-radius: 14px; animation: mcFloat 7s ease-in-out infinite;
}

@media (max-width: 900px) {
  .mc-frame-side { right: 4px; width: 34%; }
}
@media (prefers-reduced-motion: reduce) {
  .mc-frame-side { animation: none; }
}

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
        .mc-dash-core-label { position: relative; display: block; text-align: center; line-height: 80px; font-size: 11px; font-weight: 700; font-family: 'Bricolage Grotesque', sans-serif; }
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
        .mc-phone-header { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 14px; margin: 20px 0 16px; }
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
       .mc-compare-card.glow { border-color: ${COLORS.purple}; box-shadow: 0 1px 2px rgba(15,23,32,0.04), 0 8px 24px rgba(15,23,32,0.05); }
      .mc-compare-tag { font-size: 13.5px; font-weight: 600; margin-bottom: 18px; color: ${COLORS.muted}; }
        .mc-compare-tag.accent { color: ${COLORS.blue}; }
        .mc-compare-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; font-size: 14.5px; }
        .mc-compare-arrow { font-size: 22px; color: ${COLORS.purple}; text-align: center; }

        /* ---------- how it works ---------- */
.mc-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.mc-step { padding: 28px 26px; }
.mc-step:hover { transform: translateY(-4px); border-color: rgba(108,99,255,0.4); }
.mc-step-num { font-family: 'Bricolage Grotesque', sans-serif; font-size: 14px; font-weight: 600; color: ${COLORS.blue}; margin-bottom: 14px; }

/* ---------- integrations ---------- */
.mc-int-label {
  display: flex; align-items: center; gap: 8px; margin: 0 0 16px;
  font-size: 13.5px; font-weight: 600; color: ${COLORS.muted};
}
.mc-live-dot { width: 7px; height: 7px; border-radius: 50%; background: #16A34A; }
.mc-int-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; margin-bottom: 40px; }
.mc-int-tile { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 14px; }
.mc-int-tile:hover { transform: translateY(-2px); border-color: rgba(15,23,32,0.22); }
.mc-int-tile.soon { opacity: 0.55; }
.mc-int-name { font-size: 13.5px; font-weight: 600; }

.mc-testimonial-avatar { display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #fff; }
        /* ---------- testimonials ---------- */
        .mc-testimonial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .mc-testimonial { padding: 28px; display: flex; flex-direction: column; justify-content: space-between; min-height: 200px; }
        .mc-testimonial-quote { font-size: 14.5px; line-height: 1.6; color: ${COLORS.text}; margin: 0 0 24px; }
        .mc-testimonial-person { display: flex; align-items: center; gap: 10px; }
       .mc-testimonial-avatar { width: 34px; height: 34px; border-radius: 50%; background: ${COLORS.purple}; }
        .mc-testimonial-name { font-size: 13px; font-weight: 700; }
        .mc-testimonial-role { font-size: 11.5px; color: ${COLORS.muted}; }

        /* ---------- final CTA ---------- */
       .mc-final { padding-top: 40px; padding-bottom: 120px; }
.mc-final-panel { background: ${COLORS.text}; border-radius: 24px; padding: 72px 32px; text-align: center; }
.mc-final-panel .mc-h1 { color: #fff; max-width: 720px; margin: 0 auto 16px; }
.mc-final-panel p { color: rgba(255,255,255,0.72); font-size: 17px; line-height: 1.6; max-width: 480px; margin: 0 auto 32px; }
.mc-final-panel .mc-btn-primary { background: #fff; color: ${COLORS.text}; }
.mc-final-panel .mc-btn-primary:hover { background: #E8ECF3; }
        /* ---------- footer ---------- */
        .mc-footer { position: relative; z-index: 1; padding: 64px 32px 32px; border-top: 1px solid ${COLORS.glassBorder}; background: #fff; }
       .mc-footer-grid {
  max-width: 1180px; margin: 0 auto;
  display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 40px;
}
        .mc-footer-brand { max-width: 260px; }
        .mc-footer-logo-text { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 17px; }
        .mc-footer-tagline { margin: 14px 0 0; font-size: 13.5px; color: ${COLORS.muted}; line-height: 1.6; }
        .mc-footer-col { display: flex; flex-direction: column; gap: 12px; }
        .mc-footer-col-title { font-size: 13px; font-weight: 600; color: ${COLORS.text}; margin-bottom: 4px; }
        .mc-footer-col a {
          font-size: 14px; color: ${COLORS.text}; opacity: 0.8; text-decoration: none; transition: opacity 0.2s ease;
        }
        .mc-footer-col a:hover, .mc-footer-col a:focus-visible { opacity: 1; color: ${COLORS.blue}; }
        .mc-footer-col a:focus-visible { outline: 2px solid ${COLORS.blue}; outline-offset: 3px; border-radius: 3px; }
        .mc-footer-bottom {
          max-width: 1180px; margin: 48px auto 0; padding-top: 24px;
          border-top: 1px solid ${COLORS.glassBorder};
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
          .mc-steps { grid-template-columns: 1fr; }
        }
        @media (max-width: 520px) {
         .mc-section { padding: 64px 18px; }
          .mc-nav { padding: 14px 18px; }
          .mc-nav-links { gap: 14px; }
          .mc-footer-grid { grid-template-columns: 1fr; }
          .mc-footer-brand { grid-column: auto; }
          .mc-int-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 700px) {
  /* Curry abilities: orb on top, chips wrap underneath */
  .mc-curry-wrap { height: auto; transform: none; display: flex; flex-direction: column; align-items: center; gap: 48px; padding-top: 22px; }
  .mc-curry-orb { position: relative; top: auto; left: auto; transform: none; }
  .mc-curry-abilities { position: static; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
  .mc-ability { position: static; width: auto; height: auto; transform: none; }
  .mc-ability-chip { transform: scale(0.85); }
  .in-view .mc-ability-chip { transform: scale(1); }

  /* Integrations: simple grid instead of a ring */
  .mc-integrations { height: auto; transform: none; }
  .mc-integrations-core { display: none; }
  .mc-integrations-ring { position: static; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px 8px; }
  .mc-integration { position: static; width: auto; height: auto; transform: none; }
  .mc-integration-badge { position: static; transform: none; margin: 0 auto; }
  .mc-integration-label { position: static; transform: none; text-align: center; }
}
.mc-works-with {
  display: flex; align-items: center; flex-wrap: wrap; gap: 14px 26px;
  margin-top: 56px; padding-top: 28px; border-top: 1px solid ${COLORS.glassBorder};
  font-size: 13.5px; color: ${COLORS.muted};
}
.mc-why2 { display: grid; grid-template-columns: 1fr 1.1fr; gap: 64px; align-items: start; }
.mc-why2-item { padding: 24px 0; border-top: 1px solid ${COLORS.glassBorder}; }
.mc-why2-item:last-child { border-bottom: 1px solid ${COLORS.glassBorder}; }

.mc-curry2 { display: grid; grid-template-columns: 1.1fr 1fr; gap: 64px; align-items: center; }
.mc-curry2-list { display: grid; gap: 20px; }
.mc-curry2-item { padding-left: 16px; border-left: 2px solid ${COLORS.purple}; }
 .mc-bento {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
  grid-template-areas: "pulse checkin checkin" "pulse music apps" "calls draw private";
}
.mc-tile {
  margin: 0; display: flex; flex-direction: column; overflow: hidden; background: #fff;
  border: 1px solid ${COLORS.glassBorder}; border-radius: 16px;
  box-shadow: 0 1px 2px rgba(15,23,32,0.04), 0 8px 24px rgba(15,23,32,0.05);
}
.mc-tile-pulse { grid-area: pulse; }
.mc-tile-checkin { grid-area: checkin; }
.mc-tile-music { grid-area: music; }
.mc-tile-apps { grid-area: apps; }
.mc-tile-calls { grid-area: calls; }
.mc-tile-draw { grid-area: draw; }
.mc-tile-private { grid-area: private; }
.mc-tile img { display: block; width: 100%; height: auto; }
.mc-tile-pulse img { flex: 1; min-height: 0; object-fit: cover; object-position: top; }
.mc-tile-body { display: flex; flex-direction: column; gap: 4px; padding: 20px 22px 22px; }
.mc-tile-body strong { font-family: 'Bricolage Grotesque', sans-serif; font-size: 17px; font-weight: 600; color: ${COLORS.text}; }
.mc-tile-body span { font-size: 14.5px; line-height: 1.55; color: ${COLORS.muted}; }
.mc-tile-logos { display: flex; flex-wrap: wrap; gap: 16px 20px; margin-top: 14px; }

@media (max-width: 900px) {
  .mc-bento {
    grid-template-columns: 1fr;
    grid-template-areas: "pulse" "checkin" "music" "apps" "calls" "draw" "private";
  }
  .mc-tile-pulse img { flex: none; max-height: 520px; }
}
 .mc-collabs { display: flex; align-items: center; flex-wrap: wrap; gap: 14px 28px; margin-top: 20px; font-size: 13.5px; color: ${COLORS.muted}; }
.mc-collabs img { height: 28px; width: auto; filter: grayscale(1); opacity: 0.8; }
html { scroll-behavior: smooth; scroll-padding-top: 76px; }

.mc-nav-center { display: flex; align-items: center; gap: 26px; }
.mc-nav-links .mc-btn { padding: 10px 18px; }
.mc-install { gap: 8px; }

.mc-hero { position: relative; }
.mc-hero::before {
  content: ''; position: absolute; top: 0; left: 50%; width: 100vw; height: 560px;
  transform: translateX(-50%); z-index: -1; pointer-events: none;
  background-image: radial-gradient(rgba(15,23,32,0.12) 1px, transparent 1px);
  background-size: 24px 24px;
  -webkit-mask-image: radial-gradient(ellipse at 50% 0%, #000 25%, transparent 72%);
  mask-image: radial-gradient(ellipse at 50% 0%, #000 25%, transparent 72%);
}
.mc-hero-quote { margin: 28px 0 0; padding-left: 16px; border-left: 2px solid ${COLORS.purple}; max-width: 440px; }
.mc-hero-quote blockquote { margin: 0; font-size: 15px; line-height: 1.6; color: ${COLORS.text}; }
.mc-hero-quote figcaption { margin-top: 8px; font-size: 13px; color: ${COLORS.muted}; }

.mc-modal { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(15,23,32,0.45); }
.mc-modal-panel { width: 100%; max-width: 420px; background: #fff; border-radius: 16px; padding: 28px; box-shadow: 0 24px 60px rgba(15,23,32,0.25); }
.mc-modal-steps { margin: 12px 0 24px; padding-left: 20px; color: ${COLORS.muted}; font-size: 15px; line-height: 1.7; }

@media (max-width: 900px) { .mc-nav-center { display: none; } }
@media (max-width: 520px) {
  .mc-nav-signin { display: none; }
  .mc-install-text { display: none; }
  .mc-nav-links .mc-install { padding: 10px 12px; }
}
.mc-nav-link, .mc-nav .mc-btn { white-space: nowrap; }
      `}</style>
    </div>
  )
}
