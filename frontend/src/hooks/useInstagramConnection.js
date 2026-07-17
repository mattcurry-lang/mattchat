// src/hooks/useInstagramConnection.js
//
// Central state for the Instagram connection: whether it's connected,
// the public profile fields, connect/disconnect actions, and loading
// the user's own media feed with pagination. Used by both
// ConnectedAppsSection (just needs the status) and InstagramView (needs
// the full profile + feed).

import { useState, useCallback, useEffect } from 'react'
import {
  connectInstagram,
  disconnectInstagram,
  getInstagramProfile,
  getInstagramMedia,
  getConnectedAccountsStatus,
} from '../lib/instagram'

export function useInstagramConnection(session, userId) {
  const [status, setStatus] = useState('loading') // 'loading' | 'connected' | 'not_connected' | 'expired'
  const [account, setAccount] = useState(null) // sanitized row from connected_accounts_public
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const refreshStatus = useCallback(async () => {
    if (!userId) return
    try {
      const rows = await getConnectedAccountsStatus(userId)
      const ig = rows.find((r) => r.provider === 'instagram')
      if (!ig) {
        setStatus('not_connected')
        setAccount(null)
      } else {
        setStatus(ig.status === 'connected' ? 'connected' : 'expired')
        setAccount(ig)
      }
    } catch (e) {
      console.error('useInstagramConnection refreshStatus failed:', e)
      setStatus('not_connected')
    }
  }, [userId])

  useEffect(() => { refreshStatus() }, [refreshStatus])

  const connect = useCallback(async () => {
    if (connecting) return
    setConnecting(true)
    try {
      await connectInstagram(session) // redirects the page — never resolves normally
    } catch (e) {
      setConnecting(false)
      throw e
    }
  }, [session, connecting])

  const disconnect = useCallback(async () => {
    if (disconnecting) return
    setDisconnecting(true)
    try {
      await disconnectInstagram(session)
      setStatus('not_connected')
      setAccount(null)
    } finally {
      setDisconnecting(false)
    }
  }, [session, disconnecting])

  return { status, account, connecting, disconnecting, connect, disconnect, refreshStatus }
}

// Separate hook for the feed itself (only needed once InstagramView is
// actually open) — kept apart so ConnectedAppsSection's status check
// doesn't also pull the whole media list.
export function useInstagramFeed(session, status) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (status !== 'connected') return
    setLoading(true)
    setError(null)
    try {
      const data = await getInstagramMedia(session, { limit: 12 })
      if (data.ok) {
        setPosts(data.posts)
        setCursor(data.nextCursor)
        setHasMore(!!data.nextCursor)
      } else {
        setError(data.reason || 'error')
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [session, status])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return
    setLoadingMore(true)
    try {
      const data = await getInstagramMedia(session, { limit: 12, after: cursor })
      if (data.ok) {
        setPosts((prev) => [...prev, ...data.posts])
        setCursor(data.nextCursor)
        setHasMore(!!data.nextCursor)
      }
    } catch (e) {
      console.error('loadMore failed:', e)
    }
    setLoadingMore(false)
  }, [session, cursor, hasMore, loadingMore])

  useEffect(() => { load() }, [load])

  return { posts, loading, loadingMore, hasMore, loadMore, error, reload: load }
}
