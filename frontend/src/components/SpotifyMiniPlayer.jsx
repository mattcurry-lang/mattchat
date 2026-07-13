import React, { useState, useRef, useCallback } from 'react'
import { useSpotify } from '../hooks/useSpotify'
import { connectSpotify } from '../lib/supabase'

let searchDebounceTimer = null

export default function SpotifyMiniPlayer({ session }) {
  const { checked, connected, product, currentTrack, isPlaying, playTrack, togglePlay, getFreshToken } = useSpotify(session)
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const inputRef = useRef(null)

  const runSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const token = await getFreshToken()
      if (!token) { setResults([]); return }
      const res = await fetch(`https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setResults((data.tracks?.items || []).map(t => ({
        id: t.id,
        uri: t.uri,
        name: t.name,
        artists: t.artists.map(a => a.name).join(', '),
        image: t.album?.images?.[t.album.images.length - 1]?.url,
        preview_url: t.preview_url,
      })))
    } catch (e) {
      console.error('Spotify search failed:', e)
    }
    setSearching(false)
  }, [getFreshToken])

  const handleQueryChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => runSearch(val), 350)
  }

  const handleConnect = async () => {
    setConnecting(true)
    try { await connectSpotify(session) } catch (err) { alert(err.message); setConnecting(false) }
  }

  if (!checked) return null

  if (!connected) {
    return (
      <button style={s.connectBar} onClick={handleConnect} disabled={connecting}>
        <span style={s.spotifyDot} />
        {connecting ? 'Connecting…' : 'Connect Spotify to play music in Mattchat'}
      </button>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={s.barRow}>
        <button style={s.iconBtn} onClick={() => { setExpanded(v => !v); setTimeout(() => inputRef.current?.focus(), 50) }} title="Search music">
          <span style={s.spotifyDot} />
        </button>

        {expanded ? (
          <input
            ref={inputRef}
            value={query}
            onChange={handleQueryChange}
            placeholder="Search a song…"
            style={s.searchInput}
            onBlur={() => { if (!query) setExpanded(false) }}
          />
        ) : currentTrack ? (
          <div style={s.nowPlaying} onClick={() => setExpanded(true)}>
            {currentTrack.image && <img src={currentTrack.image} alt="" style={s.nowPlayingArt} />}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={s.nowPlayingName}>{currentTrack.name}</div>
              <div style={s.nowPlayingArtist}>{currentTrack.artists}{currentTrack.isPreview ? ' · 30s preview' : ''}</div>
            </div>
            <button
              style={s.playPauseBtn}
              onClick={(e) => { e.stopPropagation(); togglePlay() }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
          </div>
        ) : (
          <button style={s.placeholderBtn} onClick={() => { setExpanded(true); setTimeout(() => inputRef.current?.focus(), 50) }}>
            Search a song to play{product === 'free' ? ' (30s previews)' : ''}…
          </button>
        )}
      </div>

      {expanded && query && (
        <div style={s.results}>
          {searching && <div style={s.resultsEmpty}>Searching…</div>}
          {!searching && results.length === 0 && <div style={s.resultsEmpty}>No matches.</div>}
          {results.map(track => (
            <button
              key={track.id}
              style={s.resultRow}
              onClick={() => { playTrack(track); setExpanded(false); setQuery(''); setResults([]) }}
              disabled={product !== 'premium' && !track.preview_url}
            >
              {track.image && <img src={track.image} alt="" style={s.resultArt} />}
              <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <div style={s.resultName}>{track.name}</div>
                <div style={s.resultArtist}>{track.artists}</div>
              </div>
              {product !== 'premium' && !track.preview_url && <span style={s.noPreview}>No preview</span>}
              <span style={s.playIcon}>▶</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  connectBar: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
    background: 'rgba(29,185,84,0.1)', border: 'none', borderBottom: '1px solid rgba(29,185,84,0.25)',
    color: '#1db954', fontSize: 12.5, fontWeight: 700, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit',
  },
  wrap: { position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  barRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px' },
  iconBtn: {
    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
    background: 'rgba(29,185,84,0.12)', border: '1px solid rgba(29,185,84,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  spotifyDot: { width: 12, height: 12, borderRadius: '50%', background: '#1db954', display: 'block' },
  searchInput: {
    flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 20, padding: '6px 12px', fontSize: 13, color: '#fff', fontFamily: 'inherit', outline: 'none',
  },
  placeholderBtn: {
    flex: 1, textAlign: 'left', background: 'none', border: 'none', color: '#9ca3af',
    fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0',
  },
  nowPlaying: { flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: 'pointer' },
  nowPlayingArt: { width: 26, height: 26, borderRadius: 5, flexShrink: 0, objectFit: 'cover' },
  nowPlayingName: { fontSize: 12.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  nowPlayingArtist: { fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  playPauseBtn: {
    width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: '#1db954', border: 'none',
    color: '#000', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  results: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, maxHeight: 320, overflowY: 'auto',
    background: '#1c1830', border: '1px solid rgba(255,255,255,0.1)', borderTop: 'none',
    boxShadow: '0 12px 28px rgba(0,0,0,0.4)',
  },
  resultsEmpty: { padding: '12px 14px', fontSize: 12.5, color: '#9ca3af' },
  resultRow: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
    background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
  },
  resultArt: { width: 32, height: 32, borderRadius: 5, flexShrink: 0, objectFit: 'cover' },
  resultName: { fontSize: 12.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  resultArtist: { fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  noPreview: { fontSize: 9.5, color: '#f87171', fontWeight: 700, flexShrink: 0 },
  playIcon: { fontSize: 11, color: '#1db954', flexShrink: 0 },
}
