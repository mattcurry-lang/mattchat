import React, { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import InstagramPostCard from './InstagramPostCard'

function Skeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: Math.min(i * 0.03, 0.2) }}
          style={{
            aspectRatio: '1/1', borderRadius: 12,
            background: 'linear-gradient(100deg, var(--bg-surface-2) 20%, var(--bg-surface-3, rgba(255,255,255,0.1)) 42%, var(--bg-surface-2) 64%)',
            backgroundSize: '250% 100%', animation: 'igSkeletonShimmer 1.6s ease-in-out infinite',
          }}
        />
      ))}
      <style>{`
        @keyframes igSkeletonShimmer {
          0% { background-position: 130% 50%; }
          100% { background-position: -30% 50%; }
        }
      `}</style>
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}
      >
        Reconnect Instagram to load your posts.
      </motion.div>
    )
  }

  if (posts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}
      >
        No posts available yet.
      </motion.div>
    )
  }

  return (
    <div>
      <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        <AnimatePresence initial={false}>
          {posts.map((post, i) => (
            <motion.div
              layout
              key={post.id}
              initial={{ opacity: 0, scale: 0.94, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30, delay: Math.min(i * 0.015, 0.24) }}
            >
              <InstagramPostCard post={post} onAction={onAction} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <div ref={sentinelRef} style={{ height: 1 }} />

      <AnimatePresence>
        {loadingMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ textAlign: 'center', padding: '14px 0', fontSize: 12, color: 'var(--text-muted)' }}
          >
            Loading more…
          </motion.div>
        )}
      </AnimatePresence>

      {!hasMore && posts.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ textAlign: 'center', padding: '14px 0', fontSize: 11.5, color: 'var(--text-muted)' }}
        >
          You're all caught up
        </motion.div>
      )}
    </div>
  )
}
