// MediaMessage.jsx
// The bubble dispatcher for message_type === 'media'. Renders per media_type
// (image/video/audio/document/gif) and drives the upload-state UI: preparing
// → uploading NN% → processing → sent, or failed with a Resume button.
// Tapping an image/video opens MediaViewer.
//
// Phase 9: video thumbnails come from Cloudflare Stream (token-gated) when
// asset.cf_stream_uid is set, falling back to the normal Supabase signed
// thumbnail/original otherwise — same fallback the upload path itself uses.
//
// Phase 22: the thumbnail wrapper carries a shared layoutId so opening
// MediaViewer morphs from the bubble's position/size into the full-screen
// stage instead of just cutting to it; a brief highlight pulses once when
// upload_status first reaches 'sent'.

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import AudioPreview from './AudioPreview'
import { getSignedUrl } from '../../services/MediaAssetService'
import { getStreamPlaybackToken, streamThumbnailUrl } from '../../services/CloudflareStreamService'

const EXT_ICON = {
  pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
  ppt: '📙', pptx: '📙', txt: '📄', csv: '📊', zip: '🗂️',
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function StatusRow({ status, progress, retryUnavailable, onResume }) {
  if (status === 'sent') return null
  if (status === 'preparing') return <span style={statusTextStyle}><Spinner /> Preparing…</span>
  if (status === 'uploading') return <span style={statusTextStyle}>↑ Uploading {Math.round(progress || 0)}%</span>
  if (status === 'processing') return <span style={statusTextStyle}><Spinner /> Processing…</span>
  if (status === 'failed') {
    return (
      <span style={{ ...statusTextStyle, color: '#f87171' }}>
        ⚠ Connection interrupted
        {retryUnavailable ? (
          <span style={{ opacity: 0.75 }}>· re-select the file to retry</span>
        ) : (
          <button onClick={onResume} style={resumeBtnStyle}>Resume</button>
        )}
      </span>
    )
  }
  return null
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.25)', borderTopColor: 'var(--accent, #a78bfa)',
      animation: 'mm-spin 0.8s linear infinite', marginRight: 2,
    }}>
      <style>{`@keyframes mm-spin { to { transform: rotate(360deg) } }`}</style>
    </span>
  )
}

export default function MediaMessage({ message, isMe, onOpenViewer, onRetry }) {
  const asset = message.media_assets?.[0]
  const [signedUrl, setSignedUrl] = useState(message._localPreviewUrl || null)
  const [thumbUrl, setThumbUrl] = useState(message._localPreviewUrl || null)

  const prevStatusRef = useRef(asset?.upload_status)
  const [justSent, setJustSent] = useState(false)

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = asset?.upload_status
    if (prev && prev !== 'sent' && asset?.upload_status === 'sent') {
      setJustSent(true)
      const t = setTimeout(() => setJustSent(false), 650)
      return () => clearTimeout(t)
    }
  }, [asset?.upload_status])

  useEffect(() => {
    if (!asset || asset.upload_status !== 'sent') return
    let cancelled = false

    if (asset.cf_stream_uid) {
      getStreamPlaybackToken(asset.id).then((res) => {
        if (cancelled || !res.ok) return
        const thumb = streamThumbnailUrl(res.token)
        if (thumb) setThumbUrl(thumb)
      })
      return () => { cancelled = true }
    }

    getSignedUrl(asset.media_type, asset.storage_path).then(url => { if (!cancelled && url) setSignedUrl(url) })
    if (asset.thumbnail_path) {
      getSignedUrl(asset.media_type, asset.thumbnail_path, { thumbnail: true }).then(url => { if (!cancelled && url) setThumbUrl(url) })
    }
    return () => { cancelled = true }
  }, [asset?.storage_path, asset?.thumbnail_path, asset?.upload_status, asset?.cf_stream_uid])

  if (!asset) return null

  const isViewOnceUnavailable = asset.is_view_once && asset.viewed_at && !isMe
  const url = signedUrl
  const displayThumb = thumbUrl || url

  if (asset.media_type === 'document') {
    const ext = asset.filename?.split('.').pop()?.toLowerCase()
    return (
      <div style={docCardStyle}>
        <span style={{ fontSize: 26 }}>{EXT_ICON[ext] || '📄'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={docNameStyle}>{asset.filename}</div>
          <div style={docSizeStyle}>{formatSize(asset.size_bytes)}</div>
          <StatusRow status={asset.upload_status} progress={asset.upload_progress} retryUnavailable={message._retryUnavailable} onResume={() => onRetry?.(message)} />
        </div>
        {asset.upload_status === 'sent' && url && (
          <div style={{ display: 'flex', gap: 6 }}>
            <a href={url} target="_blank" rel="noreferrer" style={docActionStyle}>Preview</a>
            <a href={url} download={asset.filename} style={docActionStyle}>Download</a>
          </div>
        )}
      </div>
    )
  }

  if (asset.media_type === 'audio') {
    return (
      <div>
        {asset.upload_status === 'sent' && url ? (
          <AudioPreview src={url} filename={asset.filename} />
        ) : (
          <div style={{ ...docCardStyle, minWidth: 200 }}>
            <span style={{ fontSize: 22 }}>🎵</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={docNameStyle}>{asset.filename}</div>
              <StatusRow status={asset.upload_status} progress={asset.upload_progress} retryUnavailable={message._retryUnavailable} onResume={() => onRetry?.(message)} />
            </div>
          </div>
        )}
      </div>
    )
  }

  const isVideo = asset.media_type === 'video'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={() => asset.upload_status === 'sent' && !isViewOnceUnavailable && onOpenViewer?.(message)}
        style={{
          ...mediaThumbWrapStyle,
          cursor: asset.upload_status === 'sent' ? 'pointer' : 'default',
          aspectRatio: asset.width && asset.height ? `${asset.width}/${asset.height}` : '4/3',
          boxShadow: justSent ? '0 0 0 3px rgba(124,92,255,0.55)' : '0 0 0 0 rgba(124,92,255,0)',
          transition: 'box-shadow 0.5s ease',
        }}
      >
        <motion.div layoutId={`media-${asset.id}`} style={{ position: 'absolute', inset: 0 }}>
          {isViewOnceUnavailable ? (
            <div style={viewOnceGoneStyle}>
              <span style={{ fontSize: 20 }}>👁️</span>
              <span>Opened</span>
            </div>
          ) : displayThumb ? (
            <img src={displayThumb} alt={asset.filename || 'media'} style={mediaImgStyle} />
          ) : (
            <div style={mediaPlaceholderStyle}>{isVideo ? '🎬' : '🖼️'}</div>
          )}
        </motion.div>

        {asset.is_view_once && !isViewOnceUnavailable && <span style={viewOnceBadgeStyle}>1</span>}
        {isVideo && !isViewOnceUnavailable && asset.upload_status === 'sent' && <span style={playOverlayStyle}>▶</span>}

        {asset.upload_status !== 'sent' && (
          <div style={uploadOverlayStyle}>
            {asset.upload_status === 'uploading' && (
              <div style={progressRingWrap}>
                <svg width="36" height="36" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.5" fill="none" stroke="#fff" strokeWidth="3"
                    strokeDasharray={2 * Math.PI * 15.5}
                    strokeDashoffset={2 * Math.PI * 15.5 * (1 - (asset.upload_progress || 0) / 100)}
                    strokeLinecap="round" transform="rotate(-90 18 18)"
                  />
                </svg>
                <span style={progressPctStyle}>{Math.round(asset.upload_progress || 0)}%</span>
              </div>
            )}
            {asset.upload_status === 'failed' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20 }}>⚠</div>
                {!message._retryUnavailable && (
                  <button onClick={(e) => { e.stopPropagation(); onRetry?.(message) }} style={resumeBtnStyleDark}>Resume</button>
                )}
              </div>
            )}
            {(asset.upload_status === 'preparing' || asset.upload_status === 'processing') && <Spinner />}
          </div>
        )}
      </button>
      {message.content && <div style={captionStyle}>{message.content}</div>}
    </div>
  )
}

const statusTextStyle = { fontSize: 11.5, color: 'var(--text-secondary, #c9c4dd)', display: 'inline-flex', alignItems: 'center', gap: 6 }
const resumeBtnStyle = { fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--accent, #7c5cff)', border: 'none', borderRadius: 10, padding: '3px 9px', cursor: 'pointer' }
const resumeBtnStyleDark = { fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 10, padding: '4px 10px', cursor: 'pointer', marginTop: 4 }

const docCardStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'var(--surface-card, rgba(148,120,255,0.08))', border: '1px solid var(--border-subtle, rgba(148,120,255,0.16))', minWidth: 220 }
const docNameStyle = { fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary, #f2f0f8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const docSizeStyle = { fontSize: 11, color: 'var(--text-secondary, #c9c4dd)', marginTop: 1 }
const docActionStyle = { fontSize: 11, fontWeight: 700, color: 'var(--accent, #a78bfa)', textDecoration: 'none', padding: '4px 8px', borderRadius: 8, background: 'rgba(167,139,250,0.12)' }

const mediaThumbWrapStyle = { position: 'relative', maxWidth: 260, width: '100%', borderRadius: 16, overflow: 'hidden', border: 'none', padding: 0, background: 'rgba(0,0,0,0.2)' }
const mediaImgStyle = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
const mediaPlaceholderStyle = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, minHeight: 140 }
const playOverlayStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }
const uploadOverlayStyle = { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }
const progressRingWrap = { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const progressPctStyle = { position: 'absolute', fontSize: 10, fontWeight: 700, color: '#fff' }
const viewOnceBadgeStyle = { position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const viewOnceGoneStyle = { width: '100%', minHeight: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-secondary, #c9c4dd)', fontSize: 11 }
const captionStyle = { fontSize: 13, color: 'var(--text-primary, #f2f0f8)', padding: '0 2px', maxWidth: 260 }
