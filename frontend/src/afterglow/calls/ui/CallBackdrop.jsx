import React from 'react'
import { palette } from './callUiLogic'
import './afterglow-call-ui.css'

/**
 * The living background (Telegram's idea): four colour blobs drifting slowly, tinted from the caller's own hue,
 * over a heavily blurred, darkened copy of their photo. `mood` changes the pace and warmth:
 *   ringing (incoming) → lively    calling (outgoing) → calm    ended → cools off
 * A scrim sits behind the text so contrast holds on every hue (checked: white text >= 4.5:1 in the worst case).
 */
export default function CallBackdrop({ hue = 258, photo = null, mood = 'ringing' }) {
  const [a, b, c, d] = palette(hue)
  return (
    <div className={`acu-bg mood-${mood}`} aria-hidden="true" style={{ '--a': a, '--b': b, '--c': c, '--d': d }}>
      {photo && <div className="acu-bg-photo" style={{ backgroundImage: `url(${JSON.stringify(photo)})` }} />}
      <i className="acu-blob b1" /><i className="acu-blob b2" /><i className="acu-blob b3" /><i className="acu-blob b4" />
      <div className="acu-scrim" />
      <div className="acu-grain" />
    </div>
  )
}
