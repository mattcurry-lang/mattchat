import React, { useEffect, useState } from 'react'
import CallBackdrop from './CallBackdrop'
import CallAvatar from './CallAvatar'
import { callHue, formatElapsed, outgoingHint, outgoingLabel, outgoingKey } from './callUiLogic'
import './afterglow-call-ui.css'

const PhoneDown = () => (<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: 'rotate(135deg)' }}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>)

/**
 * Outgoing call. A drop-in for OutgoingCallScreen (same props). It now shows how long you've been ringing, says so
 * when it's taking a while, and keeps the Zoom hand-off. The old Bluetooth button was disabled and did nothing, so it's gone.
 */
export default function OutgoingCall({ callerName = '', callType, status, avatarUrl, onCancel, provider = 'daily', zoomUrl }) {
  const isZoom = provider === 'zoom'
  const isVideo = callType === 'video'
  const kind = { isZoom, isVideo }
  const hue = callHue(callerName)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const onKey = (e) => { if (outgoingKey(e) === 'cancel') { e.preventDefault(); if (onCancel) onCancel() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const hint = outgoingHint(elapsed)
  return (
    <div className="acu-full" role="dialog" aria-modal="true" aria-label={`${outgoingLabel(kind, status)} to ${callerName}`} style={{ '--ah': hue }}>
      <CallBackdrop hue={hue} photo={avatarUrl} mood="calling" />
      <header className="acu-top">
        <span className="acu-status"><i className="acu-dot" />{outgoingLabel(kind, status)}<span className="acu-ell" aria-hidden="true" /></span>
      </header>
      <main className="acu-center">
        <CallAvatar name={callerName} url={avatarUrl} size={156} />
        <h1 className="acu-name">{callerName}</h1>
        <p className="acu-sub">{isZoom ? 'Mattchat × Zoom' : isVideo ? 'Mattchat Video' : 'Mattchat Voice'}</p>
        <p className="acu-timer" aria-live="off">{formatElapsed(elapsed)}</p>
        <p className="acu-hint" aria-live="polite">{hint || '\u00a0'}</p>
        {isZoom && zoomUrl && (<a className="acu-pill" href={zoomUrl} target="_blank" rel="noopener noreferrer">Open Zoom again</a>)}
      </main>
      <footer className="acu-bottom">
        <div className="acu-main-actions single">
          <div className="acu-act"><button className="acu-big decline" onClick={onCancel} aria-label="Cancel call"><PhoneDown /></button><span>Cancel</span></div>
        </div>
        <p className="acu-keys" aria-hidden="true"><kbd>Esc</kbd> cancel</p>
      </footer>
    </div>
  )
}
