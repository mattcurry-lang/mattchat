import React, { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import InstagramPostCard from './InstagramPostCard'

function Skeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          style={{
            aspectRatio: '1/1', borderRadius: 12,
            background: 'linear-gradient(90deg, var(--bg-surface-2) 25%, var(--bg-surface-3, rgba(255,255,255,0.08)) 37%, var(--bg-surface-2) 63%)',
            backgroundSize: '400% 100%', animation: 'igSkeletonShimmer 1.4s ease infinite',
          }}
        />
      ))}
      <style>{`@keyframes igSkeletonShimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }`}</style>
    </div>
  )
}

export default function InstagramFeed({ feed, onAction }) {
  const { posts, loading, loadingMore, hasMore, loadMore, error } = feed
  const sentinelRef = useRef(null)

  // Lazy-load next page as the sentinel scrolls into view.
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [loadMore])

  if (loading) return <Skeleton />

  if (error === 'not_connected' || error === 'token_expired') {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
        Reconnect Instagram to load your posts.
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
        No posts available yet.
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {posts.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
          >
            <InstagramPostCard post={post} onAction={onAction} />
          </motion.div>
        ))}
      </div>

      <div ref={sentinelRef} style={{ height: 1 }} />

      {loadingMore && (
        <div style={{ textAlign: 'center', padding: '14px 0', fontSize: 12, color: 'var(--text-muted)' }}>
          Loading more…
        </div>
      )}
      {!hasMore && posts.length > 0 && (
        <div style={{ textAlign: 'center', padding: '14px 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
          You're all caught up
        </div>
      )}
    </div>
  )
}
