// MomentViewer.jsx
// Full-screen swipe-through viewer scoped to ONE Moment's assets (sorted
// by moment_order) — distinct from MediaViewer, which swipes across a
// whole conversation's separate media messages.

import { useState, useEffect, useMemo, useRef } from 'react'
import { getSignedUrl, deleteMediaAsset } from '../../services/MediaAssetService'

export default function MomentViewer({ message, currentUserId, onClose, onDeleted }) {
  const assets = useMemo(
    () => [...(message.media_assets || [])].sort((a, b) => (a.moment_order || 0) - (b.moment_order || 0)),
    [message.media_assets]
  )
  let title = null
  try { title = message.content ? JSON.parse(message.content)?.title : null } catch { /* ignore */ }

  const [index, setIndex] = useState(0)
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState(1)
  const dragState = useRef(null)
  const lastTapRef = useRef(0)

  const current = assets[index]
  const isMe = message.sender_id === currentUserId

  useEffect(() => {
    setZoom(1)
    if (!current) return
    let cancelled = false
    setLoading(true)
    getSignedUrl(current.media_type, current.storage_path).then(u => { if (!cancelled) { setUrl(u); setLoading(false) } })
    return () => { cancelled = true }
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goTo(index - 1)
      if (e.key === 'ArrowRight') goTo(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (i) => { if (i >= 0 && i < assets.length) setIndex(i) }

  const onPointerDown = (e) => {
    if (zoom > 1) return
    const point = e.touches ? e.touches[0] : e
    dragState.current = { startX: point.clientX }
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
  const onTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current < 280) setZoom(z => (z > 1 ? 1 : 2.5))
    lastTapRef.current = now
  }

  const handleDownload = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url; a.download = current.filename || 'download'
    a.click()
  }

  const handleDeleteItem = async () => {
    if (!window.confirm(assets.length === 1 ? 'Delete this Moment?' : 'Remove this item from the Moment?')) return
    try {
      await deleteMediaAsset(current)
      onDeleted?.(current)
      if (assets.length <= 1) { onClose(); return }
      goTo(Math.max(0, index - 1))
    } catch (e) {
      alert('Could not delete: ' + e.message)
    }
  }

  if (!current) return null

  return (
    <div style={overlayStyle}>
      <div style={topBarStyle}>
        <button onClick={onClose} style={iconBtnStyle}>✕</button>
        <div style={titleWrapStyle}>
          {title && <div style={titleTextStyle}>✨ {title}</div>}
          <div style={counterStyle}>{index + 1} / {assets.length}</div>
        </div>
        <span style={{ width: 34 }} />
      </div>

      <div
        style={stageStyle}
        onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
        onTouchStart={(e) => { onTap(); onPointerDown(e) }} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
      >
        {loading || !url ? (
          <div style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</div>
        ) : current.media_type === 'video' ? (
          <video src={url} controls autoPlay style={mediaTagStyle} />
        ) : (
          <img src={url} alt="" style={{ ...mediaTagStyle, transform: `scale(${zoom})`, transition: 'transform 0.15s' }} draggable={false} />
        )}
      </div>

      {assets.length > 1 && zoom === 1 && (
        <div style={dotsRowStyle}>
          {assets.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} style={{ ...dotStyle, opacity: i === index ? 1 : 0.35 }} />
          ))}
        </div>
      )}

      <div style={actionBarStyle}>
        <button onClick={handleDownload} style={actionBtnStyle}>⬇ Save</button>
        {isMe && <button onClick={handleDeleteItem} style={{ ...actionBtnStyle, color: '#f87171' }}>🗑 {assets.length === 1 ? 'Delete Moment' : 'Remove item'}</button>}
      </div>
    </div>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 90, background: '#000', display: 'flex', flexDirection: 'column' }
const topBarStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }
const iconBtnStyle = { width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer' }
const titleWrapStyle = { textAlign: 'center' }
const titleTextStyle = { color: '#fff', fontWeight: 700, fontSize: 13.5 }
const counterStyle = { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }
const stageStyle = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' }
const mediaTagStyle = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none' }
const dotsRowStyle = { display: 'flex', justifyContent: 'center', gap: 6, padding: '10px 0' }
const dotStyle = { width: 6, height: 6, borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer' }
const actionBarStyle = { display: 'flex', justifyContent: 'center', gap: 24, padding: '12px 0 max(14px, env(safe-area-inset-bottom))', background: 'rgba(15,13,22,0.9)' }
const actionBtnStyle = { background: 'none', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }
