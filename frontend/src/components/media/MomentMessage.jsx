// MomentMessage.jsx
// The grouped-Moment bubble: cover image, title, item count, subtle
// stacked-card visual so it reads as distinct from a plain photo bubble.
// Tapping opens MomentViewer once every item has finished uploading.

import { useState, useEffect, useMemo } from 'react'
import { getSignedUrl } from '../../services/MediaAssetService'

export default function MomentMessage({ message, isMe, onOpen }) {
  const assets = useMemo(
    () => [...(message.media_assets || [])].sort((a, b) => (a.moment_order || 0) - (b.moment_order || 0)),
    [message.media_assets]
  )
  const cover = assets.find(a => a.is_moment_cover) || assets[0]
  const [coverUrl, setCoverUrl] = useState(message._localPreviewUrls?.[assets.indexOf(cover)] || null)

  let title = null
  try { title = message.content ? JSON.parse(message.content)?.title : null } catch { /* not JSON, ignore */ }

  const total = assets.length
  const sentCount = assets.filter(a => a.upload_status === 'sent').length
  const anyFailed = assets.some(a => a.upload_status === 'failed')
  const allSent = total > 0 && sentCount === total

  useEffect(() => {
    if (!cover || cover.upload_status !== 'sent') return
    let cancelled = false
    getSignedUrl(cover.media_type, cover.thumbnail_path || cover.storage_path, { thumbnail: !!cover.thumbnail_path })
      .then(url => { if (!cancelled && url) setCoverUrl(url) })
    return () => { cancelled = true }
  }, [cover?.storage_path, cover?.thumbnail_path, cover?.upload_status])

  return (
    <button onClick={() => allSent && onOpen?.(message)} style={{ ...wrapStyle, cursor: allSent ? 'pointer' : 'default' }}>
      <div style={{ ...stackLayerStyle, transform: 'translate(6px, 6px) rotate(1.5deg)', opacity: 0.35 }} />
      <div style={{ ...stackLayerStyle, transform: 'translate(3px, 3px) rotate(-1deg)', opacity: 0.55 }} />

      <div style={coverCardStyle}>
        {coverUrl ? (
          <img src={coverUrl} alt={title || 'Moment'} style={coverImgStyle} />
        ) : (
          <div style={coverPlaceholderStyle}>✨</div>
        )}
        <div style={gradientOverlayStyle} />
        <div style={badgeStyle}>✨ Moment</div>
        <div style={captionOverlayStyle}>
          {title && <div style={momentTitleStyle}>{title}</div>}
          <div style={momentCountStyle}>
            {allSent ? `${total} ${total === 1 ? 'memory' : 'memories'}` :
              anyFailed ? '⚠ Some items failed to send' :
              `Sending… ${sentCount}/${total}`}
          </div>
        </div>
      </div>
    </button>
  )
}

const wrapStyle = { position: 'relative', border: 'none', background: 'none', padding: 0, width: 220, height: 220, display: 'block' }
const stackLayerStyle = { position: 'absolute', inset: 0, borderRadius: 18, background: 'var(--surface-card, rgba(148,120,255,0.18))', border: '1px solid var(--border-subtle, rgba(148,120,255,0.2))' }
const coverCardStyle = { position: 'relative', width: '100%', height: '100%', borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 10px 28px rgba(0,0,0,0.35)' }
const coverImgStyle = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
const coverPlaceholderStyle = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, background: 'linear-gradient(135deg, rgba(102,126,234,0.25), rgba(118,75,162,0.25))' }
const gradientOverlayStyle = { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.75) 100%)' }
const badgeStyle = { position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 20 }
const captionOverlayStyle = { position: 'absolute', left: 12, right: 12, bottom: 10, textAlign: 'left' }
const momentTitleStyle = { color: '#fff', fontSize: 14.5, fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,0.5)', marginBottom: 2 }
const momentCountStyle = { color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: 600 }
