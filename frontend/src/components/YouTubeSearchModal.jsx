import React, { useState } from 'react'
import { searchYouTube } from '../lib/supabase'
import { IconX, IconSearch } from './Icons'

export default function YouTubeSearchModal({ session, onClose, onSelectVideo }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const runSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await searchYouTube(session, query)
      setResults(res.ok ? res.results : [])
    } catch (e) {
      console.error('YouTube search failed:', e)
      setResults([])
    }
    setLoading(false)
  }

  return (
    <div className="profile-menu-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-surface-1, #14141f)', borderRadius: 20, padding: 0,
        width: 'min(640px, 94vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 0' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Search YouTube</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>
            <IconX size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '14px 20px' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Search videos…"
            autoFocus
            style={{ flex: 1, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'inherit' }}
          />
          <button onClick={runSearch} disabled={loading} style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, padding: '10px 16px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconSearch size={14} /> {loading ? '…' : 'Search'}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, padding: 20 }}>Searching…</div>}

          {!loading && searched && results.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, padding: 20 }}>No results found.</div>
          )}

          {results.map((r) => (
            <button
              key={r.videoId}
              onClick={() => onSelectVideo(r.videoId)}
              style={{
                display: 'flex', gap: 12, background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <img src={r.thumbnailUrl} alt={r.title} style={{ width: 120, height: 68, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {r.title}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>{r.channelTitle}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
