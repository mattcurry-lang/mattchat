import React, { useState, useEffect } from 'react'
import { getCachedHighlight, findMatchHighlights } from '../../lib/matchHighlights'

// match: { id, homeTeam, awayTeam }
export default function HighlightsButton({ session, match, onSelectVideo }) {
  const [state, setState] = useState('checking') // 'checking' | 'idle' | 'searching' | 'found' | 'not_found'
  const [videoId, setVideoId] = useState(null)

  useEffect(() => {
    let cancelled = false
    getCachedHighlight(match.id)
      .then(cached => {
        if (cancelled) return
        if (!cached) { setState('idle'); return }
        if (cached.not_found) { setState('not_found'); return }
        setVideoId(cached.video_id)
        setState('found')
      })
      .catch(() => setState('idle'))
    return () => { cancelled = true }
  }, [match.id])

  const search = async () => {
    setState('searching')
    try {
      const row = await findMatchHighlights(session, match)
      if (row.not_found) { setState('not_found'); return }
      setVideoId(row.video_id)
      setState('found')
    } catch (e) {
      console.error('findMatchHighlights failed:', e)
      setState('idle')
    }
  }

  if (state === 'checking') return null

  if (state === 'found') {
    return (
      <button
        onClick={() => onSelectVideo(videoId)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#ef4444,#f97316)',
          border: 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 11.5, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', marginTop: 6,
        }}
      >
        ▶ Watch Highlights
      </button>
    )
  }

  if (state === 'not_found') {
    return (
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
        Highlights not available yet
      </div>
    )
  }

  return (
    <button
      onClick={search}
      disabled={state === 'searching'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(167,139,250,0.14)',
        border: '1px solid rgba(167,139,250,0.3)', borderRadius: 20, padding: '6px 14px',
        color: '#c4b5fd', fontSize: 11.5, fontWeight: 700, cursor: state === 'searching' ? 'default' : 'pointer',
        fontFamily: 'inherit', marginTop: 6, opacity: state === 'searching' ? 0.6 : 1,
      }}
    >
      {state === 'searching' ? 'Searching…' : '🔍 Find Highlights'}
    </button>
  )
}
