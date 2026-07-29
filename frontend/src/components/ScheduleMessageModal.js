import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { IconClock, IconX } from './Icons'

export default function ScheduleMessageModal({ conversationId, senderId, onClose }) {
  const [content, setContent] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const minDatetime = new Date(Date.now() + 5 * 60 * 1000)
  const minDate = minDatetime.toISOString().split('T')[0]

  async function handleSchedule() {
    if (!content.trim()) return setError('Write a message first.')
    if (!date || !time) return setError('Pick a date and time.')

    // Ensure seconds are attached for cross-browser ISO compatibility
    const scheduledFor = new Date(`${date}T${time.length === 5 ? time + ':00' : time}`)

    if (isNaN(scheduledFor.getTime())) return setError('Invalid date or time selected.')
    if (scheduledFor < minDatetime) return setError('Must be at least 5 minutes from now.')

    setSending(true)
    setError('')

    const { error: err } = await supabase.from('scheduled_messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending',
    })

    setSending(false)
    if (err) return setError('Failed to schedule. Try again.')
    onClose(true)
  }

  // Format date preview safely
  const previewDate =
    date && time ? new Date(`${date}T${time.length === 5 ? time + ':00' : time}`) : null

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose(false)}>
      <div className="modal-panel">
        <div className="modal-header">
          <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconClock size={15} /> Schedule Message
          </span>
          <button className="modal-close" onClick={() => onClose(false)} aria-label="Close">
            <IconX size={13} />
          </button>
        </div>

        <textarea
          className="modal-textarea"
          placeholder="Type your message..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          autoFocus
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Date
            </label>
            <input
              type="date"
              className="modal-input"
              value={date}
              min={minDate}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Time
            </label>
            <input
              type="time"
              className="modal-input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        {previewDate && !isNaN(previewDate.getTime()) && (
          <div className="modal-preview">
            Will send:{' '}
            <strong style={{ color: 'var(--accent-2)' }}>
              {previewDate.toLocaleString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>
          </div>
        )}

        {error && <div className="modal-error">{error}</div>}

        <button
          className="btn-primary"
          onClick={handleSchedule}
          disabled={sending}
          style={{ opacity: sending ? 0.6 : 1 }}
        >
          {sending ? 'Scheduling...' : 'Schedule Message'}
        </button>
      </div>
    </div>
  )
}
