import React, { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { IconClock, IconX } from './Icons'
import {
  MIN_LEAD_MS, MAX_DAYS, buildPresets, parseLocalDateTime, toLocalDateInput, toLocalTimeInput,
  formatWhen, relativeUntil, localTimeZone, getLastScheduleTime, saveLastScheduleTime, ensureScheduleStyles,
} from '../lib/scheduleTime'

ensureScheduleStyles()

export default function ScheduleMessageModal({ conversationId, senderId, onClose, initialText = '', recipientName = '' }) {
  const [content, setContent] = useState(initialText)
  const [selected, setSelected] = useState(null) // preset id | 'custom' | null
  const [picked, setPicked] = useState(null)     // Date frozen when a preset is tapped
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)         // Date, once scheduled
  const [now, setNow] = useState(() => Date.now())

  const doneRef = useRef(false)
  const closeTimer = useRef(null)
  const textareaRef = useRef(null)
  const scheduleRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const presets = useMemo(() => buildPresets(new Date(now)), [now])
  const when = selected === 'custom' ? parseLocalDateTime(date, time) : picked
  const tz = localTimeZone()

  function close() {
    clearTimeout(closeTimer.current)
    onClose(doneRef.current)
  }

  function selectPreset(p) {
    setSelected(p.id)
    setPicked(p.date)
    setDate(toLocalDateInput(p.date))
    setTime(toLocalTimeInput(p.date))
    setError('')
  }

  function openCustom() {
    if (selected === 'custom') return
    setSelected('custom')
    setError('')
    if (!date) {
      const tomorrow = new Date(now + 86400000)
      setDate(toLocalDateInput(tomorrow))
      setTime(getLastScheduleTime() || '09:00')
    }
  }

  async function handleSchedule() {
    if (sending || done) return
    const text = content.trim()
    if (!text) { setError('Write a message first.'); textareaRef.current?.focus(); return }
    if (!when) { setError('Pick when to send it.'); return }
    if (when.getTime() < Date.now() + MIN_LEAD_MS) { setError('Pick a time at least 5 minutes from now.'); return }
    if (when.getTime() > Date.now() + MAX_DAYS * 86400000) { setError('You can schedule up to a year ahead.'); return }

    setSending(true)
    setError('')
    const { error: err } = await supabase.from('scheduled_messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: text,
      scheduled_for: when.toISOString(),
      status: 'pending',
    })
    setSending(false)

    if (err) {
      console.error('Schedule failed:', err)
      setError("Couldn't schedule that. Check your connection and try again.")
      return
    }
    if (selected === 'custom') saveLastScheduleTime(toLocalTimeInput(when))
    doneRef.current = true
    setDone(when)
    closeTimer.current = setTimeout(() => onClose(true), 1600)
  }
  scheduleRef.current = handleSchedule

  // Esc closes, Ctrl/Cmd+Enter schedules.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); scheduleRef.current?.() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const previewOk = when && !Number.isNaN(when.getTime()) && when.getTime() > now

  return (
    <div className="sch-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="sch-sheet" role="dialog" aria-modal="true" aria-labelledby="sch-title">
        {done ? (
          <div className="sch-done">
            <div className="sch-done-check">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <div className="sch-done-title">Scheduled</div>
            <div className="sch-done-sub">
              {recipientName ? `To ${recipientName} · ` : ''}{formatWhen(done)}
            </div>
            <button className="sch-btn" style={{ width: '100%', flex: 'none' }} onClick={close}>Done</button>
          </div>
        ) : (
          <>
            <div className="sch-head">
              <div className="sch-head-icon"><IconClock size={18} /></div>
              <div>
                <div className="sch-title" id="sch-title">Schedule message</div>
                {recipientName && <div className="sch-sub">Sending to {recipientName}</div>}
              </div>
              <button className="sch-x" onClick={close} aria-label="Close"><IconX size={14} /></button>
            </div>

            <textarea
              ref={textareaRef}
              className="sch-textarea"
              placeholder="Write your message…"
              value={content}
              onChange={(e) => { setContent(e.target.value); setError('') }}
              rows={3}
              autoFocus
              aria-label="Message"
            />

            <span className="sch-label">When</span>
            <div className="sch-presets">
              {presets.map((p) => (
                <button
                  key={p.id}
                  className={`sch-preset ${selected === p.id ? 'on' : ''}`}
                  aria-pressed={selected === p.id}
                  onClick={() => selectPreset(p)}
                >
                  <span className="sch-preset-label">{p.label}</span>
                  <span className="sch-preset-time">{formatWhen(p.date, new Date(now))}</span>
                </button>
              ))}
              <button
                className={`sch-preset wide ${selected === 'custom' ? 'on' : ''}`}
                aria-pressed={selected === 'custom'}
                onClick={openCustom}
              >
                <IconClock size={14} />
                <span className="sch-preset-label">Pick date &amp; time</span>
              </button>
            </div>

            {selected === 'custom' && (
              <>
                <div className="sch-fields">
                  <label className="sch-field">
                    <span>Date</span>
                    <input
                      type="date"
                      className="sch-input"
                      value={date}
                      min={toLocalDateInput(new Date(now + MIN_LEAD_MS))}
                      max={toLocalDateInput(new Date(now + MAX_DAYS * 86400000))}
                      onChange={(e) => { setDate(e.target.value); setError('') }}
                    />
                  </label>
                  <label className="sch-field">
                    <span>Time</span>
                    <input
                      type="time"
                      className="sch-input"
                      value={time}
                      onChange={(e) => { setTime(e.target.value); setError('') }}
                    />
                  </label>
                </div>
                {tz && <div className="sch-tz">Times are in your time zone ({tz}).</div>}
              </>
            )}

            {previewOk && (
              <div className="sch-preview" aria-live="polite">
                Will send <strong>{formatWhen(when, new Date(now))}</strong> · {relativeUntil(when, now)}
              </div>
            )}
            {error && <div className="sch-error" role="alert">{error}</div>}

            <div className="sch-actions">
              <button className="sch-btn-ghost" onClick={close}>Cancel</button>
              <button className="sch-btn" onClick={handleSchedule} disabled={sending}>
                {sending ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
            <div className="sch-hint">Tip: Ctrl+Enter to schedule</div>
          </>
        )}
      </div>
    </div>
  )
}
