// FilePicker.jsx
// Full-screen review-and-select gallery for documents and audio — the
// counterpart to MediaPicker, but for the two attachment types that skip
// MediaComposer entirely (no editing step; see MediaAttachmentFlow's
// handlePickedDirect). Opens when the user taps Documents or Audio in
// MediaStudio.
//
// CONTRACT (matches MediaAttachmentFlow.jsx exactly):
//   props: { isOpen, onClose, onConfirm, kind }  — kind: 'document' | 'audio'
//   onConfirm(files, mediaType) — called ONCE with the raw File[] in
//   final order and mediaType === kind, exactly what sendMediaMessage
//   expects downstream.
//
// STYLE: brought in line with MediaPicker — same dark gradient sheet, same
// sticky header (Cancel / title / Add (n)), same drag-and-drop empty state,
// same Reorder-based list for ordering multiple files before sending. No
// emoji anywhere; per-file-type color badges instead (PDF red, Word blue,
// Excel green, PowerPoint orange, etc.) matching MediaMessage's bubble
// treatment, so a document looks the same picking it as it does once sent.

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
const IconGrip = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="8" cy="6" r="1.4" fill="currentColor" /><circle cx="16" cy="6" r="1.4" fill="currentColor" />
    <circle cx="8" cy="12" r="1.4" fill="currentColor" /><circle cx="16" cy="12" r="1.4" fill="currentColor" />
    <circle cx="8" cy="18" r="1.4" fill="currentColor" /><circle cx="16" cy="18" r="1.4" fill="currentColor" />
  </svg>
)
const IconDocStack = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <rect x="16" y="8" width="28" height="36" rx="4" fill="url(#fpg1)" opacity="0.5" />
    <rect x="10" y="16" width="28" height="36" rx="4" fill="url(#fpg2)" />
    <path d="M18 26h12M18 32h12M18 38h8" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity="0.85" />
    <defs>
      <linearGradient id="fpg1" x1="16" y1="8" x2="44" y2="44"><stop stopColor="#7F5FFF" /><stop offset="1" stopColor="#38A3F5" /></linearGradient>
      <linearGradient id="fpg2" x1="10" y1="16" x2="38" y2="52"><stop stopColor="#C86DD7" /><stop offset="1" stopColor="#7F5FFF" /></linearGradient>
    </defs>
  </svg>
)
const IconAudioStack = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="26" fill="url(#fpg3)" opacity="0.9" />
    <path d="M22 34v-4l20-4v20" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="20" cy="40" r="5" stroke="#fff" strokeWidth={2.4} />
    <circle cx="40" cy="36" r="5" stroke="#fff" strokeWidth={2.4} />
    <defs>
      <linearGradient id="fpg3" x1="6" y1="6" x2="58" y2="58"><stop stopColor="#7F5FFF" /><stop offset="1" stopColor="#C86DD7" /></linearGradient>
    </defs>
  </svg>
)
const IconMusicSmall = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M9 18V5l11-2v13" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth={1.8} />
    <circle cx="17" cy="16" r="3" stroke="currentColor" strokeWidth={1.8} />
  </svg>
)

// same file-type palette MediaMessage's bubble uses, so a document looks
// the same in the picker as it does once it lands in the chat
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

const KIND_CONFIG = {
  document: {
    heading: 'Send files',
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip',
    emptyTitle: 'Choose documents to send',
    emptySub: 'Drag files in, or browse your device',
    StackIcon: IconDocStack,
  },
  audio: {
    heading: 'Send audio',
    accept: 'audio/*',
    emptyTitle: 'Choose audio to send',
    emptySub: 'Drag files in, or browse your device',
    StackIcon: IconAudioStack,
  },
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

let uid = 0
function toItem(file) {
  return { id: `f${Date.now()}_${uid++}`, file }
}

export default function FilePicker({ isOpen, onClose, onConfirm, kind = 'document' }) {
  const cfg = KIND_CONFIG[kind] || KIND_CONFIG.document
  const [items, setItems] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) setItems([])
  }, [isOpen])

  const addFiles = useCallback((fileList) => {
    setItems((prev) => [...prev, ...Array.from(fileList).map(toItem)])
  }, [])

  const handleBrowseClick = () => fileInputRef.current?.click()

  const handleInputChange = (e) => {
    if (e.target.files?.length) addFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.id !== id))

  const handleContinue = () => {
    onConfirm(items.map((it) => it.file), kind)
  }

  const StackIcon = cfg.StackIcon

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={rootStyle}
          role="dialog"
          aria-label={cfg.heading}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={cfg.accept}
            multiple
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />

          {/* header */}
          <div style={headerStyle}>
            <button onClick={onClose} style={textBtnStyle}>Cancel</button>
            <span style={headerTitleStyle}>
              {items.length > 0 ? `${items.length} selected` : cfg.heading}
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
                  <StackIcon size={64} />
                </motion.div>
                <p style={emptyTitleStyle}>{cfg.emptyTitle}</p>
                <p style={emptySubStyle}>{cfg.emptySub}</p>
                <motion.button whileTap={{ scale: 0.96 }} onClick={handleBrowseClick} style={browseBtnStyle}>
                  Browse
                </motion.button>
              </div>
            ) : (
              <>
                <Reorder.Group axis="y" values={items} onReorder={setItems} style={listStyle} as="div">
                  <AnimatePresence>
                    {items.map((item) => (
                      <FileRow key={item.id} item={item} kind={kind} onRemove={() => removeItem(item.id)} />
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={dropOverlayStyle}>
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

function FileRow({ item, kind, onRemove }) {
  const controls = useDragControls()
  const ext = item.file.name.split('.').pop()?.toLowerCase()
  const extStyle = EXT_STYLE[ext] || DEFAULT_EXT_STYLE

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
      style={rowStyle}
    >
      <div onPointerDown={(e) => controls.start(e)} style={gripHandleStyle} aria-label="Drag to reorder">
        <IconGrip />
      </div>

      {kind === 'audio' ? (
        <span style={audioBadgeStyle}><IconMusicSmall size={18} /></span>
      ) : (
        <span style={{ ...fileBadgeStyle, background: extStyle.gradient }}>{extStyle.label}</span>
      )}

      <div style={rowMetaStyle}>
        <span style={rowNameStyle}>{item.file.name}</span>
        <span style={rowSubStyle}>{formatSize(item.file.size)}</span>
      </div>

      <button onClick={onRemove} aria-label="Remove" style={removeBtnStyle}>
        <IconTrash />
      </button>
    </Reorder.Item>
  )
}

// ---- styles ----
// Always-dark surface regardless of app theme, so hardcoded constants
// rather than theme vars — same reasoning as MediaPicker/MediaStudio.

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

const textBtnStyle = { border: 'none', background: 'transparent', color: '#a78bfa', fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: 4 }

const headerTitleStyle = {
  fontSize: 14.5, fontWeight: 700, color: '#e4e0f0',
  maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

const addBtnActiveStyle = {
  border: 'none', borderRadius: 999, padding: '7px 16px',
  background: 'linear-gradient(135deg, #7F5FFF 0%, #C86DD7 100%)',
  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
}

const addBtnDisabledStyle = { ...addBtnActiveStyle, background: 'rgba(255,255,255,0.06)', color: 'rgba(228,224,240,0.35)', cursor: 'default' }

const bodyStyle = { flex: 1, overflowY: 'auto', position: 'relative', padding: '4px 12px 20px' }

const emptyStateStyle = { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 32px', textAlign: 'center' }
const emptyTitleStyle = { color: '#c9c5d6', fontSize: 15, fontWeight: 600, margin: '14px 0 2px' }
const emptySubStyle = { color: '#726d84', fontSize: 12.5, margin: 0 }

const browseBtnStyle = {
  marginTop: 16, border: 'none', borderRadius: 999, padding: '11px 28px',
  background: 'linear-gradient(135deg, #7F5FFF 0%, #C86DD7 100%)',
  color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(127,95,255,0.35)',
}

const listStyle = { display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 2px 4px', listStyle: 'none', margin: 0 }

const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: 8, borderRadius: 16,
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(255,255,255,0.07)',
}

const gripHandleStyle = { color: '#726d84', cursor: 'grab', flexShrink: 0, padding: 4, touchAction: 'none' }

const fileBadgeStyle = {
  width: 42, height: 42, borderRadius: 11, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 0.2,
}

const audioBadgeStyle = {
  width: 42, height: 42, borderRadius: 11, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(127,95,255,0.16)', color: '#c9c0ff',
}

const rowMetaStyle = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }
const rowNameStyle = { color: '#e4e0f0', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const rowSubStyle = { color: '#726d84', fontSize: 11 }

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
