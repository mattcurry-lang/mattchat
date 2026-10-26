// src/components/SocialEmbedCard.jsx
// Shows a TikTok / Instagram post inside the chat using the platforms' own
// embed pages. Nothing loads until the user taps, so scrolling stays fast and
// the message list never jumps because of a late-loading iframe.
//
// TikTok: plays through TikTok's official player (tiktok.com/player/v1/<id>). The older
// /embed/v2/<id> page now answers many sites with "overload-protect triggered" (HTTP 503/429).
// The player tells the page when it is ready, so a video that does not start is caught: it retries
// once by itself, then shows a clear "couldn't load" panel with Try again / Open in TikTok instead of
// TikTok's raw error text.
//
// Look: one tappable card - a brand-coloured badge, what it is ("Instagram reel"),
// who made it when the link says so, and a play button. Tap anywhere on it to watch
// here; the small arrow opens the real app. Props are unchanged: { link }.

import React, { useEffect, useRef, useState } from 'react'

const BRAND = {
  tiktok: { name: 'TikTok', color: '#fe2c55', width: 325, height: 575 },
  instagram: { name: 'Instagram', color: '#e1306c', width: 340, height: 560 },
}

const CSS = `
.mc-soc{margin-top:6px; border-radius:16px; overflow:hidden; background:#14141f; border:1px solid rgba(245,245,250,.1); box-shadow:0 8px 22px -12px rgba(0,0,0,.65); font-family:inherit; color:#f5f5fa; text-align:left}
.mc-soc--instagram{background:radial-gradient(120% 150% at 0% 0%, rgba(225,48,108,.2), transparent 55%), radial-gradient(100% 120% at 100% 100%, rgba(131,58,180,.16), transparent 55%), #14141f}
.mc-soc--tiktok{background:radial-gradient(120% 150% at 0% 0%, rgba(37,244,238,.13), transparent 52%), radial-gradient(100% 120% at 100% 100%, rgba(254,44,85,.18), transparent 55%), #14141f}
.mc-soc-card{display:flex; align-items:center; gap:2px; padding:5px 8px 5px 5px}
.mc-soc-main{display:flex; align-items:center; gap:12px; flex:1; min-width:0; padding:7px; border:0; border-radius:13px; background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; transition:background .15s ease, transform .12s ease}
.mc-soc-main:hover:not(:disabled){background:rgba(255,255,255,.06)}
.mc-soc-main:active:not(:disabled){transform:scale(.985)}
.mc-soc-main:disabled{cursor:progress}
.mc-soc-text{display:flex; flex-direction:column; min-width:0; flex:1}
.mc-soc-title{font-size:14.5px; font-weight:700; letter-spacing:-.01em; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mc-soc-sub{margin-top:2px; font-size:12.5px; line-height:1.25; color:rgba(245,245,250,.62); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mc-soc-play{width:38px; height:38px; flex:none; display:grid; place-items:center; border-radius:50%; color:#fff; background:#fe2c55; box-shadow:0 6px 16px -6px rgba(0,0,0,.7)}
.mc-soc--instagram .mc-soc-play{background:linear-gradient(135deg,#f58529,#dd2a7b 55%,#8134af)}
.mc-soc-ext{width:34px; height:34px; flex:none; display:grid; place-items:center; border:0; border-radius:50%; background:rgba(255,255,255,.08); color:rgba(245,245,250,.85); cursor:pointer; transition:background .15s ease}
.mc-soc-ext:hover{background:rgba(255,255,255,.18)}
.mc-soc-main:focus-visible,.mc-soc-ext:focus-visible,.mc-soc-pill:focus-visible{outline:2px solid #a78bfa; outline-offset:2px}
.mc-soc-bar{display:flex; align-items:center; gap:10px; padding:8px 8px 8px 10px}
.mc-soc-bar-title{flex:1; min-width:0; font-size:13.5px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mc-soc-pill{border:0; border-radius:999px; padding:6px 12px; font:inherit; font-size:12.5px; font-weight:650; color:#fff; background:rgba(255,255,255,.1); cursor:pointer; transition:background .15s ease}
.mc-soc-pill:hover{background:rgba(255,255,255,.2)}
.mc-soc-pill--icon{width:32px; height:32px; padding:0; display:grid; place-items:center}
.mc-soc-pill--brand{background:var(--c)}
.mc-soc-pill--brand:hover{filter:brightness(1.1); background:var(--c)}
.mc-soc-state{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:20px; text-align:center; background:#0b0b12; color:rgba(245,245,250,.85); font-size:13px}
.mc-soc-state strong{font-size:14.5px; color:#fff}
.mc-soc-why{font-size:11.5px; line-height:1.4; color:rgba(245,245,250,.5); max-width:30ch}
.mc-soc-link{border:0; background:none; padding:4px; font:inherit; font-size:12px; color:rgba(245,245,250,.6); text-decoration:underline; cursor:pointer}
.mc-soc-link:hover{color:#fff}
.mc-soc-state-actions{display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:4px}
.mc-soc-spin{animation:mc-soc-spin .8s linear infinite}
@keyframes mc-soc-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.mc-soc-spin{animation:none}.mc-soc-main{transition:none}}
`

let stylesAdded = false
function ensureSocialStyles() {
  if (stylesAdded || typeof document === 'undefined') return
  stylesAdded = true
  const el = document.createElement('style')
  el.setAttribute('data-mc-soc', '')
  el.textContent = CSS
  document.head.appendChild(el)
}

ensureSocialStyles()

function Badge({ platform, size = 44 }) {
  const common = { width: size, height: size, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: Math.round(size * 0.3) }
  if (platform === 'instagram') {
    return (
      <span aria-hidden="true" style={{ ...common, background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285aeb 90%)' }}>
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="1.1" fill="#fff" stroke="none" />
        </svg>
      </span>
    )
  }
  const note = (
    <>
      <path d="M14.2 3.5v10.4a3.6 3.6 0 1 1-3.6-3.6" />
      <path d="M14.2 3.5c.3 2.5 1.9 4.1 4.5 4.4" />
    </>
  )
  return (
    <span aria-hidden="true" style={{ ...common, background: '#000', border: '1px solid rgba(255,255,255,.1)' }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <g stroke="#25f4ee" transform="translate(-.9 .8)">{note}</g>
        <g stroke="#fe2c55" transform="translate(.9 -.8)">{note}</g>
        <g stroke="#fff">{note}</g>
      </svg>
    </span>
  )
}

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" /></svg>
)
const SpinnerIcon = () => (
  <svg className="mc-soc-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
)
const OpenIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg>
)

// How long a working TikTok player takes to say hello once its page has loaded, and how long we
// wait for a page that never loads at all.
const TT_GRACE_MS = 7000     // generous: TikTok's player is heavy and phones on slow data need time
const TT_NEVER_MS = 14000
const TT_PLAYER_AUTORETRIES = 1

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
)

// Why the player gave up, in words a person can read (and report back to us)
const WHY = {
  'never-loaded': 'TikTok’s page never finished loading.',
  silent: 'TikTok’s page loaded, but its player never started. A privacy setting (for example Brave Shields blocking cookies) or TikTok itself can cause this.',
}
const whyText = (r) => WHY[r] || (/^error-/.test(r) ? `TikTok’s player reported error ${r.slice(6)}.` : '')

function isTikTokOrigin(origin) {
  try { return /(^|\.)tiktok\.com$/i.test(new URL(origin).hostname) } catch { return false }
}

// TikTok's official player. `status`: loading (hidden behind a spinner) -> ready | failed.
function TikTokPlayer({ id, height, onOpen }) {
  const frameRef = useRef(null)
  const [attempt, setAttempt] = useState(0)        // each attempt is a brand-new iframe
  const [status, setStatus] = useState('loading')
  const [reason, setReason] = useState('')
  const [bypass, setBypass] = useState(false)      // "Show player anyway": no waiting, no hiding

  useEffect(() => {
    if (bypass) return undefined
    let settled = false
    let timer = null
    const ok = () => { if (settled) return; settled = true; clearTimeout(timer); setStatus('ready') }
    const fail = (why) => {
      if (settled) return
      settled = true; clearTimeout(timer)
      setReason(why)
      // eslint-disable-next-line no-console
      console.warn('[TikTok player] did not start:', why, `(attempt ${attempt + 1})`)
      if (attempt < TT_PLAYER_AUTORETRIES) setAttempt((a) => a + 1)   // one quiet retry first
      else setStatus('failed')
    }
    const onMessage = (e) => {
      const win = frameRef.current && frameRef.current.contentWindow
      if (!win || e.source !== win || !isTikTokOrigin(e.origin)) return
      let d = e.data
      if (typeof d === 'string') { try { d = JSON.parse(d) } catch { return } }
      if (!d || d['x-tiktok-player'] !== true) return
      if (d.type === 'onPlayerError') {
        const code = typeof d.value === 'number' ? d.value : d.value && d.value.code
        if (code === 3002) ok()            // autoplay was blocked: the player itself is fine
        else fail(`error-${code}`)
      } else {
        ok()                               // onPlayerReady / onStateChange / ...: it is alive
      }
    }
    const frame = frameRef.current
    const onLoad = () => { clearTimeout(timer); if (!settled) timer = setTimeout(() => fail('silent'), TT_GRACE_MS) }
    window.addEventListener('message', onMessage)
    if (frame) frame.addEventListener('load', onLoad)
    timer = setTimeout(() => fail('never-loaded'), TT_NEVER_MS)
    return () => {
      settled = true
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      if (frame) frame.removeEventListener('load', onLoad)
    }
  }, [attempt, bypass])

  const retry = () => { setStatus('loading'); setReason(''); setAttempt((a) => a + 1) }
  const showAnyway = () => { setBypass(true); setAttempt((a) => a + 1) }

  return (
    <div style={{ position: 'relative', width: '100%', height, background: '#000' }}>
      {(bypass || status !== 'failed') && (
        <iframe
          key={attempt}
          ref={frameRef}
          title="TikTok video"
          src={`https://www.tiktok.com/player/v1/${id}?music_info=1&description=1`}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#000', visibility: bypass || status === 'ready' ? 'visible' : 'hidden' }}
        />
      )}
      {!bypass && status === 'loading' && (
        <div className="mc-soc-state" role="status">
          <SpinnerIcon />
          <span>Loading video…</span>
        </div>
      )}
      {!bypass && status === 'failed' && (
        <div className="mc-soc-state" role="alert">
          <strong>Couldn’t load this video here</strong>
          <span>TikTok is busy or isn’t allowing it to play in chat right now.</span>
          {whyText(reason) && <span className="mc-soc-why" data-why={reason}>{whyText(reason)}</span>}
          <div className="mc-soc-state-actions">
            <button type="button" className="mc-soc-pill" onClick={retry}>Try again</button>
            <button type="button" className="mc-soc-pill mc-soc-pill--brand" onClick={onOpen}>Open in TikTok</button>
          </div>
          <button type="button" className="mc-soc-link" onClick={showAnyway}>Show the player anyway</button>
        </div>
      )}
    </div>
  )
}

function titleFor(link) {
  if (link.platform === 'tiktok') return 'TikTok video'
  if (link.kind === 'reel') return 'Instagram reel'
  if (link.kind === 'tv') return 'Instagram video'
  return 'Instagram post'
}

// Short TikTok links (vm./vt./t/) don't contain the video id, so ask TikTok's
// oEmbed endpoint for it. Returns null if the request is blocked or fails.
async function resolveTikTokId(url) {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const data = await res.json()
    const m = String(data.html || '').match(/data-video-id="(\d+)"/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

export default function SocialEmbedCard({ link }) {
  const brand = BRAND[link.platform]
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tiktokId, setTiktokId] = useState(link.id || null)

  if (!brand) return null

  // Instagram: its embed page. TikTok: we just need the video id (TikTokPlayer builds the player URL).
  const canEmbed = link.platform === 'instagram' ? Boolean(link.embedUrl) : Boolean(tiktokId)

  const title = titleFor(link)
  const openExternal = () => window.open(link.url, '_blank', 'noopener,noreferrer')

  const handlePlay = async () => {
    if (link.platform === 'instagram' || tiktokId) {
      setOpen(true)
      return
    }
    setLoading(true)
    const id = await resolveTikTokId(link.url)
    setLoading(false)
    if (id) {
      setTiktokId(id)
      setOpen(true)
    } else {
      // Could not resolve the short link: just open TikTok instead.
      openExternal()
    }
  }

  const rootStyle = { '--c': brand.color }

  if (open && canEmbed) {
    return (
      <div className={`mc-soc mc-soc--${link.platform}`} style={{ ...rootStyle, width: `min(${brand.width}px, 100%)` }}>
        <div className="mc-soc-bar">
          <Badge platform={link.platform} size={28} />
          <span className="mc-soc-bar-title">{title}</span>
          <button type="button" className="mc-soc-pill mc-soc-pill--icon" onClick={() => setOpen(false)} aria-label="Close" title="Close"><CloseIcon /></button>
          <button type="button" className="mc-soc-pill mc-soc-pill--brand" onClick={openExternal} aria-label={`Open in ${brand.name}`} title={`Open in ${brand.name}`}>Open ↗</button>
        </div>
        {link.platform === 'tiktok' ? (
          <TikTokPlayer id={tiktokId} height={brand.height} onOpen={openExternal} />
        ) : (
          <iframe
            title={`${brand.name} post`}
            src={link.embedUrl}
            loading="lazy"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
            style={{ display: 'block', width: '100%', height: brand.height, border: 0, background: '#fff' }}
          />
        )}
      </div>
    )
  }

  return (
    <div className={`mc-soc mc-soc--${link.platform}`} style={{ ...rootStyle, width: 'min(340px, 100%)' }}>
      <div className="mc-soc-card">
        <button type="button" className="mc-soc-main" onClick={handlePlay} disabled={loading} aria-label={`Watch this ${title} here`}>
          <Badge platform={link.platform} />
          <span className="mc-soc-text">
            <span className="mc-soc-title">{title}</span>
            <span className="mc-soc-sub">
              {loading ? 'Loading…' : link.handle ? `@${link.handle} · Tap to watch` : 'Tap to watch here'}
            </span>
          </span>
          <span className="mc-soc-play">{loading ? <SpinnerIcon /> : <PlayIcon />}</span>
        </button>
        <button type="button" className="mc-soc-ext" onClick={openExternal} aria-label={`Open in ${brand.name}`} title={`Open in ${brand.name}`}>
          <OpenIcon />
        </button>
      </div>
    </div>
  )
}
