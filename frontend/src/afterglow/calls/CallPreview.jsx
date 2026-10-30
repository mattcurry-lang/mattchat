import React from 'react'
import CallGlyph from './CallGlyph'
import { callPreview } from './callEvents'
import './afterglow-calls.css'

/** The call line in the chat list, from the viewer's side: "Missed voice call" in rose, "Voice call · 2 min" and so on. */
export default function CallPreview({ content, meId }) {
  const p = callPreview(content, meId)
  if (!p) return null
  return (
    <span className={`ag-call-prev tone-${p.tone}`}>
      <CallGlyph kind={p.icon} dir={p.dir} size={12} />
      {p.text}
    </span>
  )
}
