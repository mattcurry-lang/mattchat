import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import { Search as SearchIcon, X as XIcon, ArrowLeft, WifiOff, ChevronUp, ChevronDown } from 'lucide-react'
import ShortsVideoCard, { loadYouTubeAPI } from './ShortsVideoCard'
import ShortsCommentsSheet from './ShortsCommentsSheet'
import StartConversationModal from './StartConversationModal'
import { useShorts } from '../../hooks/useShorts'
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { saveShortsProgress, logShortsInteraction, toggleShortsLike, getFollowedChannelIds, toggleFollowChannel, getRepostedIds, toggleRepost, getSavedIds, toggleSave, getCommentCounts } from '../../lib/shortsSupabase'
import ConnectYouTubeBanner from './ConnectYouTubeBanner'
import { getYouTubeConnectionStatus, syncYouTubeSubscriptions } from '../../lib/shortsSupabase'
import BottomNav from '../BottomNav'

// Warms the browser's connection to YouTube's domains the instant
// Shorts opens, before any card has mounted or even fetched. DNS +
// TLS handshake is a fixed cost that would otherwise happen lazily on
// the first player's first request — doing it here overlaps it with
// the initial feed fetch instead of stacking after it.
function preconnectYouTube() {
  const hosts = ['https://www.youtube.com', 'https://i.ytimg.com', 'https://s.ytimg.com']
  hosts.forEach((href) => {
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = href
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  })
}

const MUTE_STORAGE_KEY = 'mattchat_shorts_muted'

function getInitialMuted() {
  try {
    const saved = localStorage.getItem(MUTE_STORAGE_KEY)
    return saved === null ? true : saved === 'true'
  } catch {
    return true
  }
}

export default function ShortsPage({
  session, userId, conversations, getConvoName, onClose, initialVideo, initialSearch,
  // Called with a tab name ('chats' | 'calls' | 'pulse' | 'status') when
  // the person taps the floating desktop nav while inside Shorts.
  // ChatPage is responsible for closing Shorts and switching the tab —
  // this component doesn't own that state, it just reports the intent.
  onNavigate,
}) {
  const [searchInput, setSearchInput] = useState(initialSearch || '')
  const [activeSearch, setActiveSearch] = useState(initialSearch || '')
  const [showSearchBox, setShowSearchBox] = useState(false)
  const [shareTarget, setShareTarget] = useState(null)
  const [commentTarget, setCommentTarget] = useState(null)
  const [commentCounts, setCommentCounts] = useState({})
  const [likedIds, setLikedIdsLocal] = useState(new Set())
  const [muted, setMuted] = useState(getInitialMuted)
  const startTimeRef = useRef(0)
  const replaysRef = useRef(0)
  const containerRef = useRef(null)
  const [followedChannelIds, setFollowedChannelIds] = useState(new Set())
  const [repostedIds, setRepostedIds] = useState(new Set())
  const [savedIds, setSavedIds] = useState(new Set())
  const fetchedMetaRef = useRef(new Set())
  const fetchedChannelsRef = useRef(new Set())
  const { chromeVisible, wake } = useAutoHideChrome()
  const [youtubeConnected, setYoutubeConnected] = useState(true)
  const [showYtBanner, setShowYtBanner] = useState(true)
  const isDesktop = useIsDesktop()

  useEffect(() => {
    getYouTubeConnectionStatus(userId).then(setYoutubeConnected)
  }, [userId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('youtube_connect') === 'success') {
      syncYouTubeSubscriptions(session).then(() => setYoutubeConnected(true))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [session])

  useEffect(() => { preconnectYouTube(); loadYouTubeAPI() }, [])

  const {
    items, activeIndex, setActiveIndex, loading, loadingMore, error,
    windowStart, windowEnd, likedIds: hookLikedIds, setLikedIds,
    trimEvent,
  } = useShorts(session, userId, {
    category: activeSearch ? null : 'trending',
    query: activeSearch || null,
    forYou: !activeSearch,
    pinnedVideo: initialVideo || null,
  })

  useEffect(() => { setLikedIdsLocal(hookLikedIds) }, [hookLikedIds])

  useEffect(() => {
    const newItems = items.filter(v => !fetchedMetaRef.current.has(v.videoId))
    if (newItems.length === 0) return
    newItems.forEach(v => fetchedMetaRef.current.add(v.videoId))

    const videoIds = newItems.map(v => v.videoId)
    getRepostedIds(userId, videoIds).then(ids => setRepostedIds(prev => new Set([...prev, ...ids])))
    getSavedIds(userId, videoIds).then(ids => setSavedIds(prev => new Set([...prev, ...ids])))
    getCommentCounts(videoIds).then(counts => setCommentCounts(prev => ({ ...prev, ...counts })))

    const newChannelIds = [...new Set(newItems.map(v => v.channelId).filter(Boolean))]
      .filter(id => !fetchedChannelsRef.current.has(id))
    if (newChannelIds.length > 0) {
      newChannelIds.forEach(id => fetchedChannelsRef.current.add(id))
      getFollowedChannelIds(userId, newChannelIds).then(ids => setFollowedChannelIds(prev => new Set([...prev, ...ids])))
    }
  }, [items, userId])

  const lastHandledTrimId = useRef(null)
  useLayoutEffect(() => {
    if (!trimEvent || trimEvent.id === lastHandledTrimId.current) return
    lastHandledTrimId.current = trimEvent.id
    const container = containerRef.current
    if (!container) return
    const cardHeight = container.clientHeight
    container.scrollTop -= trimEvent.count * cardHeight
  }, [trimEvent])

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

  // Programmatic scroll to a given card index — used by both the
  // standalone desktop chevron cluster below and arrow-key navigation.
  // The IntersectionObserver above is what actually updates
  // activeIndex once the scroll lands; this just drives the scroll.
  const scrollToIndex = useCallback((idx) => {
    const container = containerRef.current
    if (!container || items.length === 0) return
    const clamped = Math.max(0, Math.min(idx, items.length - 1))
    container.scrollTo({ top: clamped * container.clientHeight, behavior: 'smooth' })
  }, [items.length])

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowUp')   { e.preventDefault(); scrollToIndex(activeIndex - 1); wake() }
      if (e.key === 'ArrowDown') { e.preventDefault(); scrollToIndex(activeIndex + 1); wake() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, scrollToIndex, wake])

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

  const handleToggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      try { localStorage.setItem(MUTE_STORAGE_KEY, String(next)) } catch { /* storage unavailable — preference just won't persist */ }
      return next
    })
  }, [])

  const handleToggleFollow = useCallback(async (video) => {
    if (!video.channelId) return
    const isFollowing = followedChannelIds.has(video.channelId)
    const nowFollowing = await toggleFollowChannel(userId, video.channelId, video.channelTitle, isFollowing)
    setFollowedChannelIds(prev => {
      const next = new Set(prev)
      nowFollowing ? next.add(video.channelId) : next.delete(video.channelId)
      return next
    })
  }, [followedChannelIds, userId])

  const handleToggleRepost = useCallback(async (video) => {
    const isReposted = repostedIds.has(video.videoId)
    const nowReposted = await toggleRepost(userId, video, isReposted)
    setRepostedIds(prev => {
      const next = new Set(prev)
      nowReposted ? next.add(video.videoId) : next.delete(video.videoId)
      return next
    })
  }, [repostedIds, userId])

  const handleToggleSave = useCallback(async (video) => {
    const isSaved = savedIds.has(video.videoId)
    const nowSaved = await toggleSave(userId, video.videoId, isSaved)
    setSavedIds(prev => {
      const next = new Set(prev)
      nowSaved ? next.add(video.videoId) : next.delete(video.videoId)
      return next
    })
  }, [savedIds, userId])

  const runSearch = () => {
    if (!searchInput.trim()) return
    setActiveSearch(searchInput.trim())
    setShowSearchBox(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: '#0a0a0f' }} onMouseMove={wake} onTouchStart={wake}>
      <div style={{ opacity: chromeVisible ? 1 : 0, transition: 'opacity 0.4s ease', pointerEvents: chromeVisible ? 'auto' : 'none' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6, display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 16px 8px', background: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent)',
        }}>
          <button onClick={onClose} style={headerBtnStyle}><ArrowLeft size={18} color="#fff" /></button>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>Shorts</div>
          <button onClick={() => setShowSearchBox(v => !v)} style={headerBtnStyle}><SearchIcon size={17} color="#fff" /></button>
        </div>

        {showSearchBox && (
          <div style={{ position: 'absolute', top: 58, left: 16, right: 16, zIndex: 6, display: 'flex', gap: 8 }}>
            <input
              autoFocus value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Search topics, creators…"
              style={{ flex: 1, background: 'rgba(20,20,30,0.5)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 14, padding: '10px 14px', color: '#fff', fontSize: 13.5, fontFamily: 'inherit', backdropFilter: 'blur(16px)' }}
            />
            <button onClick={runSearch} style={{ ...headerBtnStyle, width: 'auto', padding: '0 16px', borderRadius: 14 }}>Go</button>
          </div>
        )}

        {!youtubeConnected && showYtBanner && (
          <div style={{ position: 'absolute', top: 58, left: 16, right: 16, zIndex: 6 }}>
            <ConnectYouTubeBanner session={session} onClose={() => setShowYtBanner(false)} />
          </div>
        )}

        {activeSearch && (
          <div style={{ position: 'absolute', top: 60, left: 16, zIndex: 6, background: 'rgba(255,255,255,0.95)', color: '#0f0f1a', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            "{activeSearch}"
            <XIcon size={13} style={{ cursor: 'pointer' }} onClick={() => setActiveSearch('')} />
          </div>
        )}
      </div>

      {loading && items.length === 0 && <ShortsSkeleton />}

      {!loading && error && items.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', color: '#fff', padding: 24, textAlign: 'center' }}>
          <WifiOff size={30} color="rgba(255,255,255,0.7)" />
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Couldn't load Shorts right now</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{error}</div>
          <button onClick={() => window.location.reload()} style={{ marginTop: 4, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 18px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
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
            <div
              key={video.videoId}
              data-index={i}
              style={{
                scrollSnapAlign: 'start',
                contentVisibility: 'auto',
                containIntrinsicSize: '100vw 100dvh',
              }}
            >
              <ShortsVideoCard
                video={video}
                isActive={isActive}
                isMounted={isMounted}
                onProgress={isActive ? handleProgress : undefined}
                onReplay={isActive ? handleReplay : undefined}
                onTap={wake}
                liked={likedIds.has(video.videoId)}
                onToggleLike={() => handleToggleLike(video)}
                onOpenShare={() => setShareTarget(video)}
                onOpenComments={() => setCommentTarget(video)}
                commentCount={commentCounts[video.videoId] || 0}
                muted={muted}
                onToggleMute={handleToggleMute}
                following={video.channelId ? followedChannelIds.has(video.channelId) : false}
                onToggleFollow={() => handleToggleFollow(video)}
                reposted={repostedIds.has(video.videoId)}
                onToggleRepost={() => handleToggleRepost(video)}
                saved={savedIds.has(video.videoId)}
                onToggleSave={() => handleToggleSave(video)}
              />
            </div>
          )
        })}
        {loadingMore && <ShortsSkeleton compact />}
      </div>

      {/* Standalone floating up/down nav — fixed to the VIEWPORT, not
          to any card, vertically centered on the whole screen, near
          the right edge. This matches the Instagram reference exactly:
          the chevrons sit clearly separate from the action rail, not
          merged into it. Positioned above the Curry AI orb buttons
          (which already occupy the bottom-right corner) with enough
          gap that they never collide. */}
      {isDesktop && items.length > 0 && (
        <div style={{
          position: 'fixed', right: 34, top: '50%', transform: 'translateY(-50%)', zIndex: 6,
          display: 'flex', flexDirection: 'column', gap: 10,
          opacity: chromeVisible ? 1 : 0, transition: 'opacity 0.4s ease',
          pointerEvents: chromeVisible ? 'auto' : 'none',
        }}>
          <button
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            title="Previous Short (↑)"
            style={navArrowBtnStyle(activeIndex === 0)}
            onMouseEnter={e => { if (activeIndex !== 0) e.currentTarget.style.transform = 'scale(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            <ChevronUp size={20} color="#fff" strokeWidth={2.5} />
          </button>
          <button
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex >= items.length - 1}
            title="Next Short (↓)"
            style={navArrowBtnStyle(activeIndex >= items.length - 1)}
            onMouseEnter={e => { if (activeIndex < items.length - 1) e.currentTarget.style.transform = 'scale(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            <ChevronDown size={20} color="#fff" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Desktop-only floating chat nav, bottom-left — kept reachable
          while browsing Shorts without a full-width bar over the
          video/rail. Hidden on mobile; native swipe/scroll covers
          navigation there. */}
      {onNavigate && (
        <BottomNav
          variant="floating"
          activeTab="pulse"
          onTabChange={onNavigate}
          onProfileClick={() => onNavigate('chats')}
        />
      )}

      {shareTarget && (
        <StartConversationModal
          video={shareTarget}
          conversations={conversations}
          getConvoName={getConvoName}
          currentUserId={userId}
          onClose={() => setShareTarget(null)}
        />
      )}

      {commentTarget && (
        <ShortsCommentsSheet
          video={commentTarget}
          userId={userId}
          onClose={() => setCommentTarget(null)}
          onCommentPosted={() => setCommentCounts(prev => ({
            ...prev, [commentTarget.videoId]: (prev[commentTarget.videoId] || 0) + 1,
          }))}
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

const navArrowBtnStyle = (disabled) => ({
  background: 'rgba(20,20,30,0.55)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.18)', borderRadius: '50%', width: 42, height: 42,
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1,
  boxShadow: disabled ? 'none' : '0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
  transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s',
})
