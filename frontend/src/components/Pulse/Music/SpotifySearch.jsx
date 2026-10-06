import React, { useEffect, useRef, useState } from 'react'
import { MusicService } from '../../../lib/music/MusicService'
import { OfflineCache } from '../../../lib/music/OfflineCache'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { useOnlineStatus } from '../../../hooks/useOnlineStatus'
import { IconSearch, IconX, IconPlay, IconPause, IconMusic } from '../../Icons'
import TrackDownloadAction from './TrackDownloadAction'

// ── recent searches ───────────────────────────────────────
const RECENTS_KEY = 'mattchat:music:recentSearches'
export const loadRecents = () => { try { return JSON.parse(localStorage.getItem(RECENTS_KEY)) || [] } catch { return [] } }
const writeRecents = (list) => { try { localStorage.setItem(RECENTS_KEY, JSON.stringify(list)) } catch {} return list }
export const saveRecent = (q) => {
  const t = (q || '').trim()
  if (!t) return loadRecents()
  return writeRecents([t, ...loadRecents().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8))
}
export const removeRecent = (q) => writeRecents(loadRecents().filter((x) => x !== q))
export const clearRecents = () => writeRecents([])

// ── helpers ───────────────────────────────────────────────
const norm = (s) => (s || '').toLowerCase().trim()

const fmt = (sec) => {
  if (!Number.isFinite(sec) || sec <= 0) return ''
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

function sourceBadge(t) {
  if (t.provider === 'mattchat') return { label: 'MATTCHAT ARTIST', color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' }
  if (t.provider === 'youtube') return { label: 'MAINSTREAM', color: '#f87171', bg: 'rgba(248,113,113,0.14)' }
  if (t.provider === 'jamendo' || t.provider === 'audius')
    return { label: t.isDownloadable ? 'FREE · DOWNLOADABLE' : 'FREE', color: '#4ade80', bg: 'rgba(74,222,128,0.14)' }
  return null
}

function Badge({ track }) {
  const b = sourceBadge(track)
  if (!b) return null
  return (
    <span style={{ fontSize: 9, fontWeight: 800, color: b.color, background: b.bg, borderRadius: 4, padding: '1px 5px', letterSpacing: 0.3, flexShrink: 0 }}>
      {b.label}
    </span>
  )
}

function pickTop(tracks, q) {
  if (!tracks.length) return null
  const n = norm(q)
  return tracks.find((t) => norm(t.title) === n)
    || tracks.find((t) => norm(t.artist) === n || norm(t.title).startsWith(n))
    || tracks[0]
}

// ── top-bar pieces ────────────────────────────────────────
export function HomeButton({ onClick, colors }) {
  return (
    <button onClick={onClick} aria-label="Home" title="Home"
      style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.textPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-6h4v6h5V9.5" />
      </svg>
    </button>
  )
}

export function SearchBar({ value, onChange, onFocus, onBlur, onClear, onSubmit, inputRef, colors }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, height: 40, padding: '0 14px', borderRadius: 999, background: colors.surface2, border: `1px solid ${colors.border}` }}>
      <IconSearch size={16} style={{ color: colors.textMuted, flexShrink: 0 }} />
      <input
        ref={inputRef}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onSubmit?.(); e.currentTarget.blur() }
          if (e.key === 'Escape') { onClear?.(); e.currentTarget.blur() }
        }}
        placeholder="What do you want to play?"
        aria-label="Search music"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: colors.textPrimary, fontSize: 14, fontFamily: 'inherit' }}
      />
      {value && (
        <button onClick={onClear} onMouseDown={(e) => e.preventDefault()} aria-label="Clear search"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, display: 'flex', padding: 2 }}>
          <IconX size={15} />
        </button>
      )}
    </div>
  )
}

// ── result pieces ─────────────────────────────────────────
function SectionTitle({ children, colors }) {
  return <h3 style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary, margin: '0 0 10px', letterSpacing: -0.3 }}>{children}</h3>
}

function SongRow({ track, queue, colors, onPlayed }) {
  const { currentTrack, isPlaying, playTrack } = useMusicPlayer()
  const [hover, setHover] = useState(false)
  const isCurrent = currentTrack?.id === track.id
  const dur = fmt(track.duration)

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px', borderRadius: 8, background: hover ? 'rgba(255,255,255,0.07)' : 'transparent' }}
    >
      {/* the download menu stays a sibling of this button, so tapping it never starts playback */}
      <button
        onClick={() => { playTrack(track, queue); onPlayed?.() }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, padding: '6px 4px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {track.artwork ? <img src={track.artwork} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={18} style={{ color: colors.textMuted }} />}
          {(hover || isCurrent) && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              {isCurrent && isPlaying ? <IconPause size={16} /> : <IconPlay size={16} />}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: isCurrent ? '#a78bfa' : colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: colors.textMuted, minWidth: 0 }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</span>
            <Badge track={track} />
          </div>
        </div>
        {dur && <span style={{ fontSize: 12, color: colors.textMuted, flexShrink: 0, paddingRight: 4 }}>{dur}</span>}
      </button>
      <TrackDownloadAction track={track} size={16} />
    </div>
  )
}

function TopResult({ track, queue, colors, isMobile, onPlayed }) {
  const { currentTrack, isPlaying, playTrack } = useMusicPlayer()
  const [hover, setHover] = useState(false)
  const isCurrent = currentTrack?.id === track.id
  return (
    <button
      onClick={() => { playTrack(track, queue); onPlayed?.() }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, width: '100%', padding: 20, border: 'none', borderRadius: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', background: hover ? 'rgba(255,255,255,0.09)' : colors.surface2, transition: 'background 0.15s' }}
    >
      <div style={{ width: 92, height: 92, borderRadius: 8, overflow: 'hidden', background: colors.surface1, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
        {track.artwork ? <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={30} style={{ color: colors.textMuted }} />}
      </div>
      <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.5, lineHeight: 1.15, maxWidth: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {track.title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: colors.textMuted }}>
        {track.artist}<Badge track={track} />
      </div>
      <div style={{ position: 'absolute', right: 16, bottom: 16, width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(108,99,255,0.45)', opacity: hover || isCurrent ? 1 : 0, transform: hover || isCurrent ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 0.2s, transform 0.2s' }}>
        {isCurrent && isPlaying ? <IconPause size={18} /> : <IconPlay size={18} />}
      </div>
    </button>
  )
}

function ArtistCard({ artist, colors, isMobile, onPick }) {
  const [hover, setHover] = useState(false)
  const size = isMobile ? 96 : 128
  return (
    <button
      onClick={() => onPick(artist.name)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ width: size + 24, flexShrink: 0, padding: 12, border: 'none', borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', background: hover ? 'rgba(255,255,255,0.07)' : 'transparent' }}
    >
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, boxShadow: '0 8px 20px rgba(0,0,0,0.35)' }}>
        {artist.avatar ? <img src={artist.avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={26} style={{ color: colors.textMuted }} />}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artist.name}</div>
      <div style={{ fontSize: 12, color: colors.textMuted }}>Artist</div>
    </button>
  )
}

function SkeletonRows({ colors }) {
  return (
    <div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 6, background: colors.surface2 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ width: '45%', height: 11, borderRadius: 4, background: colors.surface2 }} />
            <div style={{ width: '25%', height: 10, borderRadius: 4, background: colors.surface2 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Recents({ recents, colors, isMobile, onPick, onRemove, onClear }) {
  return (
    <div onMouseDown={(e) => e.preventDefault()} style={{ padding: isMobile ? '14px 14px 100px' : '20px 24px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <SectionTitle colors={colors}>Recent searches</SectionTitle>
        <button onClick={onClear} style={{ background: 'transparent', border: 'none', color: colors.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Clear all</button>
      </div>
      {recents.map((r) => (
        <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => onPick(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, padding: '10px 6px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: colors.textPrimary, fontSize: 14, fontWeight: 600 }}>
            <IconSearch size={15} style={{ color: colors.textMuted, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r}</span>
          </button>
          <button onClick={() => onRemove(r)} aria-label={`Remove ${r}`} style={{ background: 'transparent', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: 8, display: 'flex' }}>
            <IconX size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── the results screen ────────────────────────────────────
export function SearchResultsView({ query, colors, isMobile, recents, onRecentsChange, onPickQuery, onPlayed }) {
  const online = useOnlineStatus()
  const [data, setData] = useState({ tracks: [], artists: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // all | songs | artists
  const [retryKey, setRetryKey] = useState(0)
  const reqRef = useRef(0)
  const q = query.trim()

  useEffect(() => {
    if (!q) { setData({ tracks: [], artists: [] }); setLoading(false); setError(null); return }
    const id = ++reqRef.current
    setLoading(true)

    // Offline: search the songs saved inside Mattchat instead
    if (!online) {
      let alive = true
      OfflineCache.listDownloads()
        .then((d) => {
          if (!alive || id !== reqRef.current) return
          const n = norm(q)
          const tracks = d.map((x) => x.track).filter(Boolean)
            .filter((t) => norm(t.title).includes(n) || norm(t.artist).includes(n))
          setData({ tracks, artists: [] }); setError(null); setLoading(false)
        })
        .catch(() => { if (alive && id === reqRef.current) { setData({ tracks: [], artists: [] }); setLoading(false) } })
      return () => { alive = false }
    }

    const t = setTimeout(async () => {
      try {
        const res = await MusicService.search(q, { limit: 15 })
        if (id !== reqRef.current) return // a newer search already replaced this one
        setData({ tracks: res.tracks || [], artists: res.artists || [] })
        setError(null)
      } catch {
        if (id === reqRef.current) setError('Music is temporarily unavailable.')
      } finally {
        if (id === reqRef.current) setLoading(false)
      }
    }, 320)
    return () => clearTimeout(t)
  }, [q, online, retryKey])

  if (!q) {
    return (
      <Recents
        recents={recents} colors={colors} isMobile={isMobile}
        onPick={onPickQuery}
        onRemove={(r) => onRecentsChange(removeRecent(r))}
        onClear={() => onRecentsChange(clearRecents())}
      />
    )
  }

  const { tracks, artists } = data
  const hasResults = tracks.length > 0 || artists.length > 0
  const top = pickTop(tracks, q)
  const others = tracks.filter((t) => t.id !== top?.id)
  const firstFour = others.slice(0, 4)
  const rest = others.slice(4, 14)

  const chip = (id, label) => (
    <button key={id} onClick={() => setFilter(id)}
      style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: filter === id ? '#0f0f1a' : colors.textPrimary, background: filter === id ? '#fff' : colors.surface2 }}>
      {label}
    </button>
  )

  return (
    <div style={{ padding: isMobile ? '14px 14px 100px' : '20px 24px 40px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto' }}>
        {chip('all', 'All')}{chip('songs', 'Songs')}{chip('artists', 'Artists')}
      </div>

      {!online && (
        <div style={{ marginBottom: 14, padding: '9px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: colors.textPrimary, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.28)' }}>
          You're offline. Showing songs saved in Mattchat.
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#f87171', marginBottom: 14 }}>
          {error}
          <button onClick={() => setRetryKey((k) => k + 1)} style={{ background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 999, color: colors.textPrimary, fontSize: 12, fontWeight: 700, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      {loading && !hasResults && <SkeletonRows colors={colors} />}

      {!loading && !error && !hasResults && (
        <div style={{ textAlign: 'center', padding: '48px 12px' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary, marginBottom: 6 }}>No results found for "{q}"</div>
          <div style={{ fontSize: 13, color: colors.textMuted }}>
            {online ? 'Check the spelling, or try fewer or different words.' : 'No saved songs match. Search needs internet for everything else.'}
          </div>
        </div>
      )}

      {hasResults && (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          {filter === 'all' && (
            <>
              {top && (
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 20 : 24, marginBottom: 28 }}>
                  <div style={{ flex: isMobile ? '1 1 auto' : '0 0 340px', minWidth: 0 }}>
                    <SectionTitle colors={colors}>Top result</SectionTitle>
                    <TopResult track={top} queue={tracks} colors={colors} isMobile={isMobile} onPlayed={onPlayed} />
                  </div>
                  {firstFour.length > 0 && (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <SectionTitle colors={colors}>Songs</SectionTitle>
                      {firstFour.map((t) => <SongRow key={t.id} track={t} queue={tracks} colors={colors} onPlayed={onPlayed} />)}
                    </div>
                  )}
                </div>
              )}

              {artists.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <SectionTitle colors={colors}>Artists</SectionTitle>
                  <div style={{ display: 'flex', gap: 4, overflowX: 'auto', margin: '0 -12px', padding: '0 0 4px' }}>
                    {artists.map((a) => <ArtistCard key={a.id} artist={a} colors={colors} isMobile={isMobile} onPick={onPickQuery} />)}
                  </div>
                </div>
              )}

              {rest.length > 0 && (
                <div>
                  <SectionTitle colors={colors}>More songs</SectionTitle>
                  {rest.map((t) => <SongRow key={t.id} track={t} queue={tracks} colors={colors} onPlayed={onPlayed} />)}
                </div>
              )}
            </>
          )}

          {filter === 'songs' && tracks.map((t) => <SongRow key={t.id} track={t} queue={tracks} colors={colors} onPlayed={onPlayed} />)}

          {filter === 'artists' && (
            artists.length > 0
              ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{artists.map((a) => <ArtistCard key={a.id} artist={a} colors={colors} isMobile={isMobile} onPick={onPickQuery} />)}</div>
              : <div style={{ fontSize: 13, color: colors.textMuted, padding: '24px 4px' }}>No artists found for "{q}".</div>
          )}
        </div>
      )}
    </div>
  )
}
