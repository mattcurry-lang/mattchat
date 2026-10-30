import React from 'react'

const PHONE = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z'

/** Phone or camera, with a small arrow that shows direction: ↗ you called, ↙ it came to you. */
export default function CallGlyph({ kind = 'voice', dir = 'unknown', size = 18 }) {
  return (
    <span className="ag-glyph" style={{ width: size, height: size }} aria-hidden="true">
      {kind === 'video' ? (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="13" height="12" rx="3" /><path d="M22 8.5v7l-5-3.5z" /></svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={PHONE} /></svg>
      )}
      {dir !== 'unknown' && (
        <svg className="ag-glyph-arrow" width={size * 0.6} height={size * 0.6} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {dir === 'out' ? <path d="M3 9l6-6M4.5 3H9v4.5" /> : <path d="M9 3L3 9M7.5 9H3V4.5" />}
        </svg>
      )}
    </span>
  )
}
