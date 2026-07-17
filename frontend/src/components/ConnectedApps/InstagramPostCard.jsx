import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { openInstagramPost } from '../../lib/openInstagram'

function formatCount(n) {
  if (n == null) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export default function InstagramPostCard({ post, onAction }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const isVideo = post.mediaType === 'VIDEO'

  const handleOpen = () => {
    onAction?.('Opening Instagram to complete this action.')
    openInstagramPost(post.permalink)
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleOpen}
      style={{
        display: 'block', width: '100%', aspectRatio: '1/1', borderRadius: 12,
        overflow: 'hidden', position: 'relative', border: '1px solid var(--border)',
        background: 'var(--bg-surface-2)', cursor: 'pointer', padding: 0,
      }}
      title="Opens on Instagram"
    >
      {!imgLoaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📷</div>
      )}
      <img
        src={post.thumbnailUrl}
        alt={post.caption?.slice(0, 60) || 'Instagram post'}
        loading="lazy"
        onLoad={() => setImgLoaded(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: imgLoaded ? 'block' : 'none' }}
      />

      {isVideo && (
        <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 14, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>▶️</div>
      )}

      <div
        style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end',
          padding: 8, opacity: 0, transition: 'opacity 0.15s',
          background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55) 100%)',
        }}
        className="ig-post-overlay"
        onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
      >
        <div style={{ display: 'flex', gap: 10, fontSize: 11, fontWeight: 700, color: '#fff' }}>
          {post.likeCount != null && <span>♥ {formatCount(post.likeCount)}</span>}
          {post.commentCount != null && <span>💬 {formatCount(post.commentCount)}</span>}
        </div>
      </div>
    </motion.button>
  )
}
