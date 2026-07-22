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
      whileHover="hover"
      whileTap={{ scale: 0.97 }}
      initial="rest"
      animate="rest"
      onClick={handleOpen}
      style={{
        display: 'block', width: '100%', aspectRatio: '1/1', borderRadius: 12,
        overflow: 'hidden', position: 'relative', border: '1px solid var(--border)',
        background: 'var(--bg-surface-2)', cursor: 'pointer', padding: 0,
      }}
      title="Opens on Instagram"
    >
      {!imgLoaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--text-muted)' }}>📷</div>
      )}

      <motion.img
        src={post.thumbnailUrl}
        alt={post.caption?.slice(0, 60) || 'Instagram post'}
        loading="lazy"
        onLoad={() => setImgLoaded(true)}
        variants={{ rest: { scale: 1 }, hover: { scale: 1.06 } }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        initial={{ opacity: 0 }}
        animate={{ opacity: imgLoaded ? 1 : 0 }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {isVideo && (
        <div
          style={{
            position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
          }}
        >
          ▶️
        </div>
      )}

      <motion.div
        variants={{ rest: { opacity: 0 }, hover: { opacity: 1 } }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end',
          padding: 8,
          background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.6) 100%)',
        }}
      >
        <div style={{ display: 'flex', gap: 10, fontSize: 11, fontWeight: 700, color: '#fff' }}>
          {post.likeCount != null && <span>♥ {formatCount(post.likeCount)}</span>}
          {post.commentCount != null && <span>💬 {formatCount(post.commentCount)}</span>}
        </div>
      </motion.div>
    </motion.button>
  )
}
