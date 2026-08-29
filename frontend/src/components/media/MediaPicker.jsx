// MediaPicker.jsx
// Opens the OS file dialog (images/videos/gifs), then shows a selection grid
// with preview, multi-select, reorder, and a persistent "N selected 
// Continue" bar — matching the spec's picker UX as closely as a web app can.
//
// NOTE ON SCOPE: browsers do not expose the device photo library as
// queryable categories, so there is no way to show real "Recent" vs
// "Screenshots" vs "GIFs" sections without the user picking files first —
// that's an OS-level permission the web platform doesn't grant. Once files
// are chosen, we DO group them into those same section labels using
// heuristics (mime type for videos/gifs, filename pattern for screenshots)
// so the UI still reads the way the spec describes.
//
// Passes selected File objects up via onConfirm(files, mediaType) — from
// there they go straight into MediaComposer (Phase 2) or, until that
// exists, directly into sendMediaMessage.

import { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { validateFile, MediaValidationError } from '../../services/MediaAssetService'

function detectMediaType(file) {
  if (file.type === 'image/gif') return 'gif'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('image/')) return 'image'
  return null
}

function isLikelyScreenshot(file) {
  return /screenshot|screen[_ -]?shot/i.test(file.name)
}

function sectionFor(file) {
  const type = detectMediaType(file)
  if (type === 'gif') return 'GIFs'
  if (type === 'video') return 'Videos'
  if (isLikelyScreenshot(file)) return 'Screenshots'
  return 'Photos'
}

export default function MediaPicker({ isOpen, onClose, onConfirm, accept = 'image/*,video/*', heading }) {
  const [items, setItems] = useState([]) // [{ id, file, url, mediaType, section }]
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const grouped = useMemo(() => {
    const groups = {}
    for (const item of items) {
      groups[item.section] = groups[item.section] || []
      groups[item.section].push(item)
    }
    return groups
  }, [items])

  const openNativeDialog = () => fileInputRef.current?.click()

  const handleFilesChosen = (fileList) => {
    setError(null)
    const next = []
    for (const file of Array.from(fileList)) {
      const mediaType = detectMediaType(file)
      if (!mediaType) continue
      try {
        validateFile(file, mediaType)
      } catch (e) {
        if (e instanceof MediaValidationError) {
          setError(e.message)
          continue
        }
        throw e
      }
      next.push({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        url: URL.createObjectURL(file),
        mediaType,
        section: sectionFor(file),
      })
    }
    setItems(prev => [...prev, ...next])
  }

  const toggleRemove = (id) => setItems(prev => prev.filter(i => i.id !== id))

  const selectAll = () => {} // all chosen files are already "selected" by definition on web — see note above
  const clearAll = () => {
    items.forEach(i => URL.revokeObjectURL(i.url))
    setItems([])
  }

  const handleContinue = () => {
    if (!items.length) return
    // Group by mediaType so sendMediaMessage gets a consistent type per call;
    // mixed photo+video sends still work, they just batch as two calls.
    const byType = items.reduce((acc, i) => {
      acc[i.mediaType] = acc[i.mediaType] || []
      acc[i.mediaType].push(i.file)
      return acc
    }, {})
    Object.entries(byType).forEach(([mediaType, files]) => onConfirm(files, mediaType))
    clearAll()
    onClose()
  }

  const handleClose = () => {
    clearAll()
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={overlayStyle}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { handleFilesChosen(e.target.files); e.target.value = '' }}
          />

          <div style={headerStyle}>
            <button onClick={handleClose} style={textBtnStyle}>Cancel</button>
                       <span style={headerTitleStyle}>
              {items.length > 0 ? `${items.length} selected` : (heading || 'Select media')}
            </span>
            <button onClick={openNativeDialog} style={textBtnStyle}>Add</button>
          </div>

          {error && <div style={errorBannerStyle}>{error}</div>}

          <div style={bodyStyle}>
            {items.length === 0 ? (
              <div style={emptyStateStyle}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🖼️</div>
                               <p style={{ color: 'var(--text-secondary, #c9c4dd)', marginBottom: 16 }}>
                  {heading || 'Choose photos, videos, or GIFs to send'}
                </p>
                <button onClick={openNativeDialog} style={primaryBtnStyle}>Browse</button>
              </div>
            ) : (
              ['Photos', 'Videos', 'GIFs', 'Screenshots'].map(section => (
                grouped[section]?.length ? (
                  <div key={section} style={{ marginBottom: 20 }}>
                    <h4 style={sectionTitleStyle}>{section}</h4>
                    <Reorder.Group
                      as="div"
                      axis="x"
                      values={grouped[section]}
                      onReorder={(newOrder) => {
                        setItems(prev => {
                          const others = prev.filter(i => i.section !== section)
                          return [...others, ...newOrder]
                        })
                      }}
                      style={gridStyle}
                    >
                      {grouped[section].map(item => (
                        <Reorder.Item key={item.id} value={item} style={thumbWrapStyle} whileDrag={{ scale: 1.05, zIndex: 5 }}>
                          {item.mediaType === 'video' ? (
                            <video src={item.url} style={thumbStyle} muted />
                          ) : (
                            <img src={item.url} alt={item.file.name} style={thumbStyle} />
                          )}
                          <button onClick={() => toggleRemove(item.id)} style={removeBtnStyle} aria-label="Remove">✕</button>
                          {item.mediaType === 'video' && <span style={videoBadgeStyle}>▶</span>}
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </div>
                ) : null
              ))
            )}
          </div>

          {items.length > 0 && (
            <div style={footerStyle}>
              <button onClick={handleContinue} style={continueBtnStyle}>
                Continue ({items.length})
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---- styles ----

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 70,
  display: 'flex', flexDirection: 'column',
  background: 'var(--bg-primary, #0d0b14)',
}

const headerStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px',
  borderBottom: '1px solid var(--border-subtle, rgba(148,120,255,0.16))',
}

const headerTitleStyle = { color: 'var(--text-primary, #f2f0f8)', fontWeight: 600, fontSize: 15 }

const textBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--accent, #a78bfa)', fontWeight: 600, fontSize: 14, padding: 6,
}

const primaryBtnStyle = {
  background: 'var(--accent, #7c5cff)', color: '#fff', border: 'none',
  borderRadius: 12, padding: '10px 22px', fontWeight: 600, cursor: 'pointer',
}

const errorBannerStyle = {
  margin: '10px 16px 0', padding: '10px 12px', borderRadius: 10,
  background: 'rgba(255,90,90,0.14)', border: '1px solid rgba(255,90,90,0.3)',
  color: '#ff9a9a', fontSize: 13,
}

const bodyStyle = { flex: 1, overflowY: 'auto', padding: 16 }

const emptyStateStyle = {
  height: '100%', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', textAlign: 'center',
}

const sectionTitleStyle = {
  color: 'var(--text-secondary, #c9c4dd)', fontSize: 13, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 10px',
}

const gridStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8,
}

const thumbWrapStyle = {
  position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden',
  border: '1px solid var(--border-subtle, rgba(148,120,255,0.16))', cursor: 'grab',
}

const thumbStyle = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }

const removeBtnStyle = {
  position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: '50%',
  background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const videoBadgeStyle = {
  position: 'absolute', bottom: 5, left: 5, color: '#fff', fontSize: 14,
  textShadow: '0 1px 3px rgba(0,0,0,0.7)',
}

const footerStyle = {
  padding: '14px 16px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
  borderTop: '1px solid var(--border-subtle, rgba(148,120,255,0.16))',
}

const continueBtnStyle = {
  width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
  background: 'var(--accent, #7c5cff)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
}
