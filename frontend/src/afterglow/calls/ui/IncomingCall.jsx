import React, { useEffect, useRef, useState } from 'react'
import { useRingtone } from '../../../hooks/useRingtone'
import { useCustomRingtone } from '../../../hooks/useCustomRingtone'
import CallBackdrop from './CallBackdrop'
import CallAvatar from './CallAvatar'
import { RING_SECONDS, QUICK_DECLINE_REPLIES, callHue, ringRemaining, incomingLabel, subLabel, missesLabel, incomingKey } from './callUiLogic'
import './afterglow-call-ui.css'

const PhoneUp = () => (<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>)
const PhoneDown = () => (<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: 'rotate(135deg)' }}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>)
const Chat = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" /></svg>)
const MicOff = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 1l22 22M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.7M17 16.9A7 7 0 0 1 5 12M19 12a7 7 0 0 1-.1 1.1M12 19v3" /></svg>)
const Expand = ({ collapse }) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{collapse ? <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /> : <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />}</svg>)

const buzz = (ms = 14) => { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms) } catch { /* not supported */ } }
const prefersCompact = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(min-width: 640px)').matches

/**
 * Incoming call. A drop-in for IncomingCallModal (same props), with these extras:
 *   onQuickReply(text)  → "Message": decline and send a preset instead of ignoring the caller (iOS 26 Live Reply)
 *   recentMisses        → "Called 3 times just before this"
 * Hybrid of what the big apps do:
 *   Telegram   living gradient background + ripples around the photo
 *   WhatsApp   big tap-to-answer / decline buttons (no swipe), and "answer muted"
 *   iOS 26     a compact banner when you're at a computer, full screen on a phone, and decline-with-a-message
 * Safety: Answer and Decline are 160px apart, keyboard shortcuts are ignored while you type, and the call still
 * auto-declines after 45s exactly like before.
 */
export default function IncomingCall({ callerName = 'Unknown', callType, avatarUrl, onAnswer, onDecline, userId, provider = 'daily', onQuickReply, recentMisses = 0 }) {
  const isZoom = provider === 'zoom'
  const isVideo = callType === 'video'
  const kind = { isZoom, isVideo }
  const hue = callHue(callerName)
  const canReply = typeof onQuickReply === 'function'

  const [compact, setCompact] = useState(prefersCompact)
  const [sheet, setSheet] = useState(false)
  const [startMuted, setStartMuted] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const startRef = useRef(Date.now())
  const declineRef = useRef(onDecline)
  declineRef.current = onDecline

  // same ringtone logic as the old screen: a custom ringtone if the user chose one, else the bundled default
  const hasCustomRingtone = useCustomRingtone(userId, true)
  useRingtone(hasCustomRingtone === false, 'ringtone')

  // auto-decline after 45s (kept in a ref so a new onDecline function from the parent can't restart the clock)
  useEffect(() => {
    const t = setTimeout(() => { if (declineRef.current) declineRef.current() }, RING_SECONDS * 1000)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t) }, [])

  const answer = () => { buzz(); if (onAnswer) onAnswer(startMuted) }
  const decline = () => { buzz(); if (onDecline) onDecline() }
  const reply = (text) => { buzz(); setSheet(false); if (onQuickReply) onQuickReply(text) }

  useEffect(() => {
    const onKey = (e) => {
      const a = incomingKey(e, { sheetOpen: sheet, canReply })
      if (!a) return
      e.preventDefault()
      if (a === 'answer') answer(); else if (a === 'decline') decline(); else if (a === 'message') setSheet(true); else if (a === 'close') setSheet(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, canReply, startMuted])

  const { remaining, ratio } = ringRemaining(startRef.current, now)
  const label = incomingLabel(kind)
  const misses = missesLabel(recentMisses)

  const replySheet = sheet && (
    <div className="acu-sheet-wrap" onClick={() => setSheet(false)}>
      <div className="acu-sheet" role="dialog" aria-label="Reply with a message" onClick={(e) => e.stopPropagation()}>
        <div className="acu-sheet-title">Decline and send {callerName} a message</div>
        {QUICK_DECLINE_REPLIES.map((r) => (<button key={r} className="acu-sheet-btn" onClick={() => reply(r)}>{r}</button>))}
        <button className="acu-sheet-btn cancel" onClick={() => setSheet(false)}>Never mind</button>
      </div>
    </div>
  )

  if (compact) {
    return (
      <div className="acu-compact" role="alertdialog" aria-label={`${label} from ${callerName}`} style={{ '--ah': hue }}>
        <CallBackdrop hue={hue} photo={avatarUrl} mood="ringing" />
        <div className="acu-c-row">
          <CallAvatar name={callerName} url={avatarUrl} size={52} ripples={false} ratio={ratio} />
          <div className="acu-c-text">
            <b>{callerName}</b>
            <span>{label}</span>
            {misses && <em className="acu-chip rose">{misses}</em>}
          </div>
          <div className="acu-c-actions">
            <button className="acu-mini decline" onClick={decline} aria-label="Decline"><PhoneDown /></button>
            {canReply && <button className="acu-mini ghost" onClick={() => setSheet(true)} aria-label="Decline and reply with a message" title="Message (M)"><Chat /></button>}
            <button className="acu-mini answer" onClick={answer} aria-label="Answer"><PhoneUp /></button>
            <button className="acu-mini ghost" onClick={() => setCompact(false)} aria-label="Expand to full screen" title="Full screen"><Expand /></button>
          </div>
        </div>
        {replySheet}
      </div>
    )
  }

  return (
    <div className="acu-full" role="alertdialog" aria-modal="true" aria-label={`${label} from ${callerName}`} style={{ '--ah': hue }}>
      <CallBackdrop hue={hue} photo={avatarUrl} mood="ringing" />
      <header className="acu-top">
        <span className="acu-status"><i className="acu-dot" />{label}<span className="acu-ell" aria-hidden="true" /></span>
        {prefersCompact() && <button className="acu-mini ghost" onClick={() => setCompact(true)} aria-label="Minimise to a banner" title="Minimise"><Expand collapse /></button>}
      </header>

      <main className="acu-center">
        <CallAvatar name={callerName} url={avatarUrl} size={156} ratio={ratio} />
        <h1 className="acu-name">{callerName}</h1>
        <p className="acu-sub">{subLabel(kind)}</p>
        {misses && <span className="acu-chip rose">{misses}</span>}
        <p className="acu-timer" aria-live="off">Rings for {remaining}s</p>
      </main>

      <footer className="acu-bottom">
        <div className="acu-main-actions">
          <div className="acu-act"><button className="acu-big decline" onClick={decline} aria-label="Decline"><PhoneDown /></button><span>Decline</span></div>
          <div className="acu-act"><button className="acu-big answer" onClick={answer} aria-label={startMuted ? 'Answer, microphone muted' : 'Answer'}><PhoneUp /></button><span>{startMuted ? 'Answer muted' : 'Answer'}</span></div>
        </div>
        <div className="acu-secondary">
          {canReply && <button className="acu-pill" onClick={() => setSheet(true)}><Chat />Message</button>}
          <button className={`acu-pill${startMuted ? ' on' : ''}`} onClick={() => setStartMuted((v) => !v)} aria-pressed={startMuted}><MicOff />{startMuted ? 'Joining muted' : 'Join muted'}</button>
        </div>
        <p className="acu-keys" aria-hidden="true"><kbd>Enter</kbd> answer · <kbd>Esc</kbd> decline{canReply ? <> · <kbd>M</kbd> message</> : null}</p>
      </footer>
      {replySheet}
    </div>
  )
}
