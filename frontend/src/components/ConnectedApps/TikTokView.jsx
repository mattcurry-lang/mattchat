import React from 'react'
import { motion } from 'framer-motion'
import Avatar from '../Avatar'
import { useTikTokFeed } from '../../hooks/useTikTokConnection'

function formatCount(n) {
  if (n == null) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function VideoCard({ video }) {
  return (
    
      href={video.shareUrl || '#'}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'block', position: 'relative', borderRadius: 12, overflow: 'hidden', textDecoration: 'none', background: '#000' }}
    >
      <img
        src={video.coverImageUrl}
        alt={video.title || 'TikTok video'}
        style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.85))' }} />
      {video.viewCount != null && (
        <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '2px 8px', fontSize: 10.5, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 3 }}>
          ▶ {formatCount(video.viewCount)}
        </div>
      )}
      {video.title && (
        <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, color: '#fff', fontSize: 11, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {video.title}
        </div>
      )}
    </a>
  )
}

export default function TikTokView({ session, account, status, onDisconnect, disconnecting, onClose }) {
  const { videos, profile, loading, loadingMore, hasMore, loadMore, error } = useTikTokFeed(session, status)

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect TikTok? Mattchat will remove the connection and stop showing your TikTok content here.')) return
    await onDisconnect()
    onClose()
  }

  const displayProfile = profile || account

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 15, padding: 4 }}>←</button>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>TikTok</h3>
        <span
          title="Connected via TikTok — content and actions belong to TikTok"
          style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: '#fff', background: '#000', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 10px' }}
        >
          via TikTok
        </span>
      </div>

      {/* Profile header */}
      <div style={{ borderRadius: 20, padding: 18, position: 'relative', overflow: 'hidden', background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.06, background: 'linear-gradient(135deg,#25f4ee,#000,#fe2c55)' }} />
        <div style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar name={displayProfile?.username} size={64} photoUrl={displayProfile?.avatarUrl || displayProfile?.avatar_url} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              {displayProfile?.displayName || displayProfile?.display_name || displayProfile?.username}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>@{displayProfile?.username}</div>
            {displayProfile?.bio && (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{displayProfile.bio}</div>
            )}
          </div>
        </div>

        {profile?.stats && (
          <div style={{ position: 'relative', display: 'flex', gap: 18, marginTop: 14 }}>
            {[
              ['Followers', profile.stats.followerCount],
              ['Following', profile.stats.followingCount],
              ['Likes', profile.stats.likesCount],
              ['Videos', profile.stats.videoCount],
            ].map(([label, val]) => val != null && (
              <div key={label}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCount(val)}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 14 }}>
          
            href={displayProfile?.profileUrl || displayProfile?.profile_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, textAlign: 'center', background: '#000', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '9px 0', textDecoration: 'none' }}
          >
            Open profile in TikTok
          </a>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#f87171', fontSize: 12.5, fontWeight: 700, padding: '9px 14px', cursor: disconnecting ? 'default' : 'pointer', fontFamily: 'inherit', opacity: disconnecting ? 0.6 : 1 }}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      </div>

      {/* Video grid */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Your videos</div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 30, fontSize: 12.5, color: 'var(--text-muted)' }}>Loading…</div>
        )}

        {!loading && error === 'expired' && (
          <div style={{ fontSize: 12.5, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '10px 12px' }}>
            Your TikTok connection expired. Disconnect and reconnect to keep seeing your videos here.
          </div>
        )}

        {!loading && error === 'error' && (
          <div style={{ fontSize: 12.5, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 12px' }}>
            Couldn't load your videos right now.
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, fontSize: 12.5, color: 'var(--text-muted)' }}>No public videos found.</div>
        )}

        {!loading && videos.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {videos.map((v) => <VideoCard key={v.id} video={v} />)}
            </div>
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{ width: '100%', marginTop: 12, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 700, padding: '10px 0', cursor: loadingMore ? 'default' : 'pointer', fontFamily: 'inherit' }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
