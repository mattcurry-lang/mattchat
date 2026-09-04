// MediaViewer.jsx
// Full-screen viewer: swipe between a conversation's media messages,
// pinch/double-tap zoom on images, video playback, and the action bar.
//
// Phase 9: videos with a cf_stream_uid render via a Cloudflare Stream
// iframe using a short-lived signed token instead of fetching a Supabase
// Storage signed URL. Download is hidden for these — Cloudflare Stream
// doesn't hand back a plain downloadable file URL through this flow, and
// faking one would be worse than just not offering it.
//
// Phase 14: view-once assets request a much shorter signed-URL/token
// window (120s vs the usual hour) to shrink, not eliminate, the exposure
// after the asset is "consumed" — see the caveat in this thread.
//
// Phase 19: an optional "✨ Smart Media" menu appears for images/
// documents, calling the (currently stubbed) smart-media-action function.
//
// Phase 22: the media stage carries the same layoutId as the tapped
// bubble in MediaMessage, so opening morphs from the bubble's screen
// position rather than cutting straight to full-screen.

import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { getSignedUrl, deleteMediaAsset, markViewOnceViewed } from '../../services/MediaAssetService'
import { getStreamPlaybackToken, streamIframeUrl } from '../../services/CloudflareStreamService'
import { runSmartMediaAction, SMART_MEDIA_ACTIONS } from '../../services/SmartMediaService'
import { useReactions } from '../MessageReactions'
import { Z } from '../../lib/zLayers'

 
export default function MediaViewer({
  messages, initialMessageId, currentUserId, conversationId, onClose,
  onReply, onForward, onReact, onDeleted,
}) {
  const mediaMessages = useMemo(
    () => messages.filter(m => m.message_type === 'media' && m.media_assets?.[0] && m.media_assets[0].upload_status === 'sent'),
    [messages]
  )
  const [index, setIndex] = useState(() => Math.max(0, mediaMessages.findIndex(m => m.id === initialMessageId)))
  const [url, setUrl] = useState(null)
  const [iframeUrl, setIframeUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [viewOnceConsumed, setViewOnceConsumed] = useState(false)
  const [smartMenuOpen, setSmartMenuOpen] = useState(false)
  const [smartMessage, setSmartMessage] = useState(null)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragState = useRef(null)
  const lastTapRef = useRef(0)
  const pinchStartRef = useRef(null)

  const current = mediaMessages[index]
  const { reactions, toggleReaction } = useReactions(current?.id, currentUserId, conversationId)
  const [showReactionBar, setShowReactionBar] = useState(false)
  const asset = current?.media_assets?.[0]
  const isMe = current?.sender_id === currentUserId
  const isViewOnceGoneForMe = asset?.is_view_once && asset.viewed_at && !isMe
  const captionBottomOffset = (asset?.is_view_once && !isMe) ? 46 : 14 
  const isStreamVideo = asset?.media_type === 'video' && !!asset?.cf_stream_uid

  useEffect(() => {
    setZoom(1); setPan({ x: 0, y: 0 }); setViewOnceConsumed(false); setSmartMenuOpen(false); setSmartMessage(null)
    if (!asset || isViewOnceGoneForMe) { setUrl(null); setIframeUrl(null); setLoading(false); return }
    let cancelled = false
    setLoading(true)

    if (isStreamVideo) {
      getStreamPlaybackToken(asset.id).then(res => {
        if (cancelled) return
        if (res.ok) setIframeUrl(streamIframeUrl(res.token))
        setLoading(false)
        if (asset.is_view_once && !isMe && !asset.viewed_at) {
          markViewOnceViewed(asset.id, currentUserId).then(() => setViewOnceConsumed(true)).catch(() => {})
        }
      })
      return () => { cancelled = true }
    }

    getSignedUrl(asset.media_type, asset.storage_path, { expiresIn: asset.is_view_once ? 120 : 3600 }).then(u => {
      if (cancelled) return
      setUrl(u)
      setLoading(false)
      if (asset.is_view_once && !isMe && !asset.viewed_at) {
        markViewOnceViewed(asset.id, currentUserId).then(() => setViewOnceConsumed(true)).catch(() => {})
      }
    })
    return () => { cancelled = true }
  }, [current?.id]) 

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goTo(index - 1)
      if (e.key === 'ArrowRight') goTo(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index])  

  const goTo = (i) => { if (i >= 0 && i < mediaMessages.length) setIndex(i) }

  const onPointerDown = (e) => {
    if (zoom > 1) return
    const point = e.touches ? e.touches[0] : e
    dragState.current = { startX: point.clientX, dx: 0 }
  }
  const onPointerMove = (e) => {
    if (!dragState.current || zoom > 1) return
    const point = e.touches ? e.touches[0] : e
    dragState.current.dx = point.clientX - dragState.current.startX
  }
  const onPointerUp = () => {
    const d = dragState.current
    dragState.current = null
    if (!d) return
    if (d.dx > 80) goTo(index - 1)
    else if (d.dx < -80) goTo(index + 1)
  }

  const distance = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)

  const onTouchStart = (e) => {
    if (isStreamVideo) return // let the CF iframe own its own touch handling
    if (e.touches.length === 2) {
      pinchStartRef.current = { dist: distance(e.touches[0], e.touches[1]), zoom }
    } else if (e.touches.length === 1) {
      const now = Date.now()
      if (now - lastTapRef.current < 280) {
        setZoom(z => (z > 1 ? 1 : 2.5))
        setPan({ x: 0, y: 0 })
      }
      lastTapRef.current = now
      onPointerDown(e)
    }
  }
  const onTouchMove = (e) => {
    if (isStreamVideo) return
    if (e.touches.length === 2 && pinchStartRef.current) {
      const d = distance(e.touches[0], e.touches[1])
      const next = Math.min(4, Math.max(1, pinchStartRef.current.zoom * (d / pinchStartRef.current.dist)))
      setZoom(next)
    } else if (e.touches.length === 1) {
      if (zoom > 1 && dragState.current) {
        const point = e.touches[0]
        const dx = point.clientX - dragState.current.startX
        setPan(p => ({ x: p.x + dx * 0.3, y: p.y }))
        dragState.current.startX = point.clientX
      } else {
        onPointerMove(e)
      }
    }
  }
  const onTouchEnd = (e) => {
    if (isStreamVideo) return
    if (e.touches.length === 0) { pinchStartRef.current = null; onPointerUp() }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this media?')) return
    try {
      await deleteMediaAsset(asset)
      onDeleted?.(current)
      onClose()
    } catch (e) {
      alert('Could not delete this media: ' + e.message)
    }
  }

  const handleDownload = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url; a.download = asset.filename || 'download'
    a.click()
  }

  const handleShare = async () => {
    const shareUrl = url || iframeUrl
    if (navigator.share && shareUrl) {
      try { await navigator.share({ url: shareUrl, title: asset.filename }) } catch { /* user cancelled */ }
    } else if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      alert('Link copied')
    }
  }

  const handleSmartAction = async (actionId) => {
    setSmartMenuOpen(false)
    setSmartMessage('Working…')
    const res = await runSmartMediaAction(asset.id, actionId)
    setSmartMessage(res.ok ? 'Done ✓' : 'Smart Media features are coming soon ✨')
    setTimeout(() => setSmartMessage(null), 2200)
  }

  const availableSmartActions = asset ? SMART_MEDIA_ACTIONS.filter(a => a.mediaTypes.includes(asset.media_type)) : []

    if (!current) return null

  return createPortal(
    <div style={overlayStyle}>
      <div style={topBarStyle}>
        <button onClick={onClose} style={iconBtnStyle}><XIcon /></button>
        <span style={counterStyle}>{index + 1} / {mediaMessages.length}</span>
        <button onClick={() => setShowDetails(v => !v)} style={iconBtnStyle}><InfoIcon /></button>
      </div>

      <div
        style={stageStyle}
        onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onDoubleClick={() => { if (!isStreamVideo) { setZoom(z => (z > 1 ? 1 : 2.5)); setPan({ x: 0, y: 0 }) } }}
      >
        {isViewOnceGoneForMe ? (
          <div style={viewOnceStageStyle}>
            <div style={{ fontSize: 40 }}>👁️</div>
            <div>This media has already been viewed.</div>
          </div>
        ) : loading ? (
          <div style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</div>
        ) : isStreamVideo ? (
          iframeUrl ? (
            <iframe
              src={iframeUrl}
              style={streamIframeStyle}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
              title={asset.filename || 'video'}
            />
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.6)' }}>Video unavailable</div>
          )
        ) : asset.media_type === 'video' ? (
          <video src={url} controls autoPlay style={mediaTagStyle} />
        ) : (
          <motion.img
            layoutId={`media-${asset.id}`}
            src={url}
            alt={asset.filename || 'media'}
            style={{ ...mediaTagStyle, transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transition: dragState.current ? 'none' : 'transform 0.15s' }}
            draggable={false}
          />
        )}

        {asset.is_view_once && !isMe && (
          <div style={viewOnceNoticeStyle}>
            {viewOnceConsumed ? 'This will disappear once you close it' : 'View once'}
          </div>
        )}
      </div>

      {mediaMessages.length > 1 && zoom === 1 && (
        <>
          <button onClick={() => goTo(index - 1)} disabled={index === 0} style={{ ...navArrowStyle, left: 12, opacity: index === 0 ? 0.25 : 1 }}><ChevronIcon dir="left" /></button>
          <button onClick={() => goTo(index + 1)} disabled={index === mediaMessages.length - 1} style={{ ...navArrowStyle, right: 12, opacity: index === mediaMessages.length - 1 ? 0.25 : 1 }}><ChevronIcon dir="right" /></button>
        </>
      )}

      {showDetails && (
        <div style={detailsPanelStyle}>
          <div style={detailsRowStyle}><span>Filename</span><span>{asset.filename}</span></div>
          <div style={detailsRowStyle}><span>Size</span><span>{asset.size_bytes ? `${(asset.size_bytes / 1024 / 1024).toFixed(2)} MB` : '—'}</span></div>
          {asset.width && <div style={detailsRowStyle}><span>Dimensions</span><span>{asset.width} × {asset.height}</span></div>}
          {asset.duration && <div style={detailsRowStyle}><span>Duration</span><span>{Math.round(asset.duration)}s</span></div>}
          <div style={detailsRowStyle}><span>Sent</span><span>{new Date(current.created_at).toLocaleString()}</span></div>
          {isStreamVideo && <div style={detailsRowStyle}><span>Hosted via</span><span>Cloudflare Stream</span></div>}
        </div>
      )}

      {smartMenuOpen && (
        <div style={smartMenuStyle}>
          {availableSmartActions.map(a => (
            <button key={a.id} onClick={() => handleSmartAction(a.id)} style={smartMenuItemStyle}>{a.label}</button>
          ))}
        </div>
      )}

      {smartMessage && <div style={smartToastStyle}>{smartMessage}</div>}
 

{current.content && !isViewOnceGoneForMe && (
  <div style={{ ...captionOverlayStyle, bottom: captionBottomOffset }}>{current.content}</div>
)}
      {showReactionBar && (
  <div style={reactionBarStyle}>
    {['❤️','😂','😮','😢','🙏','👍'].map(emoji => (
      <button
        key={emoji}
        onClick={() => { toggleReaction(emoji); setShowReactionBar(false) }}
        style={reactionEmojiBtnStyle}
      >{emoji}</button>
    ))}
  </div>
)}
      {!isViewOnceGoneForMe && (
        <div style={actionBarStyle}>
          {!isStreamVideo && <ActionBtn icon={<DownloadIcon />} label="Save" onClick={handleDownload} />}
          <ActionBtn icon={<ForwardIcon />} label="Forward" onClick={() => onForward?.(current)} />
          <ActionBtn icon={<ReplyIcon />} label="Reply" onClick={() => { onReply?.(current); onClose() }} />
         <ActionBtn icon={<HeartIcon />} label="React" onClick={() => setShowReactionBar(v => !v)} />
          <ActionBtn icon={<ShareIcon />} label="Share" onClick={handleShare} />
          {availableSmartActions.length > 0 && (
            <ActionBtn icon={<SparkleIcon />} label="Smart" onClick={() => setSmartMenuOpen(v => !v)} />
          )}
          {isMe && <ActionBtn icon={<TrashIcon />} label="Delete" onClick={handleDelete} danger />}
        </div>
      )}
    </div>,
    document.body
  )
}
function ActionBtn({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ ...actionBtnStyle, color: danger ? '#f87171' : '#fff' }}>
      {icon}
      <span style={actionLabelStyle}>{label}</span>
    </button>
  )
}

const svgProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
function XIcon() { return <svg {...svgProps} width={16} height={16}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> }
function InfoIcon() { return <svg {...svgProps} width={16} height={16}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg> }
function ChevronIcon({ dir }) { return <svg {...svgProps} width={22} height={22}>{dir === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}</svg> }
function DownloadIcon() { return <svg {...svgProps}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg> }
function ForwardIcon() { return <svg {...svgProps}><polyline points="15 17 20 12 15 7" /><path d="M4 18v-2a4 4 0 0 1 4-4h12" /></svg> }
function ReplyIcon() { return <svg {...svgProps}><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg> }
function HeartIcon() { return <svg {...svgProps}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg> }
function ShareIcon() { return <svg {...svgProps}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></svg> }
function TrashIcon() { return <svg {...svgProps}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg> }
function SparkleIcon() { return <svg {...svgProps}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg> }

const overlayStyle = { position: 'fixed', inset: 0, zIndex: Z.viewer, background: '#000', display: 'flex', flexDirection: 'column' }
const topBarStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', zIndex: 2 }
const counterStyle = { color: '#fff', fontWeight: 600, fontSize: 13 }
const iconBtnStyle = { width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const stageStyle = { flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' }
const mediaTagStyle = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none' }
const streamIframeStyle = { width: '100%', height: '100%', border: 'none' }
const viewOnceStageStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.7)', fontSize: 13 }
const viewOnceNoticeStyle = { position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11.5, fontWeight: 600, padding: '5px 12px', borderRadius: 20 }
const navArrowStyle = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.35)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }
const detailsPanelStyle = { position: 'absolute', top: 56, right: 16, background: 'rgba(20,18,30,0.96)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 14, minWidth: 200, zIndex: 3 }
const detailsRowStyle = { display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12, color: 'rgba(255,255,255,0.85)', padding: '4px 0' }
const smartMenuStyle = { position: 'absolute', bottom: 92, right: 16, background: 'rgba(20,18,30,0.96)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 14, padding: 6, display: 'flex', flexDirection: 'column', zIndex: 3, minWidth: 180 }
const smartMenuItemStyle = { background: 'none', border: 'none', color: '#e5e7eb', fontSize: 13, textAlign: 'left', padding: '9px 10px', cursor: 'pointer', borderRadius: 8, fontFamily: 'inherit' }
const smartToastStyle = { position: 'absolute', bottom: 92, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 20, zIndex: 3 }
const actionBarStyle = { display: 'flex', justifyContent: 'space-around', padding: '14px 8px max(14px, env(safe-area-inset-bottom))', background: 'rgba(15,13,22,0.9)' }
const actionBtnStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer' }
const actionLabelStyle = { fontSize: 10, fontWeight: 600 }
const captionOverlayStyle = {
  position: 'absolute', left: 16, right: 16,
  background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 13.5, lineHeight: 1.4,
  padding: '8px 14px', borderRadius: 14, textAlign: 'center',
}
// New styles:
const reactionBarStyle = {
  position: 'absolute', bottom: 92, left: '50%', transform: 'translateX(-50%)',
  display: 'flex', gap: 4, background: 'rgba(20,18,30,0.96)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 30,
  padding: '6px 8px', zIndex: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}
const reactionEmojiBtnStyle = {
  background: 'none', border: 'none', fontSize: 24, cursor: 'pointer',
  padding: '4px 6px', borderRadius: '50%', lineHeight: 1,
}
