// MediaPicker.jsx
// Full-screen "review & select" gallery shown after the browser's native
// file input returns files — opens when the user taps Photos/Videos (or
// "Create Moment", via the `heading` override) in MediaStudio, routed
// here by MediaAttachmentFlow. Photos and videos both land here; editing
// happens downstream in MediaComposer, not in this screen — this screen's
// only job is: pick files, put them in the right order, hand them off.
//
// CONTRACT (matches MediaAttachmentFlow.jsx exactly):
//   props: { isOpen, onClose, onConfirm, accept, heading }
//   onConfirm(orderedItems) — called ONCE with the full ordered array,
//   orderedItems: [{ file, mediaType }], mediaType is 'image' | 'video'
//   only. GIFs are intentionally tagged 'image' here too (matching
//   classifyDroppedFile's drag-and-drop path), so a GIF picked here and
//   a GIF dropped on the window behave identically once they reach
//   MediaComposer. The GIF badge below is purely a visual cue in this
//   screen — it doesn't change the mediaType that goes out.
//
// WHY THIS SHAPE, NOT A FAKE OS GALLERY BROWSER:
// Mattchat is a web app, so the browser has no API to browse someone's
// actual photo library the way iOS's native picker can — that access is
// OS-sandboxed. The honest, buildable equivalent (and what Telegram Web /
// WhatsApp Web / Instagram actually ship) is: trigger the native file
// input, then give the user a rich in-app screen to reorder, preview,
// and prune before it moves on to MediaComposer. That's this file.
//
// DESIGN NOTES:
//   - Numbered/ordered review list + live "Add (n)" header counter,
//     following the pattern iOS 14+'s Photos picker popularized.
//   - Drag-across-cells multi-select is flagged as genuinely unreliable
//     even in Apple's own picker (see iOS developer forum reports), so
//     reordering uses Framer Motion's `Reorder` primitive instead — a
//     well-tested drag interaction, applied to order rather than select.
//   - No backdrop-filter blur per-tile; kept only on the sticky header,
//     since per-card blur is a known frame-rate cost on low-end Android.

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'

// ---- self-contained icons (no emoji) ----

const IconPlus = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
)
const IconTrash = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m-8 0l1 13a2 2 0 002 2h4a2 2 0 002-2l1-13"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconPlay = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7L8 5z" />
  </svg>
)
const IconGrip = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="8" cy="6" r="1.4" fill="currentColor" /><circle cx="16" cy="6" r="1.4" fill="currentColor" />
    <circle cx="8" cy="12" r="1.4" fill="currentColor" /><circle cx="16" cy="12" r="1.4" fill="currentColor" />
    <circle cx="8" cy="18" r="1.4" fill="currentColor" /><circle cx="16" cy="18" r="1.4" fill="currentColor" />
  </svg>
)
const IconImageStack = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <rect x="14" y="10" width="38" height="30" rx="6" fill="url(#mpg1)" opacity="0.5" />
    <rect x="8" y="18" width="38" height="30" rx="6" fill="url(#mpg2)" />
    <circle cx="19" cy="30" r="4" fill="#fff" opacity="0.85" />
    <path d="M12 42l8-9 7 6 6-8 11 11H12z" fill="#fff" opacity="0.9" />
    <defs>
      <linearGradient id="mpg1" x1="14" y1="10" x2="52" y2="40"><stop stopColor="#7F5FFF" /><stop offset="1" stopColor="#38A3F5" /></linearGradient>
      <linearGradient id="mpg2" x1="8" y1="18" x2="46" y2="48"><stop stopColor="#C86DD7" /><stop offset="1" stopColor="#7F5FFF" /></linearGradient>
    </defs>
  </svg>
)

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds)) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

let uid = 0
function toItem(file) {
  const isVideo = file.type.startsWith('video/')
  const isGif = file.type === 'image/gif'
  return {
    id: `f${Date.now()}_${uid++}`,
    file,
    url: URL.createObjectURL(file),
    // mediaType is what actually goes out via onConfirm — GIF stays
    // 'image' to match classifyDroppedFile's drag-and-drop behavior.
    mediaType: isVideo ? 'video' : 'image',
    isGif,
    duration: null,
  }
}

export default function MediaPicker({ isOpen, onClose, onConfirm, accept = 'image/*,video/*', heading }) {
  const [items, setItems] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      items.forEach((it) => URL.revokeObjectURL(it.url))
      setItems([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const addFiles = useCallback((fileList) => {
    const newItems = Array.from(fileList)
      .filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
      .map(toItem)
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const handleBrowseClick = () => fileInputRef.current?.click()

  const handleInputChange = (e) => {
    if (e.target.files?.length) addFiles(e.target.files)
    e.target.value = '' // allow re-picking the same file later
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  const removeItem = (id) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((it) => it.id !== id)
    })
  }

  const setDuration = (id, duration) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, duration } : it)))
  }

  const handleContinue = () => {
    // Single call, ordered array, exactly what MediaAttachmentFlow expects.
    onConfirm(items.map(({ file, mediaType }) => ({ file, mediaType })))
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={rootStyle}
          role="dialog"
          aria-label={heading || 'Select media'}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />

          {/* header */}
          <div style={headerStyle}>
            <button onClick={onClose} style={textBtnStyle}>Cancel</button>
            <span style={headerTitleStyle}>
              {heading || (items.length > 0 ? `${items.length} selected` : 'Select media')}
            </span>
            <motion.button
              onClick={handleContinue}
              disabled={items.length === 0}
              whileTap={items.length ? { scale: 0.94 } : {}}
              style={items.length ? addBtnActiveStyle : addBtnDisabledStyle}
            >
              Add{items.length > 0 ? ` (${items.length})` : ''}
            </motion.button>
          </div>

          {/* body */}
          <div
            style={bodyStyle}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {items.length === 0 ? (
              <div style={emptyStateStyle}>
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <IconImageStack size={64} />
                </motion.div>
                <p style={emptyTitleStyle}>Choose photos, videos, or GIFs to send</p>
                <p style={emptySubStyle}>Drag files in, or browse your device</p>
                <motion.button whileTap={{ scale: 0.96 }} onClick={handleBrowseClick} style={browseBtnStyle}>
                  Browse
                </motion.button>
              </div>
            ) : (
              <>
                <Reorder.Group axis="y" values={items} onReorder={setItems} style={gridStyle} as="div">
                  <AnimatePresence>
                    {items.map((item, index) => (
                      <MediaTile
                        key={item.id}
                        item={item}
                        index={index}
                        onRemove={() => removeItem(item.id)}
                        onDuration={(d) => setDuration(item.id, d)}
                      />
                    ))}
                  </AnimatePresence>
                </Reorder.Group>

                <motion.button whileTap={{ scale: 0.97 }} onClick={handleBrowseClick} style={addMoreStyle}>
                  <IconPlus size={16} />
                  Add more
                </motion.button>
              </>
            )}

            <AnimatePresence>
              {dragOver && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={dropOverlayStyle}
                >
                  <span style={dropOverlayTextStyle}>Drop to add</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function MediaTile({ item, index, onRemove, onDuration }) {
  const controls = useDragControls()

  return (
    <Reorder.Item
      value={item}
      id={item.id}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      style={tileRowStyle}
    >
      <div onPointerDown={(e) => controls.start(e)} style={gripHandleStyle} aria-label="Drag to reorder">
        <IconGrip />
      </div>

      <div style={thumbWrapStyle}>
        {item.mediaType === 'video' ? (
          <>
            <video
              src={item.url}
              muted
              style={thumbMediaStyle}
              onLoadedMetadata={(e) => onDuration(e.currentTarget.duration)}
            />
            <span style={playBadgeStyle}><IconPlay size={18} /></span>
            {item.duration && <span style={durationBadgeStyle}>{formatDuration(item.duration)}</span>}
          </>
        ) : (
          <img src={item.url} alt="" style={thumbMediaStyle} />
        )}
        {item.isGif && <span style={gifBadgeStyle}>GIF</span>}
        {index === 0 && <span style={coverBadgeStyle}>Cover</span>}
      </div>

      <div style={tileMetaStyle}>
        <span style={tileNameStyle}>{item.file.name}</span>
        <span style={tileSubStyle}>
          {item.mediaType === 'video' ? 'Video' : item.isGif ? 'GIF' : 'Photo'}
          {item.file.size ? ` · ${(item.file.size / (1024 * 1024)).toFixed(1)} MB` : ''}
        </span>
      </div>

      <button onClick={onRemove} aria-label="Remove" style={removeBtnStyle}>
        <IconTrash />
      </button>
    </Reorder.Item>
  )
}

// ---- styles ----
// This surface is always dark regardless of app theme, so colors are
// hardcoded constants rather than theme vars (same reasoning as the
// MediaStudio fix — a var resolving to a light-mode color here would
// go invisible).

const rootStyle = {
  position: 'fixed', inset: 0, zIndex: 70,
  display: 'flex', flexDirection: 'column',
  background: 'linear-gradient(180deg, #17131f 0%, #0f0d16 100%)',
  maxWidth: 480, margin: '0 auto',
}

const headerStyle = {
  flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px',
  borderBottom: '1px solid rgba(148,120,255,0.12)',
  paddingTop: 'max(14px, env(safe-area-inset-top))',
}

const textBtnStyle = {
  border: 'none', background: 'transparent', color: '#a78bfa',
  fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: 4,
}

const headerTitleStyle = {
  fontSize: 14.5, fontWeight: 700, color: '#e4e0f0',
  maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

const addBtnActiveStyle = {
  border: 'none', borderRadius: 999, padding: '7px 16px',
  background: 'linear-gradient(135deg, #7F5FFF 0%, #C86DD7 100%)',
  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
}

const addBtnDisabledStyle = {
  ...addBtnActiveStyle,
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(228,224,240,0.35)',
  cursor: 'default',
}

const bodyStyle = { flex: 1, overflowY: 'auto', position: 'relative', padding: '4px 12px 20px' }

const emptyStateStyle = {
  height: '100%', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 32px', textAlign: 'center',
}

const emptyTitleStyle = { color: '#c9c5d6', fontSize: 15, fontWeight: 600, margin: '14px 0 2px' }
const emptySubStyle = { color: '#726d84', fontSize: 12.5, margin: 0 }

const browseBtnStyle = {
  marginTop: 16, border: 'none', borderRadius: 999, padding: '11px 28px',
  background: 'linear-gradient(135deg, #7F5FFF 0%, #C86DD7 100%)',
  color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(127,95,255,0.35)',
}

const gridStyle = { display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 2px 4px', listStyle: 'none', margin: 0 }

const tileRowStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: 8, borderRadius: 16,
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(255,255,255,0.07)',
}

const gripHandleStyle = { color: '#726d84', cursor: 'grab', flexShrink: 0, padding: 4, touchAction: 'none' }

const thumbWrapStyle = {
  position: 'relative', flexShrink: 0,
  width: 56, height: 56, borderRadius: 12, overflow: 'hidden',
  background: 'rgba(0,0,0,0.3)',
}

const thumbMediaStyle = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }

const playBadgeStyle = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#fff', background: 'rgba(0,0,0,0.25)',
}

const durationBadgeStyle = {
  position: 'absolute', bottom: 3, right: 3,
  fontSize: 9.5, fontWeight: 700, color: '#fff',
  background: 'rgba(0,0,0,0.6)', borderRadius: 5, padding: '1px 4px',
}

const gifBadgeStyle = {
  position: 'absolute', top: 3, left: 3,
  fontSize: 9, fontWeight: 800, color: '#fff',
  background: 'rgba(127,95,255,0.9)', borderRadius: 5, padding: '1px 4px', letterSpacing: 0.3,
}

const coverBadgeStyle = {
  position: 'absolute', top: 3, right: 3,
  fontSize: 8.5, fontWeight: 800, color: '#fff',
  background: 'rgba(0,0,0,0.55)', borderRadius: 5, padding: '1px 4px', letterSpacing: 0.3,
}

const tileMetaStyle = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }

const tileNameStyle = {
  color: '#e4e0f0', fontSize: 12.5, fontWeight: 600,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

const tileSubStyle = { color: '#726d84', fontSize: 11 }

const removeBtnStyle = {
  flexShrink: 0, width: 30, height: 30, borderRadius: 9,
  border: 'none', background: 'rgba(255,255,255,0.06)', color: '#c9a9b8',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}

const addMoreStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  width: '100%', padding: '11px 0', margin: '4px 0 8px',
  borderRadius: 14, border: '1px dashed rgba(148,120,255,0.3)',
  background: 'rgba(127,95,255,0.06)', color: '#c9c0ff',
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
}

const dropOverlayStyle = {
  position: 'absolute', inset: 8, borderRadius: 18,
  border: '2px dashed rgba(148,120,255,0.55)',
  background: 'rgba(127,95,255,0.1)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const dropOverlayTextStyle = { color: '#c9c0ff', fontWeight: 700, fontSize: 15 }
