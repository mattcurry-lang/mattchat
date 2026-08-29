// DropZone.jsx
// Desktop/PWA drag-and-drop entry point (spec section 6). Listens at the
// window level (only while mounted — i.e. only while a real conversation
// is open, since that's when MediaAttachmentFlow itself is mounted) so a
// file can be dropped anywhere over the app, not just a small target —
// matches drag-and-drop UX in modern chat apps. A dragenter/dragleave
// depth counter avoids the classic flicker problem where the overlay
// toggles on/off as the pointer crosses child element boundaries.
//
// This component owns detection + the visual only. Classification and
// routing (which files go to MediaComposer vs straight to send) is done
// by the caller via onFilesDropped, matching how MediaPicker/FilePicker
// hand raw files back up to MediaAttachmentFlow.

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function DropZone({ enabled, onFilesDropped }) {
  const [isDragging, setIsDragging] = useState(false)
  const depthRef = useRef(0)

  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files')

  const onDragEnter = useCallback((e) => {
    if (!enabled || !hasFiles(e)) return
    e.preventDefault()
    depthRef.current += 1
    setIsDragging(true)
  }, [enabled])

  const onDragOver = useCallback((e) => {
    if (!enabled || !hasFiles(e)) return
    e.preventDefault() // required, or the drop event never fires
  }, [enabled])

  const onDragLeave = useCallback((e) => {
    if (!enabled) return
    // Leaving the browser window entirely (not just crossing a child
    // element inside it) reports relatedTarget as null in most browsers —
    // treat that as an authoritative reset rather than trusting the depth
    // counter alone, which can otherwise get stuck showing the overlay if
    // the user drags back out without dropping.
    if (e.relatedTarget === null) {
      depthRef.current = 0
      setIsDragging(false)
      return
    }
    depthRef.current = Math.max(0, depthRef.current - 1)
    if (depthRef.current === 0) setIsDragging(false)
  }, [enabled])

  const onDrop = useCallback((e) => {
    if (!enabled) return
    e.preventDefault()
    depthRef.current = 0
    setIsDragging(false)
    const files = Array.from(e.dataTransfer?.files || [])
    if (files.length) onFilesDropped(files)
  }, [enabled, onFilesDropped])

  useEffect(() => {
    if (!enabled) {
      // If the composer/picker opened mid-drag, drop the overlay state
      // immediately rather than leaving it stuck visible underneath.
      setIsDragging(false)
      depthRef.current = 0
      return
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
      depthRef.current = 0
    }
  }, [enabled, onDragEnter, onDragOver, onDragLeave, onDrop])

  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={overlayStyle}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            style={cardStyle}
          >
            <div style={iconWrapStyle}>
              <DropIcon />
            </div>
            <div style={titleTextStyle}>Drop into Mattchat</div>
            <div style={subTextStyle}>Photos, videos, documents, and audio</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function DropIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(12, 10, 20, 0.72)',
  backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  pointerEvents: 'none', // window listeners handle the drag events regardless of hit-testing
}

const cardStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  padding: '36px 48px',
  borderRadius: 28,
  border: '2px dashed rgba(167,139,250,0.6)',
  background: 'linear-gradient(135deg, rgba(102,126,234,0.14), rgba(118,75,162,0.14))',
  boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
}

const iconWrapStyle = {
  width: 58, height: 58, borderRadius: '50%',
  background: 'linear-gradient(135deg,#667eea,#764ba2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  marginBottom: 4,
}

const titleTextStyle = { color: '#fff', fontWeight: 800, fontSize: 17 }
const subTextStyle = { color: 'rgba(255,255,255,0.65)', fontSize: 12.5 }
