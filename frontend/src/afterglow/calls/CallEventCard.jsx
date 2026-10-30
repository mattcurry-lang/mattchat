import React, { useState, useMemo } from 'react'
import CallGlyph from './CallGlyph'
import { parseCallLog, matchCall, directionOf, describeCall, formatCallDuration, QUICK_REPLIES } from './callEvents'
import './afterglow-calls.css'

const DAY = 24 * 60 * 60 * 1000
const defaultFmt = (iso) => { try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) } catch { return '' } }

const Mic = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>)
const Check = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>)

/**
 * A call, shown in the chat the way the people in it experienced it.
 *   - says "Missed" to the person who missed it and "No answer" to the person who called (WhatsApp)
 *   - tells Missed / Cancelled / Declined apart (Telegram)
 *   - carries the action right on the card: Call back / Call again (Messenger)
 *   - a run of missed calls becomes ONE card with a count, and a missed call you've since answered says so
 *   - after a miss: send a voice note, or a one-tap "Call you in 5 min" (WhatsApp's voice-note-after-a-missed-call, Samsung-style quick replies)
 *
 * All the app-specific pieces arrive as props on `msg` (the same way the other message types get theirs).
 */
export default function CallEventCard({ msg, timeLabel }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState('')
  const meId = msg._currentUserId
  const ctx = msg._callCtx || {}
  const fmt = ctx.fmt || defaultFmt

  const view = useMemo(() => {
    const parsed = parseCallLog(msg.content)
    if (!parsed) return null
    const matched = matchCall(msg, parsed, ctx.history)
    const dir = directionOf(parsed, { meId, senderId: msg.sender_id, matched })
    return { parsed, dir, d: describeCall(parsed, dir, { name: ctx.otherName, isGroup: ctx.isGroup }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg.content, msg.created_at, msg.sender_id, meId, ctx.history, ctx.otherName, ctx.isGroup])
  if (!view) return null

  const { parsed, dir, d } = view
  const burst = ctx.burst
  const count = burst ? burst.count : 1
  const resolved = ctx.resolved
  const fresh = Date.now() - Date.parse(msg.created_at) < DAY
  const needs = d.needsReply && !resolved
  const showQuick = needs && fresh          // one-tap replies: only for the person who missed it
  const showVoice = d.voiceNote && !resolved && fresh // a voice note: also for the caller after "No answer" (WhatsApp)

  const kindWord = parsed.isVideo ? 'video' : 'voice'
  const noun = `${ctx.isGroup ? 'group ' : ''}${kindWord} call`
  let title = d.title
  let detail = d.detail
  if (count > 1) {
    if (d.id === 'missed') { title = `${count} missed ${noun}s`; detail = ctx.otherName ? `${ctx.otherName} tried to reach you` : 'They tried to reach you' }
    else { detail = `No answer · ${count} attempts` }
  }
  const when = timeLabel || fmt(msg.created_at)
  const startedAt = parsed.status === 'completed' && parsed.duration > 0 ? fmt(new Date(Date.parse(msg.created_at) - parsed.duration * 1000).toISOString()) : null
  const who = dir === 'out' ? 'You' : (ctx.otherName || 'They')

  const callBack = (e) => { e.stopPropagation(); msg._onCallBack && msg._onCallBack(parsed.callType, parsed.zoom) }
  const voiceNote = (e) => { e.stopPropagation(); msg._onCallVoiceNote && msg._onCallVoiceNote() }
  const quick = (e, text) => { e.stopPropagation(); setSent(text); msg._onCallQuickReply && msg._onCallQuickReply(text) }
  const toggle = () => setOpen((v) => !v)

  return (
    <div className="ag-call-wrap">
      <div
        className={`ag-call tone-${d.tone}${needs ? ' needs' : ''}${resolved ? ' is-resolved' : ''}${open ? ' open' : ''}`}
        role="group" aria-label={`${title}. ${detail}. ${when}`}
      >
        <div className="ag-call-main" role="button" tabIndex={0} aria-expanded={open} onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}>
          <span className="ag-call-ic"><CallGlyph kind={kindWord} dir={dir} size={18} /></span>
          <span className="ag-call-body">
            <span className="ag-call-title">{title}{count > 1 && d.id !== 'missed' && <b className="ag-call-count">×{count}</b>}{parsed.zoom && <i className="ag-call-badge">Zoom</i>}</span>
            <span className="ag-call-sub">{count > 1 ? `Last at ${when}` : when}{detail ? ` · ${detail}` : ''}</span>
          </span>
          <svg className="ag-call-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </div>

        {open && (
          <div className="ag-call-more">
            {count > 1 ? (
              <ul className="ag-call-times">{burst.times.map((t) => (<li key={t}>{fmt(t)}</li>))}</ul>
            ) : (
              <dl>
                <div><dt>{dir === 'unknown' ? 'Call' : 'Started by'}</dt><dd>{dir === 'unknown' ? kindWord : who}</dd></div>
                {startedAt && <div><dt>Time</dt><dd>{startedAt} – {when}</dd></div>}
                {parsed.duration > 0 && <div><dt>Length</dt><dd>{formatCallDuration(parsed.duration)}</dd></div>}
              </dl>
            )}
          </div>
        )}

        <div className="ag-call-actions">
          {resolved ? (
            <>
              <span className="ag-call-done"><Check />{resolved.kind === 'called' ? 'You called back' : 'You replied'} · {fmt(resolved.at)}</span>
              <button className="ag-call-btn ghost" onClick={callBack}>Call again</button>
            </>
          ) : (
            <>
              <button className="ag-call-btn primary" onClick={callBack}><CallGlyph kind={kindWord} size={14} />{d.backLabel}</button>
              {showVoice && <button className="ag-call-btn" onClick={voiceNote}><Mic />Voice note</button>}
            </>
          )}
        </div>

        {showQuick && (
          <div className="ag-call-quick" aria-label="Quick replies">
            {sent ? (
              <span className="ag-call-done"><Check />Sent: “{sent}”</span>
            ) : QUICK_REPLIES.map((q) => (<button key={q} className="ag-call-chip" onClick={(e) => quick(e, q)}>{q}</button>))}
          </div>
        )}
      </div>
    </div>
  )
}
