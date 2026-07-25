import React, { useState, useEffect } from 'react'
import { fetchYouTubeOEmbed } from '../lib/youtube'

export default function YouTubeCard({ videoId, onPlay }) {
  const [meta, setMeta] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchYouTubeOEmbed(videoId).then((data) => {
      if (cancelled) return
      if (data) setMeta(data)
      else setFailed(true)
    })
    return () => { cancelled = true }
  }, [videoId])

  if (failed) {
    // Falls back to a plain link rather than nothing — never worse
    // than showing raw text.
    return (
      <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', fontSize: 13 }}>
        youtube.com/watch?v={videoId}
      </a>
    )
  }

  if (!meta) {
    return (
      <div style={{ width: 280, height: 158, borderRadius: 12, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
        Loading preview…
      </div>
    )
  }

  return (
    <button
      onClick={() => onPlay(videoId)}
      style={{
        display: 'block', width: 280, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)',
        background: 'var(--bg-surface-2)', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit',
      }}
    >
      <div style={{ position: 'relative' }}>
        <img src={meta.thumbnailUrl} alt={meta.title} style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.15)',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {meta.title}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>{meta.authorName}</div>
      </div>
    </button>
  )
}
