import React, { useState, useEffect, useCallback } from 'react'
import { searchYouTube, saveYouTubeSearch, listYouTubeSearchHistory, deleteYouTubeSearchHistoryItem, clearYouTubeSearchHistory } from '../../lib/supabase'

function VideoGridCard({ video, onSelect }) {
  return (
    <button
      onClick={() => onSelect(video.videoId)}
      style={{
        display: 'flex', flexDirection: 'column', background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit',
      }}
    >
      <img src={video.thumbnailUrl} alt={video.title} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.35 }}>
          {video.title}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{video.channelTitle}</div>
      </div>
    </button>
  )
}

export default function YouTubePulsePage({ session, userId, onSelectVideo, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [history, setHistory] = useState([])

  const loadHistory = useCallback(() => {
    listYouTubeSearchHistory(userId).then(setHistory).catch(console.error)
  }, [userId])

  useEffect(() => { loadHistory() }, [loadHistory])

  const runSearch = async (q) => {
    const term = (q ?? query).trim()
    if (!term) return
    setQuery(term)
    setLoading(true)
    setSearched(true)
    try {
      const res = await searchYouTube(session, term)
      setResults(res.ok ? res.results : [])
      await saveYouTubeSearch(userId, term)
      loadHistory()
    } catch (e) {
      console.error('YouTube pulse search failed:', e)
      setResults([])
    }
    setLoading(false)
  }

  const removeHistoryItem = async (id, e) => {
    e.stopPropagation()
    await deleteYouTubeSearchHistoryItem(id)
    loadHistory()
  }

  const clearAllHistory = async () => {
    if (!window.confirm('Clear all search history?')) return
    await clearYouTubeSearchHistory(userId)
    loadHistory()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 0 }}>←</button>
        )}
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          ▶️ YouTube
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder="Search videos…"
          style={{ flex: 1, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 16px', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit' }}
        />
        <button onClick={() => runSearch()} disabled={loading} style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 13.5, fontWeight: 700, padding: '11px 18px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {loading ? '…' : 'Search'}
        </button>
      </div>

      {!searched && history.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}>Recent searches</div>
            <button onClick={clearAllHistory} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Clear all
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => runSearch(h.query)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 10,
                  padding: '9px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🕐 {h.query}
                </span>
                <span onClick={(e) => removeHistoryItem(h.id, e)} style={{ color: 'var(--text-muted)', fontSize: 13, padding: '2px 6px' }}>✕</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 30 }}>Searching…</div>}

      {!loading && searched && results.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 30 }}>No results found.</div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {results.map((r) => (
            <VideoGridCard key={r.videoId} video={r} onSelect={onSelectVideo} />
          ))}
        </div>
      )}

      {!searched && history.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 30 }}>
          Search for videos to get started.
        </div>
      )}
    </div>
  )
}
