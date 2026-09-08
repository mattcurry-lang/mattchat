import React, { useState, useEffect, useRef } from 'react'
import MusicService from '../../../lib/music/MusicService'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { IconSearch, IconPlay, IconPause, IconMusic } from '../../Icons'

const DEBOUNCE_MS = 320

function TrackSkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px' }}>
      <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-surface-2)' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ width: '55%', height: 11, borderRadius: 4, background: 'var(--bg-surface-2)' }} />
        <div style={{ width: '35%', height: 10, borderRadius: 4, background: 'var(--bg-surface-2)' }} />
      </div>
    </div>
  )
}

function TrackRow({ track, onPlay, isCurrent, isPlaying }) {
  return (
    <button
      onClick={() => onPlay(track)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none',
        padding: '8px 4px', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
        borderRadius: 10,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
        background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {track.artwork ? (
          <img src={track.artwork} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <IconMusic size={18} style={{ color: 'var(--text-muted)' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: isCurrent ? '#a78bfa' : 'var(--text-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {track.title}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {track.artist}
        </div>
      </div>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: isCurrent ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : 'var(--bg-surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: isCurrent ? '#fff' : 'var(--text-secondary)',
      }}>
        {isCurrent && isPlaying ? <IconPause size={13} /> : <IconPlay size={13} />}
      </div>
    </button>
  )
}

export default function MusicSearch({ autoFocus = false }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ tracks: [], artists: [] })
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const debounceRef = useRef(null)
  const { currentTrack, isPlaying, playTrack } = useMusicPlayer()

  useEffect(() => {
    clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults({ tracks: [], artists: [] })
      setIsSearching(false)
      setSearchError(null)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await MusicService.search(query, { limit: 15 })
        setResults(data)
        setSearchError(null)
      } catch {
        setSearchError('Music is temporarily unavailable.')
      } finally {
        setIsSearching(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface-2)',
        border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px',
      }}>
        <IconSearch size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs or artists…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'inherit',
          }}
        />
      </div>

      {searchError && (
        <div style={{ fontSize: 12, color: '#f87171', padding: '4px 4px' }}>{searchError}</div>
      )}

      {isSearching && (
        <div>
          <TrackSkeletonRow /><TrackSkeletonRow /><TrackSkeletonRow />
        </div>
      )}

      {!isSearching && results.tracks.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', margin: '4px 4px 2px' }}>Songs</div>
          {results.tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              onPlay={playTrack}
              isCurrent={currentTrack?.id === track.id}
              isPlaying={isPlaying}
            />
          ))}
        </div>
      )}

      {!isSearching && results.artists.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', margin: '10px 4px 2px' }}>Artists</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '2px 4px' }}>
            {results.artists.map((artist) => (
              <div key={artist.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, width: 64 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-surface-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {artist.avatar ? (
                    <img src={artist.avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <IconMusic size={16} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                <div style={{
                  fontSize: 10.5, color: 'var(--text-secondary)', textAlign: 'center',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%',
                }}>
                  {artist.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isSearching && query.trim() && !searchError && results.tracks.length === 0 && results.artists.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
          No results for "{query}"
        </div>
      )}
    </div>
  )
}
