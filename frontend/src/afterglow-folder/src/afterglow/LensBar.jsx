import React from 'react'
import { motion } from 'framer-motion'
import './afterglow.css'

const LENSES = [
  { id: 'now', label: 'Now' },
  { id: 'close', label: 'Close' },
  { id: 'all', label: 'All' },
]

/**
 * The lens replaces the row of filter chips. Three words, one sliding glow.
 * Tap a lens, or swipe the list sideways. The older filters (Unread, Group,
 * AI, tags) are still there — tucked behind the small toggle on the right.
 */
export default function LensBar({ lens, onChange, counts = {}, moreActive = false, moreOpen = false, onToggleMore, children }) {
  return (
    <div className="ag-lens-wrap">
      <div className="ag-lens">
        <div className="ag-lens-track" role="tablist" aria-label="Chat lens">
          {LENSES.map((l) => (
            <button key={l.id} role="tab" aria-selected={lens === l.id}
              className={`ag-lens-btn${lens === l.id ? ' on' : ''}`} onClick={() => onChange(l.id)}>
              {lens === l.id && (
                <motion.span layoutId="ag-lens-pill" className="ag-lens-pill"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }} />
              )}
              <span className="ag-lens-label">
                {l.label}
                {l.id !== 'all' && counts[l.id] > 0 && <i className="ag-lens-count">{counts[l.id]}</i>}
              </span>
            </button>
          ))}
        </div>
        {onToggleMore && (
          <button className={`ag-more${moreOpen || moreActive ? ' on' : ''}`} onClick={onToggleMore}
            aria-label="More filters" aria-expanded={moreOpen} title="More filters">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="17" x2="14" y2="17" />
            </svg>
            {moreActive && !moreOpen && <span className="ag-more-dot" />}
          </button>
        )}
      </div>
      {moreOpen && <div className="ag-more-panel">{children}</div>}
    </div>
  )
}

export function LensEmpty({ lens }) {
  const copy = lens === 'close'
    ? { t: 'Nobody in Close yet', s: 'Hover a chat and tap the star, or press and hold it, to keep your people near.' }
    : { t: 'Quiet right now', s: 'Chats that are active, unread, or online show up here. Switch to All to see everything.' }
  return (
    <div className="ag-empty">
      <div className="ag-empty-orb" />
      <div className="ag-empty-title">{copy.t}</div>
      <div className="ag-empty-sub">{copy.s}</div>
    </div>
  )
}
