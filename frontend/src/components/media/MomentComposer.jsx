// MomentComposer.jsx
// The "✨ Create Moment" flow — takes the final exported files from
// MediaComposer (already cropped/filtered/trimmed) and lets the user turn
// them into ONE grouped Moment: a title, a chosen cover, and a reorderable
// sequence. Sending calls onSend(items, { title, coverIndex }), where items
// is the same [{file, mediaType}] list in its (possibly reordered) order.

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { IconX } from '../Icons'

export default function MomentComposer({ isOpen, items, onCancel, onSend }) {
  const [ordered, setOrdered] = useState([])
  const [title, setTitle] = useState('')
  const [coverId, setCoverId] = useState(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const withIds = (items || []).map((it, i) => ({
      ...it,
      _id: `${it.file.name}-${i}-${it.file.size}`,
      previewUrl: URL.createObjectURL(it.file),
    }))
    setOrdered(withIds)
    setCoverId(withIds[0]?._id || null)
    setTitle('')
    return () => withIds.forEach(it => URL.revokeObjectURL(it.previewUrl))
  }, [isOpen, items])

  const coverIndex = useMemo(() => ordered.findIndex(it => it._id === coverId), [ordered, coverId])

  const removeItem = (id) => {
    setOrdered(prev => prev.filter(it => it._id !== id))
    if (coverId === id) {
      const next = ordered.find(it => it._id !== id)
      setCoverId(next?._id || null)
    }
  }

  const handleSend = () => {
    if (!ordered.length || sending) return
    setSending(true)
    const finalItems = ordered.map(({ file, mediaType }) => ({ file, mediaType }))
    onSend(finalItems, { title: title.trim() || null, coverIndex: Math.max(0, coverIndex) })
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={overlayStyle}>
        <div style={topBarStyle}>
          <button onClick={onCancel} style={iconBtnStyle}><IconX size={16} /></button>
          <span style={titleBarStyle}>✨ Create Moment</span>
          <span style={{ width: 36 }} />
        </div>

        <div style={bodyStyle}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give this Moment a title… (e.g. Friday at DeKUT)"
            style={titleInputStyle}
            autoFocus
          />
          <p style={hintStyle}>Tap a photo to set it as the cover. Drag to reorder.</p>

          <Reorder.Group as="div" axis="y" values={ordered} onReorder={setOrdered} style={listStyle}>
            {ordered.map((item, i) => (
              <Reorder.Item key={item._id} value={item} style={rowStyle} whileDrag={{ scale: 1.02, zIndex: 5, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                <button onClick={() => setCoverId(item._id)} style={thumbBtnStyle}>
                  {item.mediaType === 'video' ? (
                    <video src={item.previewUrl} style={thumbStyle} muted />
                  ) : (
                    <img src={item.previewUrl} alt="" style={thumbStyle} />
                  )}
                  {item._id === coverId && <span style={coverBadgeStyle}>Cover</span>}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={rowLabelStyle}>{item.mediaType === 'video' ? '🎬 Video' : '🖼️ Photo'} {i + 1}</div>
                  <div style={rowNameStyle}>{item.file.name}</div>
                </div>
                <button onClick={() => removeItem(item._id)} style={removeBtnStyle}>✕</button>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          {ordered.length === 0 && (
            <div style={emptyStyle}>All items removed — cancel and reselect to build a Moment.</div>
          )}
        </div>

        <div style={footerStyle}>
          <div style={countLabelStyle}>{ordered.length} {ordered.length === 1 ? 'memory' : 'memories'}</div>
          <button onClick={handleSend} disabled={!ordered.length || sending} style={sendBtnStyle}>
            {sending ? 'Sending…' : 'Send Moment'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 85, display: 'flex', flexDirection: 'column', background: '#000' }
const topBarStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }
const iconBtnStyle = { width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer' }
const titleBarStyle = { color: '#fff', fontWeight: 700, fontSize: 14 }
const bodyStyle = { flex: 1, overflowY: 'auto', padding: '0 16px 16px' }
const titleInputStyle = { width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14, padding: '12px 14px', color: '#fff', fontSize: 14.5, fontWeight: 600, boxSizing: 'border-box', marginBottom: 8 }
const hintStyle = { fontSize: 11.5, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px' }
const listStyle = { display: 'flex', flexDirection: 'column', gap: 8 }
const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 8, cursor: 'grab' }
const thumbBtnStyle = { position: 'relative', width: 56, height: 56, borderRadius: 10, overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }
const thumbStyle = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
const coverBadgeStyle = { position: 'absolute', bottom: 2, left: 2, right: 2, background: 'var(--accent, #7c5cff)', color: '#fff', fontSize: 8.5, fontWeight: 800, textAlign: 'center', borderRadius: 4, padding: '1px 0' }
const rowLabelStyle = { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }
const rowNameStyle = { fontSize: 13, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const removeBtnStyle = { background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }
const emptyStyle = { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 13, padding: '30px 0' }
const footerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px max(14px, env(safe-area-inset-bottom))', background: 'rgba(15,13,22,0.96)' }
const countLabelStyle = { color: 'rgba(255,255,255,0.6)', fontSize: 12.5, fontWeight: 600 }
const sendBtnStyle = { background: 'var(--accent, #7c5cff)', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
