import { useState, useRef, useCallback, useEffect } from 'react'
import { fetchShortsFeed, getLikedShortIds } from '../lib/shortsSupabase'

const FETCH_AHEAD_THRESHOLD = 8 // must stay > PLAYER_FORWARD, or the fetch fires after mounting has already caught up to the fetched data

// Real <YT.Player> mount window. Widened to 5 forward on request, to
// have the next 5 videos already buffering before the user swipes to
// them (eliminates the loading state on forward scroll). This trades
// back part of the memory optimization from earlier — up to 6
// concurrent YouTube iframes now (1 back + active + 5 forward)
// instead of 3. Backward stays at 1 since re-watching the previous
// video is far more common than jumping several back.
const PLAYER_BACK = 1
const PLAYER_FORWARD = 5

// Once the fetched-items array grows past this, trim scrolled-past
// items off the front so a long session doesn't accumulate an
// unbounded DOM/memory footprint. TRIM_TARGET is where it lands after
// trimming. TRIM_SAFETY_BUFFER is how far behind the active card an
// item must be before it's eligible for removal — this must stay
// comfortably larger than PLAYER_BACK so trimming never touches
// anything currently mounted.
const MAX_ITEMS_IN_MEMORY = 80
const TRIM_TARGET = 50
const TRIM_SAFETY_BUFFER = 20

export function useShorts(session, userId, { category, query, forYou, pinnedVideo }) {
  const [items, setItems] = useState([])
  const [likedIds, setLikedIds] = useState(new Set())
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [preferredCategories, setPreferredCategories] = useState([])
  // Bumped every time a trim happens, carrying how many items were
  // removed. ShortsPage watches this to compensate the scroll
  // container's scrollTop by the same amount, so trimming never causes
  // a visible jump.
  const [trimEvent, setTrimEvent] = useState(null) // { count, id } | null

  const pageToken = useRef(null)
  const fetchingRef = useRef(false)
  const seenIds = useRef(new Set())
  const requestId = useRef(0)

  // Video to guarantee is present (e.g. one shared into a chat) —
  // captured once on mount so it survives across this hook's re-renders,
  // and consumed (set to null) the first time it's actually spliced in,
  // so a later search/category change doesn't keep re-pinning it.
  const pinnedRef = useRef(pinnedVideo || null)

  const reset = useCallback(() => {
    requestId.current += 1
    setItems([]); setActiveIndex(0); pageToken.current = null; seenIds.current = new Set()
    setTrimEvent(null)
  }, [])

  const loadBatch = useCallback(async (isInitial) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    const myRequestId = requestId.current
    isInitial ? setLoading(true) : setLoadingMore(true)
    setError(null)
    try {
      const data = await fetchShortsFeed(session, {
        category, query, forYou, pageToken: isInitial ? null : pageToken.current,
      })

      if (myRequestId !== requestId.current) {
        fetchingRef.current = false
        setLoading(false)
        setLoadingMore(false)
        return
      }

      if (!data.ok) throw new Error(data.error || 'Failed to load Shorts')
      const fresh = data.items.filter(v => !seenIds.current.has(v.videoId))
      fresh.forEach(v => seenIds.current.add(v.videoId))
      pageToken.current = data.nextPageToken
      if (data.preferredCategories) setPreferredCategories(data.preferredCategories)
      const ids = fresh.map(v => v.videoId)
      getLikedShortIds(userId, ids).then(liked => {
        if (myRequestId !== requestId.current) return
        setLikedIds(prev => new Set([...prev, ...liked]))
      })
      setItems(prev => {
        if (!isInitial) return [...prev, ...fresh]
        // First batch of a session: if there's a pinned video (shared
        // into a chat, opened from a message bubble, etc.), it goes at
        // index 0 regardless of whether the feed API happened to
        // return it — that's what guarantees "open the short you were
        // sent" actually shows that video instead of whatever the
        // trending/For You pool served up. Dedup against whatever the
        // feed also returned so it's never shown twice.
        if (pinnedRef.current) {
          const pinned = pinnedRef.current
          pinnedRef.current = null // only pin once per hook lifetime
          seenIds.current.add(pinned.videoId)
          const rest = fresh.filter(v => v.videoId !== pinned.videoId)
          return [pinned, ...rest]
        }
        return fresh
      })
    } catch (e) {
      if (myRequestId === requestId.current) {
        console.error('Shorts loadBatch failed:', e)
        setError(e.message)
      }
    }
    fetchingRef.current = false
    setLoading(false)
    setLoadingMore(false)
  }, [session, userId, category, query, forYou])

  useEffect(() => { reset(); loadBatch(true) }, [category, query, forYou]) // eslint-disable-line

  useEffect(() => {
    if (items.length - activeIndex <= FETCH_AHEAD_THRESHOLD && pageToken.current && !fetchingRef.current) {
      loadBatch(false)
    }
  }, [activeIndex, items.length, loadBatch])

  // Front-trim: only fires once the array is actually large AND the
  // user has scrolled far enough past the old items that removing them
  // won't touch the player window or anything about to enter it.
  useEffect(() => {
    if (items.length <= MAX_ITEMS_IN_MEMORY) return
    const trimCount = items.length - TRIM_TARGET
    if (trimCount <= 0) return
    if (activeIndex - trimCount < TRIM_SAFETY_BUFFER + PLAYER_BACK) return // not far enough ahead yet — wait

    setItems(prev => prev.slice(trimCount))
    setActiveIndex(prev => prev - trimCount)
    setTrimEvent({ count: trimCount, id: Date.now() })
    // seenIds and pageToken are untouched — they track fetch/dedup
    // state, not display state, so trimming what's rendered has no
    // effect on pagination correctness.
  }, [items.length, activeIndex])

  const windowStart = Math.max(0, activeIndex - PLAYER_BACK)
  const windowEnd = Math.min(items.length, activeIndex + PLAYER_FORWARD + 1)

  return {
    items, activeIndex, setActiveIndex, loading, loadingMore, error,
    windowStart, windowEnd, likedIds, setLikedIds, preferredCategories,
    hasMore: !!pageToken.current || fetchingRef.current,
    trimEvent,
  }
}
