// src/components/SocialEmbedCard.jsx
// Shows a TikTok / Instagram post inside the chat using the platforms' own
// embed pages. Nothing loads until the user taps, so scrolling stays fast and
// the message list never jumps because of a late-loading iframe.
//
// Look: one tappable card - a brand-coloured badge, what it is ("Instagram reel"),
// who made it when the link says so, and a play button. Tap anywhere on it to watch
// here; the small arrow opens the real app. Props are unchanged: { link }.

import React, { useState } from 'react'

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
.mc-soc-pill--brand{background:var(--c)}
.mc-soc-pill--brand:hover{filter:brightness(1.1); background:var(--c)}
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

  const src =
    link.platform === 'instagram'
      ? link.embedUrl
      : tiktokId
        ? `https://www.tiktok.com/embed/v2/${tiktokId}`
        : null

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

  if (open && src) {
    return (
      <div className={`mc-soc mc-soc--${link.platform}`} style={{ ...rootStyle, width: `min(${brand.width}px, 100%)` }}>
        <div className="mc-soc-bar">
          <Badge platform={link.platform} size={28} />
          <span className="mc-soc-bar-title">{title}</span>
          <button type="button" className="mc-soc-pill" onClick={() => setOpen(false)}>Close</button>
          <button type="button" className="mc-soc-pill mc-soc-pill--brand" onClick={openExternal}>Open in {brand.name}</button>
        </div>
        <iframe
          title={`${brand.name} post`}
          src={src}
          loading="lazy"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          style={{ display: 'block', width: '100%', height: brand.height, border: 0, background: '#fff' }}
        />
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
