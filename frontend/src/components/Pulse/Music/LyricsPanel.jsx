import React, { useEffect, useRef, useState } from 'react'
import { LyricsService } from '../../../lib/music/LyricsService'
import { IconLyrics } from '../../Icons'

export default function LyricsPanel({ track, currentTime, seekTo, large = false, rgb = '255,255,255' }) {
  const c = (a) => (a === 1 ? `rgb(${rgb})` : `rgba(${rgb},${a})`)
  const [state, setState] = useState({ status: 'loading' })
  const [retry, setRetry] = useState(0)
  const boxRef = useRef(null)
  const lineRefs = useRef([])
  const lastUserScroll = useRef(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    LyricsService.get(track).then((r) => {
      if (cancelled) return
      setState(r ? { status: 'ready', ...r } : { status: 'none' })
    }).catch(() => { if (!cancelled) setState({ status: 'error' }) })
    return () => { cancelled = true }
  }, [track?.id, retry])

  const synced = state.status === 'ready' ? state.synced : null
  let active = -1
  if (synced) {
    for (let i = synced.length - 1; i >= 0; i--) {
      if (synced[i].t <= currentTime + 0.25) { active = i; break }
    }
  }

  useEffect(() => {
    if (active < 0 || Date.now() - lastUserScroll.current < 3500) return
    const box = boxRef.current
    const el = lineRefs.current[active]
    if (!box || !el) return
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' })
  }, [active])

  const markScroll = () => { lastUserScroll.current = Date.now() }
  const fontSize = large ? 28 : 22

  const center = (children) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32, textAlign: 'center', color: c(0.6), fontSize: 14 }}>
      {children}
    </div>
  )

  if (state.status === 'loading') {
    return center(
      <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[90, 70, 85, 55, 75].map((w, i) => (
          <div key={i} style={{ height: 18, width: `${w}%`, borderRadius: 9, background: c(0.12), animation: 'mc-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.12}s` }} />
        ))}
        <style>{`@keyframes mc-pulse{0%,100%{opacity:.4}50%{opacity:.9}}`}</style>
      </div>
    )
  }
  if (state.status === 'error') {
    return center(<>
      <IconLyrics size={30} />
      <div>Couldn't load lyrics. Check your connection.</div>
      <button onClick={() => setRetry((n) => n + 1)} style={{ marginTop: 6, padding: '8px 18px', borderRadius: 999, border: 'none', background: c(0.14), color: c(1), fontWeight: 700, cursor: 'pointer' }}>Retry</button>
    </>)
  }
  if (state.status === 'none') {
    const q = encodeURIComponent(`${track.artist || ''} ${track.title || ''} lyrics`.trim())
    return center(<>
      <IconLyrics size={30} />
      <div style={{ fontWeight: 700, color: c(1) }}>No lyrics found for this song</div>
      <a href={`https://www.google.com/search?q=${q}`} target="_blank" rel="noreferrer" style={{ color: c(0.75), fontSize: 13 }}>Search the web</a>
    </>)
  }
  if (state.instrumental) {
    return center(<><IconLyrics size={30} /><div style={{ fontWeight: 700, color: c(1) }}>Instrumental</div></>)
  }

  return (
    <div
      ref={boxRef} onWheel={markScroll} onTouchMove={markScroll}
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative', padding: '28px 24px 120px', scrollbarWidth: 'none', WebkitMaskImage: 'linear-gradient(transparent 0, #000 9%, #000 88%, transparent 100%)', maskImage: 'linear-gradient(transparent 0, #000 9%, #000 88%, transparent 100%)' }}
    >
      {synced ? synced.map((l, i) => {
        const isActive = i === active
        const past = i < active
        return (
          <div
            key={i} ref={(el) => { lineRefs.current[i] = el }}
            onClick={() => { lastUserScroll.current = 0; seekTo(l.t) }}
            style={{
              fontSize, lineHeight: 1.3, fontWeight: 800, letterSpacing: -0.3, padding: '7px 0', cursor: 'pointer',
              color: isActive ? c(1) : c(past ? 0.34 : 0.5),
              transform: isActive ? 'scale(1.02)' : 'scale(1)', transformOrigin: 'left center',
              transition: 'color .35s ease, transform .35s ease',
            }}
          >
            {l.text || '♪'}
          </div>
        )
      }) : (
        <div style={{ fontSize: large ? 20 : 18, lineHeight: 1.6, fontWeight: 700, color: c(0.88), whiteSpace: 'pre-wrap' }}>
          {state.plain}
        </div>
      )}
      <div style={{ marginTop: 28, fontSize: 11, color: c(0.4) }}>
        {synced ? 'Synced lyrics · ' : ''}Lyrics from LRCLIB
      </div>
    </div>
  )
}
