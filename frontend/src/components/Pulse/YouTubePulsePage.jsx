// src/components/Pulse/YouTubePulsePage.jsx
// The YouTube page inside Pulse: search, recent searches, and a result grid.
//
// Same props and behaviour as before (search, save/delete/clear history, tap a video to
// open it). New: real thumbnails with a glow, a featured first result, loading skeletons,
// "Show more", clear error and empty states, and a palette that stays readable on your
// dark background (the old page used a dark-grey text colour on a dark panel).
//
// Duration / views / date show automatically IF your youtube-search function returns them
// (video.duration, video.viewCount, video.publishedAt). They are optional.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { searchYouTube, saveYouTubeSearch, listYouTubeSearchHistory, deleteYouTubeSearchHistoryItem, clearYouTubeSearchHistory } from '../../lib/supabase'
import { useYouTubeThumb } from '../../hooks/useYouTubeThumb'
import { baseThumbUrl, fallbackThumbUrl, formatDuration, formatViews, timeAgo, avatarGradient, initialOf, decodeEntities } from '../../lib/youtubeThumb'
import { ensureYouTubeStyles } from '../youtube/youtubeStyles'
import { PlayIcon, SearchIcon, CloseIcon, ClockIcon, BackIcon, FilmIcon } from '../youtube/ytIcons'

ensureYouTubeStyles()

const STARTERS = ['Lo-fi study beats', 'Football highlights', 'Programming tutorials', 'Kenya news today']

function VideoCard({ video, onSelect, featured }) {
  const hd = useYouTubeThumb(video.videoId, { upgrade: featured })
  const [broken, setBroken] = useState(false)
  const title = decodeEntities(video.title)
  const channel = decodeEntities(video.channelTitle)
  const src = featured ? hd.src : (broken ? fallbackThumbUrl(video.videoId) : (video.thumbnailUrl || baseThumbUrl(video.videoId)))
  const duration = formatDuration(video.duration)
  const stats = [formatViews(video.viewCount), timeAgo(video.publishedAt)].filter(Boolean).join(' · ')

  return (
    <button
      type="button"
      className={`mc-ytp-card${featured ? ' mc-ytp-card--hero' : ''}`}
      onClick={() => onSelect?.(video.videoId)}
      aria-label={`Play ${title}${channel ? ` by ${channel}` : ''}`}
    >
      {featured && src && <span className="mc-ytp-glow" aria-hidden="true" style={{ backgroundImage: `url(${src})` }} />}
      <span className="mc-ytp-thumb">
        {src && <img className="mc-yt-img" src={src} alt="" loading={featured ? 'eager' : 'lazy'} decoding="async" onError={() => setBroken(true)} />}
        <span className="mc-yt-scrim" />
        {duration && <span className="mc-yt-dur">{duration}</span>}
        <span className="mc-yt-play"><PlayIcon size={22} /></span>
      </span>
      <span className="mc-ytp-meta">
        <span className="mc-yt-avatar" aria-hidden="true" style={{ background: avatarGradient(channel), width: 32, height: 32, fontSize: 13 }}>{initialOf(channel)}</span>
        <span className="mc-ytp-info">
          <span className="mc-ytp-name">{title}</span>
          <span className="mc-ytp-ch">{channel}</span>
          {stats && <span className="mc-ytp-stats">{stats}</span>}
        </span>
      </span>
    </button>
  )
}

function SkeletonCard() {
  return (
    <div className="mc-ytp-card" aria-hidden="true">
      <div className="mc-ytp-thumb mc-yt-skel" style={{ borderRadius: 14 }} />
      <div className="mc-ytp-meta">
        <div className="mc-yt-skel" style={{ width: 32, height: 32, borderRadius: '50%', flex: 'none' }} />
        <div style={{ flex: 1 }}>
          <div className="mc-yt-skel" style={{ height: 13, width: '90%' }} />
          <div className="mc-yt-skel" style={{ height: 13, width: '60%', marginTop: 7 }} />
        </div>
      </div>
    </div>
  )
}

// modal: set when shown as a pop-up (the chat's "Search YouTube"): focuses the search box, shows a close (X)
// instead of a back arrow, and puts it on the right. subtitle: optional line under the title.
export default function YouTubePulsePage({ session, userId, onSelectVideo, onClose, modal = false, subtitle }) {
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')                 // what the visible results are for
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')         // idle | loading | ready | error
  const [nextToken, setNextToken] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [history, setHistory] = useState([])
  const requestId = useRef(0)                          // so a slow old search can't overwrite a newer one

  const loadHistory = useCallback(() => {
    listYouTubeSearchHistory(userId).then(setHistory).catch(console.error)
  }, [userId])

  useEffect(() => { loadHistory() }, [loadHistory])

  const runSearch = async (q) => {
    const text = (q ?? query).trim()
    if (!text) return
    const id = ++requestId.current
    setQuery(text)
    setTerm(text)
    setStatus('loading')
    setNextToken(null)
    try {
      const res = await searchYouTube(session, text)
      if (id !== requestId.current) return
      if (res && res.ok) {
        setResults(res.results || [])
        setNextToken(res.nextPageToken || res.next_page_token || null)
        setStatus('ready')
      } else {
        setResults([])
        setStatus('error')
      }
    } catch (e) {
      console.error('YouTube pulse search failed:', e)
      if (id !== requestId.current) return
      setResults([])
      setStatus('error')
    }
    // Saving history must never cost you the results you just found.
    Promise.resolve(saveYouTubeSearch(userId, text)).then(loadHistory).catch((e) => console.error('Saving search history failed:', e))
  }

  const loadMore = async () => {
    if (!nextToken || loadingMore) return
    const id = requestId.current
    setLoadingMore(true)
    try {
      const res = await searchYouTube(session, term, nextToken)
      if (id !== requestId.current) return
      if (res && res.ok) {
        setResults((prev) => {
          const seen = new Set(prev.map((v) => v.videoId))
          return prev.concat((res.results || []).filter((v) => !seen.has(v.videoId)))
        })
        setNextToken(res.nextPageToken || res.next_page_token || null)
      }
    } catch (e) {
      console.error('Loading more videos failed:', e)
    }
    setLoadingMore(false)
  }

  const clearSearch = () => {
    requestId.current++
    setQuery('')
    setTerm('')
    setResults([])
    setNextToken(null)
    setStatus('idle')
  }

  const removeHistoryItem = async (id) => {
    await deleteYouTubeSearchHistoryItem(id)
    loadHistory()
  }

  const clearAllHistory = async () => {
    if (!window.confirm('Clear all search history?')) return
    await clearYouTubeSearchHistory(userId)
    loadHistory()
  }

  const showHistory = status === 'idle' && history.length > 0

  return (
    <div className="mc-yt mc-ytp">
      <div className={`mc-ytp-head${modal ? ' mc-ytp-head--modal' : ''}`}>
        {onClose && (
          <button type="button" className="mc-ytp-back" onClick={onClose} aria-label={modal ? 'Close' : 'Back'}>{modal ? <CloseIcon size={18} /> : <BackIcon />}</button>
        )}
        <div>
          <h2 className="mc-ytp-title">YouTube</h2>
          <p className="mc-ytp-sub">{subtitle || 'Find something to watch or share'}</p>
        </div>
      </div>

      <form className="mc-ytp-search" role="search" onSubmit={(e) => { e.preventDefault(); runSearch() }}>
        <SearchIcon />
        <input
          value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search videos…"
          aria-label="Search videos" enterKeyHint="search" autoComplete="off" autoFocus={modal}
        />
        {query && (
          <button type="button" className="mc-ytp-clear" onClick={clearSearch} aria-label="Clear search"><CloseIcon /></button>
        )}
        <button type="submit" className="mc-ytp-go" disabled={status === 'loading' || !query.trim()}>
          {status === 'loading' ? 'Searching…' : 'Search'}
        </button>
      </form>

      {showHistory && (
        <div>
          <div className="mc-ytp-subhead">
            <span>Recent searches</span>
            <button type="button" className="mc-ytp-text" onClick={clearAllHistory}>Clear all</button>
          </div>
          <div className="mc-ytp-chips">
            {history.map((h) => (
              <span key={h.id} className="mc-ytp-chip">
                <button type="button" onClick={() => runSearch(h.query)}><ClockIcon /> {h.query}</button>
                <button type="button" className="x" onClick={() => removeHistoryItem(h.id)} aria-label={`Remove ${h.query} from recent searches`}><CloseIcon size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {status === 'idle' && history.length === 0 && (
        <div className="mc-ytp-empty">
          <div className="ico"><FilmIcon /></div>
          <div>Search for videos to get started.</div>
          <div className="mc-ytp-chips" style={{ justifyContent: 'center' }}>
            {STARTERS.map((s) => (
              <span key={s} className="mc-ytp-chip" style={{ paddingRight: 12 }}>
                <button type="button" onClick={() => runSearch(s)}>{s}</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {status === 'loading' && (
        <div className="mc-ytp-results" aria-busy="true" aria-label="Searching">
          <div className="mc-ytp-grid">{[0, 1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}</div>
        </div>
      )}

      {status === 'error' && (
        <div className="mc-ytp-empty" role="alert">
          <div className="ico"><FilmIcon /></div>
          <div>Couldn’t reach YouTube right now.</div>
          <button type="button" className="mc-yt-btn mc-yt-btn--primary" onClick={() => runSearch(term)}>Try again</button>
        </div>
      )}

      {status === 'ready' && results.length === 0 && (
        <div className="mc-ytp-empty">
          <div className="ico"><SearchIcon size={26} /></div>
          <div>No videos found for “{term}”.</div>
          <div style={{ fontSize: 13, color: 'var(--yt-text3)' }}>Try different words or check the spelling.</div>
        </div>
      )}

      {status === 'ready' && results.length > 0 && (
        <div className="mc-ytp-results">
          <div className="mc-ytp-grid">
            {results.map((r, i) => (
              <VideoCard key={r.videoId} video={r} onSelect={onSelectVideo} featured={i === 0 && results.length >= 3} />
            ))}
          </div>
          {nextToken && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button type="button" className="mc-yt-btn mc-ytp-more" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Show more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
