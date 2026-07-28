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
  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  </div>
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
  <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
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
  {post.likeCount != null && (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21s-6.7-4.35-9.3-8.2C1 10.1 1.6 6.9 4.4 5.4c2.2-1.2 4.8-.5 6.1 1.4l1.5 2 1.5-2c1.3-1.9 3.9-2.6 6.1-1.4 2.8 1.5 3.4 4.7 1.7 7.4C18.7 16.65 12 21 12 21z" />
      </svg>
      {formatCount(post.likeCount)}
    </span>
  )}
  {post.commentCount != null && (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-4-1L3 20l1.5-5.5A8.38 8.38 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
      </svg>
      {formatCount(post.commentCount)}
    </span>
  )}
</div>
      </motion.div>
    </motion.button>
  )
}
