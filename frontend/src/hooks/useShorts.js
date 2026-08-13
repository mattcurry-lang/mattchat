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

// Cap on how many seen-video ids get sent to the feed function as
// excludeIds on each request. Sending the *entire* session history
// on every request would grow the request body unboundedly over a
// long scroll session — the most recent 200 is more than enough to
// break the pool's short repeat cycle without that cost.
const MAX_EXCLUDE_IDS = 200

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
  const pinnedVideoIdRef = useRef(pinnedVideo?.videoId || null)

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
        category, query, forYou,
        pageToken: isInitial ? null : pageToken.current,
        // Tell the feed function what's already been shown this
        // session so the pool stops handing back the same handful of
        // videos on every fresh load / page. Capped so the request
        // body doesn't grow unboundedly over a long scroll session.
        excludeIds: Array.from(seenIds.current).slice(-MAX_EXCLUDE_IDS),
      })

      if (myRequestId !== requestId.current) {
        fetchingRef.current = false
        setLoading(false)
        setLoadingMore(false)
        return
      }

      if (!data.ok) throw new Error(data.error || 'Failed to load Shorts')
      let fresh = data.items.filter(v => !seenIds.current.has(v.videoId))
      fresh.forEach(v => seenIds.current.add(v.videoId))
      pageToken.current = data.nextPageToken
      if (data.preferredCategories) setPreferredCategories(data.preferredCategories)
      const ids = fresh.map(v => v.videoId)
      getLikedShortIds(userId, ids).then(liked => {
        if (myRequestId !== requestId.current) return
        setLikedIds(prev => new Set([...prev, ...liked]))
      })

      setItems(prev => {
        let next = isInitial ? fresh : [...prev, ...fresh]
        // Guarantee a pinned video (e.g. a Short opened from a shared
        // chat message) is present at index 0 on the first load — the
        // feed API is essentially never going to have organically
        // returned that exact video, so it's spliced in directly
        // rather than searched for after the fact.
        if (isInitial && pinnedVideoIdRef.current) {
          const pinnedId = pinnedVideoIdRef.current
          const alreadyPresent = next.some(v => v.videoId === pinnedId)
          if (!alreadyPresent) {
            seenIds.current.add(pinnedId)
            next = [pinnedVideo, ...next]
          } else {
            // Already in the fetched batch somewhere else — move it
            // to index 0 instead of duplicating it.
            const idx = next.findIndex(v => v.videoId === pinnedId)
            const [pinnedItem] = next.splice(idx, 1)
            next = [pinnedItem, ...next]
          }
        }
        return next
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
  }, [session, userId, category, query, forYou, pinnedVideo])

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
