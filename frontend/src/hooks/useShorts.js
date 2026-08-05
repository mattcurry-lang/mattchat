import { useState, useRef, useCallback, useEffect } from 'react'
import { fetchShortsFeed, getLikedShortIds } from '../lib/shortsSupabase'

const FETCH_AHEAD_THRESHOLD = 4
const KEEP_WINDOW = 6

export function useShorts(session, userId, { category, query, forYou }) {
  const [items, setItems] = useState([])
  const [likedIds, setLikedIds] = useState(new Set())
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [preferredCategories, setPreferredCategories] = useState([])

  const pageToken = useRef(null)
  const fetchingRef = useRef(false)
  const seenIds = useRef(new Set())

  // Bumped on every reset() — a fetch started under an older requestId
  // is stale by the time it resolves and must never touch state. This
  // is what fixes the "switch category twice fast" bug where a slow
  // response from the FIRST category could land after the SECOND
  // category's fetch already started, silently splicing wrong-category
  // videos into the feed.
  const requestId = useRef(0)

  const reset = useCallback(() => {
    requestId.current += 1
    setItems([]); setActiveIndex(0); pageToken.current = null; seenIds.current = new Set()
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

      // The world may have moved on while this request was in flight
      // (user switched category/search). Drop the response entirely
      // rather than merge it — reset() already cleared items/seenIds
      // for the new request, so applying this one would corrupt state
      // and also leave fetchingRef stuck if we return before the
      // finally-equivalent below. We still fall through to the
      // finally block to clear fetchingRef/loading flags correctly.
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
        // Same guard on the follow-up like-status fetch — it resolves
        // independently and can straggle in after a category switch too.
        if (myRequestId !== requestId.current) return
        setLikedIds(prev => new Set([...prev, ...liked]))
      })
      setItems(prev => isInitial ? fresh : [...prev, ...fresh])
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

  const windowStart = Math.max(0, activeIndex - 2)
  const windowEnd = Math.min(items.length, activeIndex + KEEP_WINDOW)

  return {
    items, activeIndex, setActiveIndex, loading, loadingMore, error,
    windowStart, windowEnd, likedIds, setLikedIds, preferredCategories,
    hasMore: !!pageToken.current || fetchingRef.current,
  }
}
