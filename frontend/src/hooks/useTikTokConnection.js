import { useState, useEffect, useCallback } from 'react'
import { connectTikTok, disconnectTikTok, getTikTokAccount, callTikTokApi } from '../lib/supabase'

export function useTikTokConnection(session, userId) {
  const [account, setAccount] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'connected' | 'not_connected'
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const refreshStatus = useCallback(async () => {
    if (!userId) return
    const acc = await getTikTokAccount(userId)
    setAccount(acc)
    setStatus(acc?.status === 'connected' ? 'connected' : 'not_connected')
  }, [userId])

  useEffect(() => { refreshStatus() }, [refreshStatus])

  const connect = async () => {
    setConnecting(true)
    try {
      await connectTikTok(session) // redirects the page
    } catch (e) {
      setConnecting(false)
      throw e
    }
  }

  const disconnect = async () => {
    setDisconnecting(true)
    try {
      await disconnectTikTok(session)
      await refreshStatus()
    } finally {
      setDisconnecting(false)
    }
  }

  return { account, status, connecting, disconnecting, connect, disconnect, refreshStatus }
}

// Fetches the connected user's own recent videos, paginated via
// TikTok's cursor — only runs once actually connected.
export function useTikTokFeed(session, status) {
  const [videos, setVideos] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (status !== 'connected') { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const [profileRes, videosRes] = await Promise.all([
        callTikTokApi(session, 'profile'),
        callTikTokApi(session, 'videos', { limit: 20 }),
      ])
      if (profileRes.ok) setProfile(profileRes.profile)
      if (videosRes.ok) {
        setVideos(videosRes.videos)
        setNextCursor(videosRes.nextCursor)
        setHasMore(videosRes.hasMore)
      } else {
        setError(videosRes.reason === 'token_expired' ? 'expired' : 'error')
      }
    } catch (e) {
      console.error('useTikTokFeed load failed:', e)
      setError('error')
    }
    setLoading(false)
  }, [session, status])

  useEffect(() => { load() }, [load])

  const loadMore = async () => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await callTikTokApi(session, 'videos', { limit: 20, cursor: nextCursor })
      if (res.ok) {
        setVideos((prev) => [...prev, ...res.videos])
        setNextCursor(res.nextCursor)
        setHasMore(res.hasMore)
      }
    } catch (e) {
      console.error('useTikTokFeed loadMore failed:', e)
    }
    setLoadingMore(false)
  }

  return { videos, profile, loading, loadingMore, hasMore, loadMore, error, reload: load }
}
