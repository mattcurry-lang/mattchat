import { useState, useRef, useCallback, useEffect } from 'react'
import { fetchShortsFeed, getLikedShortIds } from '../lib/shortsSupabase'

const INITIAL_BATCH = 12
const FETCH_AHEAD_THRESHOLD = 4   // fetch next page when this close to the end
const KEEP_WINDOW = 6             // items to keep mounted around the active index

export function useShorts(session, userId, { category, query, forYou }) {
  const [items, setItems] = useState([])
  const [likedIds, setLikedIds] = useState(new Set())
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const pageToken = useRef(null)
  const fetchingRef = useRef(false)
  const seenIds = useRef(new Set())

  const reset = useCallback(() => {
    setItems([]); setActiveIndex(0); pageToken.current = null; seenIds.current = new Set()
  }, [])

  const loadBatch = useCallback(async (isInitial) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    isInitial ? setLoading(true) : setLoadingMore(true)
    setError(null)
    try {
      const data = await fetchShortsFeed(session, {
        category, query, forYou, pageToken: isInitial ? null : pageToken.current,
      })
      if (!data.ok) throw new Error(data.error || 'Failed to load Shorts')
      const fresh = data.items.filter(v => !seenIds.current.has(v.videoId))
      fresh.forEach(v => seenIds.current.add(v.videoId))
      pageToken.current = data.nextPageToken

      const ids = fresh.map(v => v.videoId)
      getLikedShortIds(userId, ids).then(liked => {
        setLikedIds(prev => new Set([...prev, ...liked]))
      })

      setItems(prev => isInitial ? fresh : [...prev, ...fresh])
    } catch (e) {
      console.error('Shorts loadBatch failed:', e)
      setError(e.message)
    }
    fetchingRef.current = false
    setLoading(false)
    setLoadingMore(false)
  }, [session, userId, category, query, forYou])

  // Category/search/forYou change -> full reset + refetch
  useEffect(() => { reset(); loadBatch(true) }, [category, query, forYou]) // eslint-disable-line

  // Fetch-ahead as the user approaches the end of the loaded batch
  useEffect(() => {
    if (items.length - activeIndex <= FETCH_AHEAD_THRESHOLD && pageToken.current && !fetchingRef.current) {
      loadBatch(false)
    }
  }, [activeIndex, items.length, loadBatch])

  // Windowed view — only items within KEEP_WINDOW of the active index
  // stay in the render list with real players; everything else is a
  // lightweight placeholder so far-off videos never sit in memory.
  const windowStart = Math.max(0, activeIndex - 2)
  const windowEnd = Math.min(items.length, activeIndex + KEEP_WINDOW)

  return {
    items, activeIndex, setActiveIndex, loading, loadingMore, error,
    windowStart, windowEnd, likedIds, setLikedIds,
    hasMore: !!pageToken.current || fetchingRef.current,
    initialBatchSize: INITIAL_BATCH,
  }
}
