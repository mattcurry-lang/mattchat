import React, { useState, useEffect } from 'react'
import { initialOf } from './callUiLogic'
import './afterglow-call-ui.css'

/**
 * The caller's photo in a circle, with ripples that spread outward while it rings, and an optional countdown arc.
 * The photo is forced to fill its circle (width/height 100% + object-fit) — the old screen only set `inset: 0`, which
 * does not stretch an <img>, so large photos (and your logo avatar) rendered at full size and covered the screen.
 * If the photo is missing or fails to load, a gradient circle with their initial is shown instead.
 */
export default function CallAvatar({ name, url, size = 150, ripples = true, ratio = null }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [url])
  const r = size / 2 + 9
  const circ = 2 * Math.PI * r
  return (
    <div className="acu-avatar" style={{ width: size, height: size }}>
      {ripples && (<><i className="acu-ripple" /><i className="acu-ripple r2" /><i className="acu-ripple r3" /></>)}
      {ratio != null && (
        <svg className="acu-arc" width={size + 26} height={size + 26} viewBox={`${-(size + 26) / 2} ${-(size + 26) / 2} ${size + 26} ${size + 26}`} aria-hidden="true">
          <circle r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
          <circle r={r} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="3" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - ratio)} transform="rotate(-90)" />
        </svg>
      )}
      <div className="acu-avatar-in">
        {url && !failed
          ? <img src={url} alt="" draggable={false} onError={() => setFailed(true)} />
          : <span className="acu-initial" style={{ fontSize: size * 0.42 }}>{initialOf(name)}</span>}
      </div>
    </div>
  )
}
