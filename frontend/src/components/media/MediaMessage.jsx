// MediaMessage.jsx
// The bubble dispatcher for message_type === 'media'. Renders per media_type
// (image/video/audio/document/gif/contact) and drives the upload-state UI: preparing
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
//
// FIX (doc card overflow): docCardStyle had a minWidth but no maxWidth, so
// a long filename like "G5_Exam_Timetable_August_2026_FINAL.12.08.2026.xlsx"
// just grew the whole bubble instead of ellipsizing — the ellipsis CSS on
// docNameStyle only ever engages once its container is actually bounded.
// Added a maxWidth (matching the image/video bubble's cap) so long
// filenames truncate instead of blowing out the layout, while still leaving
// room for a real Word/Excel/PDF filename to read comfortably on one line.
//
// STYLE PASS: swapped the emoji glyphs (file-type icons, audio note, video/
// image placeholders, warning, view-once eye) for small SVG badges — same
// approach used across MediaStudio/MediaPicker/MediaComposer. Theme vars
// (var(--accent...), var(--text-primary...)) are intentionally left as-is
// here, unlike those overlay components — message bubbles live inside the
// regular themed chat surface, which already light/dark-toggles correctly,
// so hardcoding here would actually break theme support rather than fix a bug.
//
// 'contact' media_type — renders a shared-contact bubble.
//
// SIZE/POLISH PASS (photo & video bubbles only): researched current chat-UI
// convention (WhatsApp's July 2026 iOS redesign, general chat-UX guidance) —
// two consistent signals: (1) media runs bigger than a cramped 260px cap —
// closer to the actual message-column width, and (2) the hard border around
// media is gone in favor of a soft shadow, letting the image/video itself
// be the edge instead of framing it. Applied both here: MEDIA_MAX_WIDTH
// raised 260 → 320, mediaThumbWrapStyle's border removed in favor of a
// layered shadow, corner radius opened up slightly (16 → 18) to match the
// larger size, and the caption/placeholder widths follow the same cap so
// nothing looks mismatched next to the bigger image. Doc/contact/audio
// cards are deliberately NOT touched — those are utility rows, not the
// "wow" surface — and none of the underlying upload/view-once/Cloudflare
// logic changed, only the box these render inside.

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import AudioPreview from './AudioPreview'
import Avatar from '../Avatar'
import { getSignedUrl } from '../../services/MediaAssetService'
import { getStreamPlaybackToken, streamThumbnailUrl } from '../../services/CloudflareStreamService'

// ---- small SVG badges (no emoji) ----

const EXT_STYLE = {
  pdf: { label: 'PDF', gradient: 'linear-gradient(135deg, #FF5F5F 0%, #E4293D 100%)' },
  doc: { label: 'DOC', gradient: 'linear-gradient(135deg, #38A3F5 0%, #2F6FE4 100%)' },
  docx: { label: 'DOC', gradient: 'linear-gradient(135deg, #38A3F5 0%, #2F6FE4 100%)' },
  xls: { label: 'XLS', gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)' },
  xlsx: { label: 'XLS', gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)' },
  ppt: { label: 'PPT', gradient: 'linear-gradient(135deg, #FFB84D 0%, #FF7A45 100%)' },
  pptx: { label: 'PPT', gradient: 'linear-gradient(135deg, #FFB84D 0%, #FF7A45 100%)' },
  txt: { label: 'TXT', gradient: 'linear-gradient(135deg, #9BA4B5 0%, #5C6478 100%)' },
  csv: { label: 'CSV', gradient: 'linear-gradient(135deg, #34D1BF 0%, #2A9D8F 100%)' },
  zip: { label: 'ZIP', gradient: 'linear-gradient(135deg, #C86DD7 0%, #7F5FFF 100%)' },
}
const DEFAULT_EXT_STYLE = { label: 'FILE', gradient: 'linear-gradient(135deg, #9BA4B5 0%, #5C6478 100%)' }

function FileTypeBadge({ ext, size = 40 }) {
  const s = EXT_STYLE[ext] || DEFAULT_EXT_STYLE
  return (
    <span
      style={{
        width: size, height: size, borderRadius: 11, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: s.gradient, color: '#fff', fontSize: size * 0.26, fontWeight: 800,
        letterSpacing: 0.2,
      }}
    >
      {s.label}
    </span>
  )
}

const IconMusic = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M9 18V5l11-2v13" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth={1.8} />
    <circle cx="17" cy="16" r="3" stroke="currentColor" strokeWidth={1.8} />
  </svg>
)
const IconFilm = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth={1.8} />
    <path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" stroke="currentColor" strokeWidth={1.8} />
  </svg>
)
const IconImage = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth={1.8} />
    <circle cx="9" cy="10" r="1.6" fill="currentColor" />
    <path d="M4.5 17.5l5-5 3.5 3.5 3-3 4 4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconPlay = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7L8 5z" />
  </svg>
)
const IconAlert = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 3l10 18H2L12 3z" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M12 10v4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    <circle cx="12" cy="17" r="1" fill="currentColor" />
  </svg>
)
const IconEyeOff = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M3 3l18 18M10.6 10.6a2.5 2.5 0 003.5 3.5M6.5 6.7C4.4 8.1 3 10 3 12c0 0 3.5 6 9 6 1.7 0 3.2-.5 4.5-1.3M9.9 5.2A9.7 9.7 0 0112 5c5.5 0 9 6 9 6-.4.7-1 1.6-1.8 2.5"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconUserCard = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth={1.8} />
    <circle cx="9" cy="11.2" r="2.1" stroke="currentColor" strokeWidth={1.8} />
    <path d="M6 16c.6-1.5 1.8-2.3 3-2.3s2.4.8 3 2.3M14.5 10h4M14.5 13h4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
  </svg>
)

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
        <IconAlert size={12} /> Connection interrupted
        {retryUnavailable ? (
          <span style={{ opacity: 0.75 }}>· re-select the file to retry</span>
        ) : (
          <motion.button whileTap={{ scale: 0.9 }} onClick={onResume} style={resumeBtnStyle}>Resume</motion.button>
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

export default function MediaMessage({ message, isMe, onOpenViewer, onRetry, onOpenProfile, currentUserId }) {
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
    if (asset.media_type === 'contact') return // no file to sign for a contact card
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
  }, [asset?.storage_path, asset?.thumbnail_path, asset?.upload_status, asset?.cf_stream_uid, asset?.media_type])

  if (!asset) return null

  const isViewOnceUnavailable = asset.is_view_once && asset.viewed_at && !isMe
  const url = signedUrl
  const displayThumb = thumbUrl || url

  if (asset.media_type === 'contact') {
    const isSelf = asset.contact_id === currentUserId
    return (
      <button
        onClick={() => onOpenProfile?.(asset.contact_id)}
        style={contactCardStyle}
      >
        <Avatar name={asset.contact_username || asset.contact_email} photoUrl={asset.contact_avatar_url} size={44} />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={docNameStyle}>
            {asset.contact_username || 'Unnamed'}{isSelf ? ' (You)' : ''}
          </div>
          <div style={docSizeStyle}>{asset.contact_email}</div>
        </div>
        <span style={contactCardBadgeStyle}><IconUserCard size={14} /> Contact</span>
      </button>
    )
  }

  if (asset.media_type === 'document') {
    const ext = asset.filename?.split('.').pop()?.toLowerCase()
    return (
      <div style={docCardStyle}>
        <FileTypeBadge ext={ext} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={docNameStyle} title={asset.filename}>{asset.filename}</div>
          <div style={docSizeStyle}>{formatSize(asset.size_bytes)}</div>
          <StatusRow status={asset.upload_status} progress={asset.upload_progress} retryUnavailable={message._retryUnavailable} onResume={() => onRetry?.(message)} />
        </div>
        {asset.upload_status === 'sent' && url && (
          <div style={docActionsStyle}>
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
            <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-card, rgba(148,120,255,0.14))', color: 'var(--accent, #a78bfa)' }}>
              <IconMusic size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={docNameStyle} title={asset.filename}>{asset.filename}</div>
              <StatusRow status={asset.upload_status} progress={asset.upload_progress} retryUnavailable={message._retryUnavailable} onResume={() => onRetry?.(message)} />
            </div>
          </div>
        )}
      </div>
    )
  }

 const isVideo = asset.media_type === 'video'
return (
// In MediaMessage.jsx — replace the wrapper div's style with this:

<div style={{
  display: 'flex', flexDirection: 'column', gap: 4,
  width: MEDIA_MAX_WIDTH_CSS,
}}>
    <button
      onClick={() => asset.upload_status === 'sent' && !isViewOnceUnavailable && onOpenViewer?.(message)}
      style={{
        ...mediaThumbWrapStyle,
        cursor: asset.upload_status === 'sent' ? 'pointer' : 'default',
        aspectRatio: asset.width && asset.height ? `${asset.width}/${asset.height}` : '4/3',
        boxShadow: justSent
          ? '0 0 0 3px rgba(124,92,255,0.55), 0 10px 28px rgba(0,0,0,0.35)'
          : mediaThumbWrapStyle.boxShadow,
        transition: 'box-shadow 0.5s ease',
      }}
    >
        <motion.div layoutId={`media-${asset.id}`} style={{ position: 'absolute', inset: 0 }}>
          {isViewOnceUnavailable ? (
            <div style={viewOnceGoneStyle}>
              <IconEyeOff size={20} />
              <span>Opened</span>
            </div>
          ) : displayThumb ? (
            <img src={displayThumb} alt={asset.filename || 'media'} style={mediaImgStyle} />
          ) : (
            <div style={mediaPlaceholderStyle}>{isVideo ? <IconFilm size={26} /> : <IconImage size={26} />}</div>
          )}
        </motion.div>

        {asset.is_view_once && !isViewOnceUnavailable && <span style={viewOnceBadgeStyle}>1</span>}
        {isVideo && !isViewOnceUnavailable && asset.upload_status === 'sent' && (
          <span style={playOverlayStyle}><IconPlay size={22} /></span>
        )}

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
  style={{ transition: 'stroke-dashoffset 0.15s linear' }}
/>
                </svg>
                <span style={progressPctStyle}>{Math.round(asset.upload_progress || 0)}%</span>
              </div>
            )}
            {asset.upload_status === 'failed' && (
              <div style={{ textAlign: 'center' }}>
                <IconAlert size={20} />
                {!message._retryUnavailable && (
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={(e) => { e.stopPropagation(); onRetry?.(message) }}
                    style={resumeBtnStyleDark}
                  >
                    Resume
                  </motion.button>
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

// FIX: added maxWidth (was minWidth-only, so long filenames grew the whole
// bubble instead of ellipsizing) and trimmed minWidth slightly so short
// filenames don't look artificially padded.
const docCardStyle = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14,
  background: 'var(--surface-card, rgba(148,120,255,0.08))',
  border: '1px solid var(--border-subtle, rgba(148,120,255,0.16))',
  minWidth: 200, maxWidth: 280, boxSizing: 'border-box',
}
const docNameStyle = { fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary, #f2f0f8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const docSizeStyle = { fontSize: 11, color: 'var(--text-secondary, #c9c4dd)', marginTop: 1 }
const docActionsStyle = { display: 'flex', gap: 6, flexShrink: 0 }
const docActionStyle = { fontSize: 11, fontWeight: 700, color: 'var(--accent, #a78bfa)', textDecoration: 'none', padding: '4px 8px', borderRadius: 8, background: 'rgba(167,139,250,0.12)', whiteSpace: 'nowrap' }

const contactCardStyle = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14,
  background: 'var(--surface-card, rgba(148,120,255,0.08))',
  border: '1px solid var(--border-subtle, rgba(148,120,255,0.16))',
  minWidth: 220, maxWidth: 280, boxSizing: 'border-box',
  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
}
const contactCardBadgeStyle = {
  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
  fontSize: 10.5, fontWeight: 700, color: 'var(--accent, #a78bfa)',
  background: 'rgba(167,139,250,0.12)', borderRadius: 8, padding: '4px 7px',
}

// SIZE/POLISH PASS: 260 → 320. This is the single biggest lever for "wow" —
// everything else here is finish work around that larger canvas.
const MEDIA_MAX_WIDTH_CSS = 'clamp(220px, 68vw, 300px)'

// Border removed (was `border: '1px solid rgba(148,120,255,0.16)'`-style
// framing inherited from the doc card) in favor of a two-layer shadow: a
// tight contact shadow for edge definition + a soft ambient one for lift.
// This is the change that makes it read as a "photo card" instead of a
// bordered thumbnail — matches the borderless-media direction WhatsApp
// shipped on iOS.
const mediaThumbWrapStyle = {
  position: 'relative', width: '100%',
  borderRadius: 18, overflow: 'hidden', border: 'none', padding: 0,
  background: 'rgba(0,0,0,0.2)',
  boxShadow: '0 1px 2px rgba(0,0,0,0.24), 0 8px 20px rgba(0,0,0,0.28)',
}
const mediaImgStyle = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
const mediaPlaceholderStyle = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', minHeight: 170 }
// Slightly bigger + softer play button to match the larger canvas.
const playOverlayStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(2px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }
const uploadOverlayStyle = { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }
const progressRingWrap = { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const progressPctStyle = { position: 'absolute', fontSize: 10, fontWeight: 700, color: '#fff' }
const viewOnceBadgeStyle = { position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const viewOnceGoneStyle = { width: '100%', minHeight: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-secondary, #c9c4dd)', fontSize: 11 }
const captionStyle = { fontSize: 13, color: 'var(--text-primary, #f2f0f8)', padding: '0 2px', maxWidth: MEDIA_MAX_WIDTH_CSS }
