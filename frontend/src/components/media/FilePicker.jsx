// FilePicker.jsx
// Used for the "Documents" and "Audio" Media Studio options. Simpler than
// MediaPicker — no thumbnail grid, just a confirm list showing filename,
// extension, and size, matching the spec's file-message preview format.

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { validateFile, MediaValidationError } from '../services/MediaAssetService'

const ACCEPT = {
  document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip',
  audio: 'audio/*',
}

const EXT_ICON = {
  pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
  ppt: '📙', pptx: '📙', txt: '📄', csv: '📊', zip: '🗂️',
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function FilePicker({ isOpen, onClose, onConfirm, kind = 'document' }) {
  const [files, setFiles] = useState([])
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const openDialog = () => inputRef.current?.click()

  const handleChosen = (fileList) => {
    setError(null)
    const mediaType = kind === 'audio' ? 'audio' : 'document'
    const next = []
    for (const file of Array.from(fileList)) {
      try {
        validateFile(file, mediaType)
        next.push(file)
      } catch (e) {
        if (e instanceof MediaValidationError) setError(e.message)
        else throw e
      }
    }
    setFiles(prev => [...prev, ...next])
  }

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx))

  const handleConfirm = () => {
    if (!files.length) return
    onConfirm(files, kind === 'audio' ? 'audio' : 'document')
    setFiles([])
    onClose()
  }

  const handleClose = () => {
    setFiles([])
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={overlayStyle}>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT[kind]}
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { handleChosen(e.target.files); e.target.value = '' }}
          />

          <div style={headerStyle}>
            <button onClick={handleClose} style={textBtnStyle}>Cancel</button>
            <span style={headerTitleStyle}>{kind === 'audio' ? 'Send audio' : 'Send files'}</span>
            <button onClick={openDialog} style={textBtnStyle}>Add</button>
          </div>

          {error && <div style={errorBannerStyle}>{error}</div>}

          <div style={bodyStyle}>
            {files.length === 0 ? (
              <div style={emptyStateStyle}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>{kind === 'audio' ? '🎵' : '📄'}</div>
                <button onClick={openDialog} style={primaryBtnStyle}>Browse</button>
              </div>
            ) : (
              files.map((file, idx) => {
                const ext = file.name.split('.').pop()?.toLowerCase()
                return (
                  <div key={`${file.name}-${idx}`} style={rowStyle}>
                    <span style={{ fontSize: 22 }}>{EXT_ICON[ext] || (kind === 'audio' ? '🎵' : '📄')}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={filenameStyle}>{file.name}</div>
                      <div style={filesizeStyle}>{formatSize(file.size)}</div>
                    </div>
                    <button onClick={() => removeFile(idx)} style={removeBtnStyle}>✕</button>
                  </div>
                )
              })
            )}
          </div>

          {files.length > 0 && (
            <div style={footerStyle}>
              <button onClick={handleConfirm} style={continueBtnStyle}>
                Send {files.length} {files.length === 1 ? 'file' : 'files'}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 70, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary, #0d0b14)' }
const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-subtle, rgba(148,120,255,0.16))' }
const headerTitleStyle = { color: 'var(--text-primary, #f2f0f8)', fontWeight: 600, fontSize: 15 }
const textBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent, #a78bfa)', fontWeight: 600, fontSize: 14, padding: 6 }
const primaryBtnStyle = { background: 'var(--accent, #7c5cff)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 22px', fontWeight: 600, cursor: 'pointer' }
const errorBannerStyle = { margin: '10px 16px 0', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,90,90,0.14)', border: '1px solid rgba(255,90,90,0.3)', color: '#ff9a9a', fontSize: 13 }
const bodyStyle = { flex: 1, overflowY: 'auto', padding: 16 }
const emptyStateStyle = { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', borderRadius: 12, border: '1px solid var(--border-subtle, rgba(148,120,255,0.14))', marginBottom: 8, background: 'var(--surface-card, rgba(148,120,255,0.06))' }
const filenameStyle = { color: 'var(--text-primary, #f2f0f8)', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const filesizeStyle = { color: 'var(--text-secondary, #c9c4dd)', fontSize: 12, marginTop: 2 }
const removeBtnStyle = { background: 'none', border: 'none', color: 'var(--text-secondary, #c9c4dd)', cursor: 'pointer', fontSize: 15 }
const footerStyle = { padding: '14px 16px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-subtle, rgba(148,120,255,0.16))' }
const continueBtnStyle = { width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: 'var(--accent, #7c5cff)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }
