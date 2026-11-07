// src/beyond/BeyondPortal.jsx
//
// The BEYOND shell: spatial entrance, identity of the person whose chat is
// open, exit paths, and the five-environment dock.
//
// The environments below are honest placeholders. Each one says plainly that
// it is not connected yet. Replace an entry's `Panel` with a React.lazy()
// import as each phase lands; the shell does not change.

import React, { Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useTransform } from 'framer-motion'
import Avatar from '../components/Avatar'
import { BEYOND_VERSION, BEYOND_FEATURES } from './version'

// MapLibre is large: it loads only when someone opens BEYOND.
const WorldEnv = React.lazy(() => import('./environments/WorldEnv'))
const CinemaEnv = React.lazy(() => import('./environments/CinemaEnv'))

// A crash inside one environment must never take the chat down with it.
class EnvBoundary extends React.Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err) { console.error('[beyond] environment crashed:', err) }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="bd-panel">
        <h2 className="bd-panel-title">That didn’t load</h2>
        <p className="bd-panel-note">This part of Beyond hit an error. Your chat is fine. Go back to the chat and try again.</p>
      </div>
    )
  }
}

function NotWired({ what }) {
  return (
    <div className="bd-panel">
      <h2 className="bd-panel-title">Not wired in yet</h2>
      <p className="bd-panel-note">{what}</p>
    </div>
  )
}

/* ───────────────────────── custom icons ───────────────────────── */

const ico = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
}

// Entry glyph: a ring with a smaller ring slipping out of it
export function BeyondGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} {...ico}>
      <circle cx="10" cy="12" r="6.5" />
      <path d="M16.5 12h4.5M18.7 9.8 21 12l-2.3 2.2" />
    </svg>
  )
}

const IconWorld = () => (
  <svg width="22" height="22" {...ico}>
    <circle cx="12" cy="12" r="8" />
    <path d="M4 12h16M12 4c2.6 2.4 2.6 13.6 0 16M12 4c-2.6 2.4-2.6 13.6 0 16" />
  </svg>
)
const IconHealing = () => (
  <svg width="22" height="22" {...ico}>
    <path d="M12 20c-4 0-7-3-7-7 4 0 7 3 7 7Z" />
    <path d="M12 20c4 0 7-3 7-7-4 0-7 3-7 7Z" />
    <path d="M12 14.5c-2.2-2-2.2-6 0-9.5 2.2 3.500 2.2 7.500 0 9.500Z" />
  </svg>
)
const IconCinema = () => (
  <svg width="22" height="22" {...ico}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M10 9.500v5l4.200-2.500Z" />
  </svg>
)
const IconTogether = () => (
  <svg width="22" height="22" {...ico}>
    <circle cx="9" cy="12" r="5" />
    <circle cx="15" cy="12" r="5" />
  </svg>
)
const IconMemories = () => (
  <svg width="22" height="22" {...ico}>
    <rect x="4" y="4" width="16" height="16" rx="2.500" />
    <circle cx="9.500" cy="9.500" r="1.600" />
    <path d="M4 16.500 9 12.500l4 3 3-2 4 3" />
  </svg>
)
const IconChevronLeft = () => (
  <svg width="16" height="16" {...ico}><path d="m14.500 6-6 6 6 6" /></svg>
)

/* ───────────────────────── environments ───────────────────────── */

const FULL = new Set(['world', 'cinema']) // these draw edge to edge and manage their own scrolling

const ENVIRONMENTS = [
  {
    id: 'world', label: 'World', Icon: IconWorld, phase: 'Live',
    bg: 'radial-gradient(120% 80% at 80% 0%, #1d1240 0%, #0c0718 55%, #05030a 100%)',
    title: 'World',
    note: 'The live map is next. It will read the location sharing Mattchat already has, so nothing new is shared or tracked from here.',
  },
  {
    id: 'healing', label: 'Healing room', Icon: IconHealing, phase: 'Planned',
    bg: 'linear-gradient(180deg, #1b1745 0%, #2a2160 55%, #3b2c6a 100%)',
    title: 'Healing room',
    note: 'A quiet space for breathing, reflection and a private journal. Mood and journal entries will stay private unless you choose to share.',
  },
  {
    id: 'cinema', label: 'Cinema', Icon: IconCinema, phase: 'Live',
    bg: 'radial-gradient(90% 55% at 50% -8%, rgba(255,214,170,.16), transparent 62%), #050407',
    title: 'Cinema',
    note: 'Movie discovery from TMDB, with suggestions the two of you can accept or decline. Needs a server-side TMDB key before it can load anything.',
  },
  {
    id: 'together', label: 'Together', Icon: IconTogether, phase: 'Planned',
    bg: 'radial-gradient(100% 70% at 20% 100%, #26164f 0%, #0d0820 60%, #06040d 100%)',
    title: 'Together',
    note: 'Daily questions, would-you-rathers and a shared playlist that reuses the music player you already have. Both of you opt in.',
  },
  {
    id: 'memories', label: 'Memories', Icon: IconMemories, phase: 'Planned',
    bg: 'linear-gradient(180deg, #100b1c 0%, #0a0712 100%)',
    title: 'Memories',
    note: 'A timeline of things the two of you choose to save. Nothing is collected from your messages automatically.',
  },
]

function PendingPanel({ env, name }) {
  return (
    <div className="bd-panel">
      <h2 className="bd-panel-title">{env.title}</h2>
      <p className="bd-panel-note">{env.note}</p>
      <p className="bd-panel-status">
        <span className="bd-dot" aria-hidden />
        Not connected yet · {env.phase}
      </p>
      <p className="bd-panel-for">With {name}</p>
    </div>
  )
}

/* ───────────────────────── styles ───────────────────────── */

const CSS = `
.bd-root{--bd-void:#07050d;--bd-mid:#130b26;--bd-purple:#6c63ff;--bd-lav:#a78bfa;--bd-ink:#f1eefc;--bd-dim:#b8b0d6;
  position:fixed;inset:0;z-index:3000;overflow:hidden;color:var(--bd-ink);background:var(--bd-void);
  font-family:inherit;-webkit-tap-highlight-color:transparent;overscroll-behavior:contain}
.bd-bg{position:absolute;inset:0}
.bd-light{position:absolute;width:70vmax;height:70vmax;border-radius:50%;pointer-events:none;will-change:transform;
  background:radial-gradient(closest-side,rgba(108,99,255,.22),transparent 70%)}
.bd-light.a{top:-30vmax;right:-25vmax;animation:bdDriftA 26s ease-in-out infinite alternate}
.bd-light.b{bottom:-35vmax;left:-30vmax;background:radial-gradient(closest-side,rgba(167,139,250,.13),transparent 70%);
  animation:bdDriftB 32s ease-in-out infinite alternate}
@keyframes bdDriftA{to{transform:translate3d(-6vmax,5vmax,0)}}
@keyframes bdDriftB{to{transform:translate3d(7vmax,-4vmax,0)}}

.bd-content{position:absolute;inset:0;display:flex;flex-direction:column;
  padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) 0 env(safe-area-inset-left,0px)}

.bd-top{display:flex;align-items:center;gap:12px;padding:14px 16px 8px}
.bd-id{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
.bd-id-text{min-width:0}
.bd-name{font-size:16px;font-weight:700;letter-spacing:.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bd-word{font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;font-style:italic;
  font-size:14px;color:var(--bd-lav);letter-spacing:.02em}
.bd-presence{margin-top:1px;font-size:12px;color:var(--bd-dim)}
.bd-back{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px 0 10px;border-radius:999px;
  border:1px solid rgba(167,139,250,.28);background:rgba(19,11,38,.6);color:var(--bd-ink);
  font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;transition:background .18s,border-color .18s}
.bd-back:hover{background:rgba(108,99,255,.22);border-color:rgba(167,139,250,.5)}

.bd-stage{position:relative;flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}
.bd-stage.full{overflow:hidden}
.bd-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--bd-dim);font-size:14px}
.bd-panel{max-width:520px;margin:0 auto;padding:clamp(28px,9vh,72px) 24px 140px}
.bd-panel-title{margin:0 0 14px;font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;
  font-weight:500;font-size:clamp(34px,9vw,52px);line-height:1.05;letter-spacing:-.01em}
.bd-panel-note{margin:0 0 22px;font-size:15.5px;line-height:1.6;color:var(--bd-dim);max-width:46ch}
.bd-panel-status{display:flex;align-items:center;gap:9px;margin:0 0 6px;font-size:13px;font-weight:600;color:var(--bd-lav)}
.bd-dot{width:7px;height:7px;border-radius:50%;background:var(--bd-lav);box-shadow:0 0 0 4px rgba(167,139,250,.16)}
.bd-panel-for{margin:0;font-size:12.5px;color:var(--bd-dim)}

.bd-dock-wrap{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:center;pointer-events:none;
  padding:0 12px calc(env(safe-area-inset-bottom,0px) + 12px)}
.bd-dock{pointer-events:auto;display:flex;gap:2px;padding:5px;border-radius:26px;width:min(100%,460px);
  background:rgba(12,7,24,.82);border:1px solid rgba(167,139,250,.2);box-shadow:0 14px 40px rgba(0,0,0,.5)}
.bd-tab{position:relative;flex:1;min-width:0;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  border:none;background:none;color:var(--bd-dim);font:inherit;font-size:11px;font-weight:600;cursor:pointer;border-radius:21px;
  transition:color .2s}
.bd-tab[aria-selected="true"]{color:var(--bd-ink)}
.bd-tab > span,.bd-tab > svg{position:relative;z-index:1}
.bd-tab-lbl{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px}
.bd-pill{position:absolute;inset:0;border-radius:21px;background:linear-gradient(160deg,rgba(108,99,255,.42),rgba(108,99,255,.16));
  box-shadow:inset 0 0 0 1px rgba(167,139,250,.35)}

.bd-edge{position:absolute;top:0;bottom:0;left:0;width:22px;z-index:5;touch-action:none}

.bd-back:focus-visible,.bd-tab:focus-visible{outline:2px solid var(--bd-lav);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.bd-light{animation:none}.bd-back,.bd-tab{transition:none}}
`

/* ───────────────────────── portal ───────────────────────── */

export default function BeyondPortal({ beyond, contact, ctx }) {
  const { progress, open, closeBeyond } = beyond
  const [tab, setTab] = useState('world')
  const closeBtnRef = useRef(null)
  const tabRefs = useRef({})
  const edge = useRef(null)

  // Iris that opens from the right edge as the chat slides away to the left.
  const clipPath = useTransform(progress, (p) => {
    const r = p * Math.hypot(window.innerWidth, window.innerHeight)
    return `circle(${r}px at 100% 50%)`
  })
  const contentOpacity = useTransform(progress, [0.35, 1], [0, 1])
  const contentScale = useTransform(progress, [0, 1], [1.06, 1])

  // Focus the way back as soon as the world is open.
  useEffect(() => {
    if (!open) return undefined
    console.info(`[beyond] v${BEYOND_VERSION} (${BEYOND_FEATURES})`)
    const id = requestAnimationFrame(() => closeBtnRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(id)
  }, [open])

  // Escape closes.
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeBeyond() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, closeBeyond])

  // Exit gesture: swipe right starting at the left edge.
  // (Not anywhere on screen: the World map will own horizontal panning.)
  const edgeStart = useRef(null)
  const onEdgeDown = (e) => { edgeStart.current = { x: e.clientX, id: e.pointerId } }
  const onEdgeMove = (e) => {
    const s = edgeStart.current
    if (!s || e.pointerId !== s.id) return
    if (e.clientX - s.x > 56) { edgeStart.current = null; closeBeyond() }
  }
  const onEdgeEnd = () => { edgeStart.current = null }

  const onTabKey = (e) => {
    const i = ENVIRONMENTS.findIndex((x) => x.id === tab)
    let n = null
    if (e.key === 'ArrowRight') n = (i + 1) % ENVIRONMENTS.length
    else if (e.key === 'ArrowLeft') n = (i - 1 + ENVIRONMENTS.length) % ENVIRONMENTS.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = ENVIRONMENTS.length - 1
    if (n === null) return
    e.preventDefault()
    const id = ENVIRONMENTS[n].id
    setTab(id)
    tabRefs.current[id]?.focus()
  }

  const env = ENVIRONMENTS.find((x) => x.id === tab)

  const renderEnvironment = () => {
    if (env.id === 'world' || env.id === 'cinema') {
      if (!ctx || !ctx.conversationId || !ctx.liveShare) {
        return <NotWired what="ChatPage isn’t passing this screen its chat details yet. Run scripts/wire-beyond.js again, then reload." />
      }
      if (env.id === 'world' && !contact?.id) {
        return <NotWired what="I couldn’t work out who this chat is with, so there is no location to look up." />
      }
      const Env = env.id === 'world' ? WorldEnv : CinemaEnv
      return (
        <Suspense fallback={<div className="bd-loading" role="status">Loading…</div>}>
          <Env contact={contact} ctx={ctx} active={open} />
        </Suspense>
      )
    }
    return <PendingPanel env={env} name={contact.name} />
  }

  return createPortal(
    <motion.div
      className="bd-root"
      style={{ clipPath, WebkitClipPath: clipPath }}
      role="dialog"
      aria-modal="true"
      aria-label={`Beyond with ${contact.name}`}
    >
      <style>{CSS}</style>

      <AnimatePresence initial={false}>
        <motion.div
          key={env.id}
          className="bd-bg"
          style={{ background: env.bg }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
      </AnimatePresence>
      <div className="bd-light a" aria-hidden />
      <div className="bd-light b" aria-hidden />

      <motion.div className="bd-content" style={{ opacity: contentOpacity, scale: contentScale }}>
        <header className="bd-top">
          <div className="bd-id">
            <Avatar name={contact.name} size={40} photoUrl={contact.avatarUrl} online={contact.online} />
            <div className="bd-id-text">
              <div className="bd-name">{contact.name}</div>
              <div className="bd-word">Beyond</div>
              {contact.presenceLabel ? <div className="bd-presence">{contact.presenceLabel}</div> : null}
            </div>
          </div>
          <button ref={closeBtnRef} className="bd-back" onClick={() => closeBeyond()} aria-label={`Back to chat with ${contact.name}`}>
            <IconChevronLeft /> Chat
          </button>
        </header>

        <main className={`bd-stage${FULL.has(env.id) ? ' full' : ''}`} id={`bd-panel-${env.id}`} role="tabpanel" aria-labelledby={`bd-tab-${env.id}`}>
          <EnvBoundary resetKey={env.id}>{renderEnvironment()}</EnvBoundary>
        </main>

        <div className="bd-dock-wrap">
          <nav className="bd-dock" role="tablist" aria-label="Beyond environments" onKeyDown={onTabKey}>
            {ENVIRONMENTS.map(({ id, label, Icon }) => {
              const selected = id === tab
              return (
                <button
                  key={id}
                  id={`bd-tab-${id}`}
                  ref={(el) => { tabRefs.current[id] = el }}
                  className="bd-tab"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`bd-panel-${id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTab(id)}
                >
                  {selected && (
                    <motion.span className="bd-pill" layoutId="bd-pill" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />
                  )}
                  <Icon />
                  <span className="bd-tab-lbl">{label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </motion.div>

      <div
        ref={edge}
        className="bd-edge"
        onPointerDown={onEdgeDown}
        onPointerMove={onEdgeMove}
        onPointerUp={onEdgeEnd}
        onPointerCancel={onEdgeEnd}
        aria-hidden
      />
    </motion.div>,
    document.body,
  )
}
