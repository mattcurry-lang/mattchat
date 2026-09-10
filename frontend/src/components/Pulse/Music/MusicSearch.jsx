import React, { useState, useEffect, useRef } from 'react'
import { MusicService } from '../../../lib/music/MusicService'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { IconSearch, IconPlay, IconPause, IconMusic } from '../../Icons'
import DownloadButton from './DownloadButton'
import { useMusicColors } from '../../../hooks/useMusicColors'

const DEBOUNCE_MS = 320

function TrackSkeletonRow({ colors }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px' }}>
      <div style={{ width: 44, height: 44, borderRadius: 8, background: colors.surface2 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ width: '55%', height: 11, borderRadius: 4, background: colors.surface2 }} />
        <div style={{ width: '35%', height: 10, borderRadius: 4, background: colors.surface2 }} />
      </div>
    </div>
  )
}

function TrackRow({ track, onPlay, isCurrent, isPlaying, colors }) {
  const canDownload = track.provider === 'mattchat' && track.isDownloadable
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={() => onPlay(track)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none',
          padding: '8px 4px', flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
          borderRadius: 10,
        }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {track.artwork ? (
            <img src={track.artwork} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <IconMusic size={18} style={{ color: colors.textMuted }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: isCurrent ? '#a78bfa' : colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {track.title}
          </div>
          <div style={{ fontSize: 11.5, color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 5 }}>
            {track.artist}
            {track.provider === 'mattchat' && (
              <span style={{ fontSize: 9, fontWeight: 800, color: '#a78bfa', background: 'rgba(167,139,250,0.14)', borderRadius: 4, padding: '1px 5px', letterSpacing: 0.3 }}>
                MATTCHAT ARTIST
              </span>
            )}
            {track.provider === 'youtube' && (
              <span style={{ fontSize: 9, fontWeight: 800, color: '#f87171', background: 'rgba(248,113,113,0.14)', borderRadius: 4, padding: '1px 5px', letterSpacing: 0.3 }}>
                MAINSTREAM
              </span>
            )}
          </div>
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: isCurrent ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : colors.surface2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: isCurrent ? '#fff' : colors.textSecondary,
        }}>
          {isCurrent && isPlaying ? <IconPause size={13} /> : <IconPlay size={13} />}
        </div>
      </button>
      {canDownload && <DownloadButton track={track} size={16} />}
    </div>
  )
}

export default function MusicSearch({ autoFocus = false }) {
  const colors = useMusicColors()
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '10px 12px' }}>
        <IconSearch size={16} style={{ color: colors.textMuted, flexShrink: 0 }} />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs or artists…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: colors.textPrimary, fontSize: 13.5, fontFamily: 'inherit' }}
        />
      </div>

      {searchError && <div style={{ fontSize: 12, color: '#f87171', padding: '4px 4px' }}>{searchError}</div>}

      {isSearching && (
        <div>
          <TrackSkeletonRow colors={colors} /><TrackSkeletonRow colors={colors} /><TrackSkeletonRow colors={colors} />
        </div>
      )}

      {!isSearching && results.tracks.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, margin: '4px 4px 2px' }}>Songs</div>
          {results.tracks.map((track) => (
            <TrackRow key={track.id} track={track} onPlay={playTrack} isCurrent={currentTrack?.id === track.id} isPlaying={isPlaying} colors={colors} />
          ))}
        </div>
      )}

      {!isSearching && results.artists.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, margin: '10px 4px 2px' }}>Artists</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '2px 4px' }}>
            {results.artists.map((artist) => (
              <div key={artist.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, width: 64 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {artist.avatar ? (
                    <img src={artist.avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <IconMusic size={16} style={{ color: colors.textMuted }} />
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: colors.textSecondary, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {artist.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isSearching && query.trim() && !searchError && results.tracks.length === 0 && results.artists.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12.5, color: colors.textMuted }}>
          No results for "{query}"
        </div>
      )}
    </div>
  )
}
