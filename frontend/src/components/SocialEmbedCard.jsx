// src/components/SocialEmbedCard.jsx
// Shows a TikTok / Instagram post inside the chat using the platforms' own
// embed pages. Nothing loads until the user taps, so scrolling stays fast and
// the message list never jumps because of a late-loading iframe.

import React, { useState } from 'react'

const BRAND = {
  tiktok: { name: 'TikTok', color: '#fe2c55', width: 325, height: 575 },
  instagram: { name: 'Instagram', color: '#e1306c', width: 340, height: 560 },
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

  const btn = {
    border: 'none', cursor: 'pointer', borderRadius: 999, padding: '7px 14px',
    fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  }

  return (
    <div
      style={{
        marginTop: 6, width: `min(${brand.width}px, 100%)`, borderRadius: 14,
        overflow: 'hidden', background: 'var(--bg-surface-1, #14141f)',
        border: '1px solid var(--border, #2a2a3a)',
      }}
    >
      {open && src ? (
        <>
          <iframe
            title={`${brand.name} post`}
            src={src}
            loading="lazy"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
            style={{ display: 'block', width: '100%', height: brand.height, border: 0, background: '#fff' }}
          />
          <div style={{ display: 'flex', gap: 8, padding: 8, justifyContent: 'space-between' }}>
            <button type="button" onClick={() => setOpen(false)} style={{ ...btn, background: 'transparent', color: 'var(--text-muted, #a39bc0)' }}>
              Close
            </button>
            <button type="button" onClick={openExternal} style={{ ...btn, background: brand.color, color: '#fff' }}>
              Open in {brand.name}
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ width: 5, background: brand.color, flex: 'none' }} />
          <div style={{ padding: '10px 12px', flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--dark-text, #ffffff)' }}>
              {brand.name} {link.platform === 'tiktok' ? 'video' : 'post'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={handlePlay} disabled={loading} style={{ ...btn, background: brand.color, color: '#fff', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Loading…' : 'View here'}
              </button>
              <button type="button" onClick={openExternal} style={{ ...btn, background: 'var(--chip, #241d3b)', color: 'var(--dark-text, #ffffff)' }}>
                Open in {brand.name}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
