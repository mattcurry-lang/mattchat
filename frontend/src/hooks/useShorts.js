import { useState, useRef, useCallback, useEffect } from 'react'
import { fetchShortsFeed, getLikedShortIds } from '../lib/shortsSupabase'

const FETCH_AHEAD_THRESHOLD = 4

// How many real <YT.Player> instances stay mounted around the active
// card. Kept deliberately tight — each mounted player is a live
// iframe + YouTube's own JS runtime, not a cheap DOM node. 1 back / 1
// forward gives instant transitions in either scroll direction while
// capping concurrent players at 3. Everything outside this range
// falls back to a static <img> poster in ShortsVideoCard.
const PLAYER_BACK = 1
const PLAYER_FORWARD = 1

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

  const windowStart = Math.max(0, activeIndex - PLAYER_BACK)
  const windowEnd = Math.min(items.length, activeIndex + PLAYER_FORWARD + 1)

  return {
    items, activeIndex, setActiveIndex, loading, loadingMore, error,
    windowStart, windowEnd, likedIds, setLikedIds, preferredCategories,
    hasMore: !!pageToken.current || fetchingRef.current,
  }
}
