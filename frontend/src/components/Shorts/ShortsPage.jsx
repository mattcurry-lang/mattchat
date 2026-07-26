import React, { useState, useCallback, useRef, useEffect } from 'react'
import ShortsVideoCard from './ShortsVideoCard'
import ShortsCategoryBar from './ShortsCategoryBar'
import ShareShortModal from './ShareShortModal'
import { useShorts } from '../../hooks/useShorts'
import { saveShortsProgress, getShortsProgress, logShortsInteraction, toggleShortsLike } from '../../lib/shortsSupabase'

export default function ShortsPage({
  session, userId, conversations, getConvoName, onClose, initialVideoId, initialSearch,
}) {
  const [category, setCategory] = useState(initialSearch ? null : 'trending')
  const [searchInput, setSearchInput] = useState(initialSearch || '')
  const [activeSearch, setActiveSearch] = useState(initialSearch || '')
  const [showSearchBox, setShowSearchBox] = useState(false)
  const [muted, setMuted] = useState(true)
  const [shareTarget, setShareTarget] = useState(null)
  const [likedIds, setLikedIdsLocal] = useState(new Set())
  const startTimeRef = useRef(0)
  const containerRef = useRef(null)
  const jumpedToInitialRef = useRef(false)

  const {
    items, activeIndex, setActiveIndex, loading, loadingMore, error,
    windowStart, windowEnd, likedIds: hookLikedIds, setLikedIds, hasMore,
  } = useShorts(session, userId, {
    category: activeSearch ? null : category,
    query: activeSearch || null,
    forYou: category === 'forYou',
  })

  useEffect(() => { setLikedIdsLocal(hookLikedIds) }, [hookLikedIds])

  // Land directly on a shared video when opened from a chat preview
  useEffect(() => {
    if (jumpedToInitialRef.current || !initialVideoId || items.length === 0) return
    const idx = items.findIndex(v => v.videoId === initialVideoId)
    if (idx !== -1) {
      jumpedToInitialRef.current = true
      requestAnimationFrame(() => {
        containerRef.current?.children[idx]?.scrollIntoView({ behavior: 'instant' })
      })
    }
  }, [items, initialVideoId])

  // IntersectionObserver drives which card is "active" — this is what
  // makes autoplay/pause track the swipe instead of the scroll event.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          const idx = Number(entry.target.dataset.index)
          setActiveIndex((prev) => {
            if (idx !== prev) {
              startTimeRef.current = 0
              const prevVideo = items[prev]
              if (prevVideo) logShortsInteraction(userId, prevVideo, startTimeRef.current, { skipped: true })
            }
            return idx
          })
        }
      })
    }, { root: container, threshold: [0.6] })
    Array.from(container.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [items.length]) // eslint-disable-line

  const [resumePosition, setResumePosition] = useState(0)
  useEffect(() => {
    const video = items[activeIndex]
    if (!video) return
    getShortsProgress(userId, video.videoId).then(setResumePosition)
  }, [activeIndex, items, userId])

  const handleProgress = useCallback((seconds) => {
    startTimeRef.current = seconds
    const video = items[activeIndex]
    if (video) saveShortsProgress(userId, video, seconds)
  }, [activeIndex, items, userId])

  const handleEnded = useCallback(() => {
    const video = items[activeIndex]
    if (video) logShortsInteraction(userId, video, video.durationSeconds, { skipped: false })
  }, [activeIndex, items])

  const handleToggleLike = useCallback(async (video) => {
    const isLiked = likedIds.has(video.videoId)
    const nowLiked = await toggleShortsLike(userId, video.videoId, isLiked)
    setLikedIds(prev => {
      const next = new Set(prev)
      nowLiked ? next.add(video.videoId) : next.delete(video.videoId)
      return next
    })
    if (nowLiked) logShortsInteraction(userId, video, startTimeRef.current, { liked: true })
  }, [likedIds, userId, setLikedIds])

  const runSearch = () => {
    if (!searchInput.trim()) return
    setActiveSearch(searchInput.trim())
    setCategory(null)
    setShowSearchBox(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: '#000' }}>
      {/* Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6, display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 4px' }}>
        <button onClick={onClose} style={headerBtnStyle}>←</button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#fff' }}>Shorts</div>
        <button onClick={() => setShowSearchBox(v => !v)} style={headerBtnStyle}>🔍</button>
      </div>

      {showSearchBox ? (
        <div style={{ position: 'absolute', top: 56, left: 16, right: 16, zIndex: 6, display: 'flex', gap: 8 }}>
          <input
            autoFocus value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Search topics, creators…"
            style={{ flex: 1, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: '9px 14px', color: '#fff', fontSize: 13.5, fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}
          />
          <button onClick={runSearch} style={{ ...headerBtnStyle, width: 'auto', padding: '0 14px' }}>Go</button>
        </div>
      ) : (
        <ShortsCategoryBar
          active={activeSearch ? null : category}
          onChange={(c) => { setCategory(c); setActiveSearch('') }}
        />
      )}

      {activeSearch && (
        <div style={{ position: 'absolute', top: 12, left: 16, zIndex: 6, background: 'rgba(255,255,255,0.95)', color: '#0f0f1a', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          "{activeSearch}" <span onClick={() => { setActiveSearch(''); setCategory('trending') }} style={{ cursor: 'pointer' }}>✕</span>
        </div>
      )}

      {loading && items.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          Loading Shorts…
        </div>
      )}

      {!loading && error && items.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 13, padding: 24, textAlign: 'center' }}>
          Couldn't load Shorts right now.
        </div>
      )}

      <div
        ref={containerRef}
        style={{ height: '100dvh', overflowY: 'scroll', scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((video, i) => {
          const isMounted = i >= windowStart && i < windowEnd
          const isActive = i === activeIndex
          return (
            <div key={video.videoId} data-index={i} style={{ scrollSnapAlign: 'start' }}>
              <ShortsVideoCard
                video={video}
                isActive={isActive}
                isMounted={isMounted}
                muted={muted}
                onToggleMute={() => setMuted(m => !m)}
                startPosition={isActive ? resumePosition : 0}
                onProgress={isActive ? handleProgress : undefined}
                onEnded={isActive ? handleEnded : undefined}
                liked={likedIds.has(video.videoId)}
                onToggleLike={() => handleToggleLike(video)}
                onOpenShare={() => setShareTarget(video)}
              />
            </div>
          )
        })}
        {loadingMore && (
          <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
            Loading more…
          </div>
        )}
      </div>

      {shareTarget && (
        <ShareShortModal
          video={shareTarget}
          conversations={conversations}
          getConvoName={getConvoName}
          currentUserId={userId}
          onClose={() => setShareTarget(null)}
          onShared={() => {}}
        />
      )}
    </div>
  )
}

const headerBtnStyle = {
  background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%',
  width: 34, height: 34, color: '#fff', fontSize: 15, cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
