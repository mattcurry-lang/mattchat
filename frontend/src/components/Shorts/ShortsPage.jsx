import React, { useState, useCallback, useRef, useEffect } from 'react'
import ShortsVideoCard from './ShortsVideoCard'
import ShortsCategoryBar from './ShortsCategoryBar'
import CollectionsRail from './CollectionsRail'
import StartConversationModal from './StartConversationModal'
import { useShorts } from '../../hooks/useShorts'
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome'
import { saveShortsProgress, getShortsProgress, logShortsInteraction, toggleShortsLike } from '../../lib/shortsSupabase'

export default function ShortsPage({
  session, userId, conversations, getConvoName, onClose, initialVideoId, initialSearch,
}) {
  const [category, setCategory] = useState(initialSearch ? null : 'trending')
  const [searchInput, setSearchInput] = useState(initialSearch || '')
  const [activeSearch, setActiveSearch] = useState(initialSearch || '')
  const [showSearchBox, setShowSearchBox] = useState(false)
  const [shareTarget, setShareTarget] = useState(null)
  const [likedIds, setLikedIdsLocal] = useState(new Set())
  const startTimeRef = useRef(0)
  const replaysRef = useRef(0)
  const containerRef = useRef(null)
  const jumpedToInitialRef = useRef(false)
  const { chromeVisible, wake } = useAutoHideChrome()

  const {
    items, activeIndex, setActiveIndex, loading, loadingMore, error,
    windowStart, windowEnd, likedIds: hookLikedIds, setLikedIds, preferredCategories,
  } = useShorts(session, userId, {
    category: activeSearch ? null : category,
    query: activeSearch || null,
    forYou: category === 'forYou',
  })

  useEffect(() => { setLikedIdsLocal(hookLikedIds) }, [hookLikedIds])

  useEffect(() => {
    if (jumpedToInitialRef.current || !initialVideoId || items.length === 0) return
    const idx = items.findIndex(v => v.videoId === initialVideoId)
    if (idx !== -1) {
      jumpedToInitialRef.current = true
      requestAnimationFrame(() => containerRef.current?.children[idx]?.scrollIntoView({ behavior: 'instant' }))
    }
  }, [items, initialVideoId])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          const idx = Number(entry.target.dataset.index)
          setActiveIndex((prev) => {
            if (idx !== prev) {
              const prevVideo = items[prev]
              if (prevVideo) {
                logShortsInteraction(userId, prevVideo, startTimeRef.current, { skipped: true, replays: replaysRef.current })
              }
              startTimeRef.current = 0
              replaysRef.current = 0
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

  const handleReplay = useCallback(() => { replaysRef.current += 1 }, [])

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

  const openCollection = (cat) => { setCategory(cat); setActiveSearch('') }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: '#0a0a0f' }} onMouseMove={wake} onTouchStart={wake}>
      {/* Chrome: header + search + categories + collections — all fade together */}
      <div style={{ opacity: chromeVisible ? 1 : 0, transition: 'opacity 0.4s ease', pointerEvents: chromeVisible ? 'auto' : 'none' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6, display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 16px 8px', background: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent)',
        }}>
          <button onClick={onClose} style={headerBtnStyle}>←</button>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>Shorts</div>
          <button onClick={() => setShowSearchBox(v => !v)} style={headerBtnStyle}>🔍</button>
        </div>

        {showSearchBox ? (
          <div style={{ position: 'absolute', top: 58, left: 16, right: 16, zIndex: 6, display: 'flex', gap: 8 }}>
            <input
              autoFocus value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Search topics, creators…"
              style={{ flex: 1, background: 'rgba(20,20,30,0.5)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 14, padding: '10px 14px', color: '#fff', fontSize: 13.5, fontFamily: 'inherit', backdropFilter: 'blur(16px)' }}
            />
            <button onClick={runSearch} style={{ ...headerBtnStyle, width: 'auto', padding: '0 16px', borderRadius: 14 }}>Go</button>
          </div>
        ) : (
          <>
            <ShortsCategoryBar
              active={activeSearch ? null : category}
              onChange={(c) => { setCategory(c); setActiveSearch('') }}
              visible={chromeVisible}
            />
            <CollectionsRail preferredCategories={preferredCategories} onSelect={openCollection} visible={chromeVisible} />
          </>
        )}

        {activeSearch && (
          <div style={{ position: 'absolute', top: 60, left: 16, zIndex: 6, background: 'rgba(255,255,255,0.95)', color: '#0f0f1a', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            "{activeSearch}" <span onClick={() => { setActiveSearch(''); setCategory('trending') }} style={{ cursor: 'pointer' }}>✕</span>
          </div>
        )}
      </div>

      {loading && items.length === 0 && <ShortsSkeleton />}

      {!loading && error && items.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', color: '#fff', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>📡</div>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Couldn't load Shorts right now</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{error}</div>
          <button onClick={() => setCategory((c) => c)} style={{ marginTop: 4, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 18px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      <div
        ref={containerRef}
        style={{ height: '100dvh', overflowY: 'scroll', scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}
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
                startPosition={isActive ? resumePosition : 0}
                onProgress={isActive ? handleProgress : undefined}
                onReplay={isActive ? handleReplay : undefined}
                onTap={wake}
                liked={likedIds.has(video.videoId)}
                onToggleLike={() => handleToggleLike(video)}
                onOpenShare={() => setShareTarget(video)}
              />
            </div>
          )
        })}
        {loadingMore && <ShortsSkeleton compact />}
      </div>

      {shareTarget && (
        <StartConversationModal
          video={shareTarget}
          conversations={conversations}
          getConvoName={getConvoName}
          currentUserId={userId}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  )
}

function ShortsSkeleton({ compact }) {
  return (
    <div style={{ position: compact ? 'relative' : 'absolute', inset: compact ? undefined : 0, height: compact ? 200 : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
      <div style={{ width: compact ? 120 : 220, aspectRatio: '9/16', maxHeight: compact ? 180 : '70vh', borderRadius: 18, background: 'linear-gradient(110deg, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.06) 70%)', backgroundSize: '200% 100%', animation: 'shortsShimmer 1.4s ease infinite' }} />
      <style>{`@keyframes shortsShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}

const headerBtnStyle = {
  background: 'rgba(20,20,30,0.45)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.16)', borderRadius: '50%', width: 34, height: 34, color: '#fff',
  fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
