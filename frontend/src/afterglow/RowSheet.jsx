import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { IconStar, IconTrash } from '../components/Icons'
import './afterglow.css'

const stop = (e) => e.stopPropagation()

/**
 * Options for one conversation. Long-press on touch, right-click on desktop.
 * Rendered in a portal, but React still bubbles events through portals to the
 * row that owns it — so every handler here stops propagation, or tapping
 * "Delete" would also open the chat underneath.
 */
export default function RowSheet({ open, name, isClose, onToggleClose, onDelete, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="ag-sheet-scrim"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
          onClick={(e) => { stop(e); onClose() }}
          onPointerDown={stop} onPointerUp={stop} onContextMenu={(e) => { e.preventDefault(); stop(e) }}
        >
          <motion.div
            className="ag-sheet" role="dialog" aria-label={`Options for ${name}`}
            initial={{ y: 36, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            onClick={stop} onPointerDown={stop}
          >
            <div className="ag-sheet-title">{name}</div>
            <button className="ag-sheet-btn" autoFocus onClick={() => { onToggleClose?.(); onClose() }}>
              <IconStar size={17} filled={isClose} />
              {isClose ? 'Remove from Close' : 'Add to Close'}
            </button>
            <button className="ag-sheet-btn danger" onClick={() => { onClose(); onDelete?.() }}>
              <IconTrash size={17} />
              Delete chat
            </button>
            <button className="ag-sheet-btn cancel" onClick={onClose}>Cancel</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
