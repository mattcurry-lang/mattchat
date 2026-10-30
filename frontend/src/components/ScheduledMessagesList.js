import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { IconClock, IconX } from './Icons'
import {
  MIN_LEAD_MS, parseLocalDateTime, toLocalDateInput, toLocalTimeInput,
  formatTime, dayLabel, relativeUntil, ensureScheduleStyles,
} from '../lib/scheduleTime'

ensureScheduleStyles()

export default function ScheduledMessagesList({ conversationId, currentUserId, onClose }) {
  const [scheduled, setScheduled] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [busyId, setBusyId] = useState(null)
  const [confirmId, setConfirmId] = useState(null) // "send now?" asked for this id
  const [editing, setEditing] = useState(null)     // { id, content, date, time }
  const [editError, setEditError] = useState('')
  const [undo, setUndo] = useState(null)           // cancelled item that can still be restored
  const [notice, setNotice] = useState('')
  const undoTimer = useRef(null)
  const noticeTimer = useRef(null)

  const fetchScheduled = useCallback(async () => {
    const { data, error } = await supabase
      .from('scheduled_messages').select('*')
      .eq('conversation_id', conversationId)
      .eq('sender_id', currentUserId)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true })
    if (error) setLoadError(true)
    else { setLoadError(false); setScheduled(data || []) }
    setLoading(false)
  }, [conversationId, currentUserId])

  useEffect(() => {
    fetchScheduled()
    const sub = supabase
      .channel(`scheduled:${conversationId}:${currentUserId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'scheduled_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => fetchScheduled())
      .subscribe()
    // Realtime can drop, so also refresh every 30s (this keeps the countdowns fresh too).
    const tick = setInterval(() => { setNow(Date.now()); fetchScheduled() }, 30000)
    return () => { supabase.removeChannel(sub); clearInterval(tick) }
  }, [conversationId, currentUserId, fetchScheduled])

  useEffect(() => () => { clearTimeout(undoTimer.current); clearTimeout(noticeTimer.current) }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function flash(msg) {
    setNotice(msg)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 4000)
  }

  // ── Cancel (with undo) ─────────────────────────────
  async function cancelMessage(item) {
    setBusyId(item.id)
    setConfirmId(null)
    setScheduled((prev) => prev.filter((m) => m.id !== item.id)) // optimistic
    const { data, error } = await supabase.from('scheduled_messages')
      .update({ status: 'cancelled' })
      .eq('id', item.id).eq('sender_id', currentUserId).eq('status', 'pending')
      .select('id')
    setBusyId(null)
    if (error || !data?.length) {
      flash("Couldn't cancel that. It may already have been sent.")
      fetchScheduled()
      return
    }
    // Only offer Undo while there's still time before it would send.
    if (new Date(item.scheduled_for).getTime() - Date.now() > 90000) {
      setUndo(item)
      clearTimeout(undoTimer.current)
      undoTimer.current = setTimeout(() => setUndo(null), 7000)
    }
  }

  async function undoCancel() {
    const item = undo
    if (!item) return
    clearTimeout(undoTimer.current)
    setUndo(null)
    const { data, error } = await supabase.from('scheduled_messages')
      .update({ status: 'pending' })
      .eq('id', item.id).eq('sender_id', currentUserId).eq('status', 'cancelled')
      .select('id')
    if (error || !data?.length) flash("Couldn't restore it.")
    fetchScheduled()
  }

  // ── Send now ───────────────────────────────────────
  // Claims the row first (pending -> sent) so the scheduler can't also send it,
  // then delivers. If delivery fails, the row goes back to pending.
  async function sendNow(item) {
    setBusyId(item.id)
    setConfirmId(null)
    const { data: claimed, error: claimErr } = await supabase.from('scheduled_messages')
      .update({ status: 'sent' })
      .eq('id', item.id).eq('sender_id', currentUserId).eq('status', 'pending')
      .select('id')
    if (claimErr || !claimed?.length) {
      flash("Couldn't send it. It may already have gone out.")
      setBusyId(null)
      fetchScheduled()
      return
    }
    const { error: msgErr } = await supabase.from('messages').insert({
      conversation_id: conversationId, sender_id: currentUserId, content: item.content, message_type: 'text',
    })
    if (msgErr) {
      console.error('Send now failed:', msgErr)
      await supabase.from('scheduled_messages').update({ status: 'pending' })
        .eq('id', item.id).eq('sender_id', currentUserId).eq('status', 'sent')
      flash("Couldn't send it. It's still scheduled.")
      setBusyId(null)
      fetchScheduled()
      return
    }
    await supabase.from('conversations')
      .update({ updated_at: new Date().toISOString(), last_message: item.content })
      .eq('id', conversationId)
    setScheduled((prev) => prev.filter((m) => m.id !== item.id))
    setBusyId(null)
    flash('Sent ✓')
  }

  // ── Edit / reschedule ──────────────────────────────
  function startEdit(item) {
    const d = new Date(item.scheduled_for)
    setConfirmId(null)
    setEditError('')
    setEditing({ id: item.id, content: item.content, date: toLocalDateInput(d), time: toLocalTimeInput(d) })
  }
  const patchEdit = (patch) => { setEditing((e) => ({ ...e, ...patch })); setEditError('') }

  async function saveEdit() {
    const text = editing.content.trim()
    const when = parseLocalDateTime(editing.date, editing.time)
    if (!text) return setEditError('The message can’t be empty.')
    if (!when) return setEditError('Pick a date and time.')
    if (when.getTime() < Date.now() + MIN_LEAD_MS) return setEditError('Pick a time at least 5 minutes from now.')

    setBusyId(editing.id)
    const { data, error } = await supabase.from('scheduled_messages')
      .update({ content: text, scheduled_for: when.toISOString() })
      .eq('id', editing.id).eq('sender_id', currentUserId).eq('status', 'pending')
      .select('id')
    setBusyId(null)
    if (error || !data?.length) {
      setEditError("Couldn't save. It may already have been sent.")
      fetchScheduled()
      return
    }
    setEditing(null)
    fetchScheduled()
    flash('Updated ✓')
  }

  // ── Group by day ───────────────────────────────────
  const groups = []
  scheduled.forEach((m) => {
    const d = new Date(m.scheduled_for)
    const key = toLocalDateInput(d)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(m)
    else groups.push({ key, label: dayLabel(d, new Date(now)), items: [m] })
  })

  return (
    <div className="sch-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sch-sheet" role="dialog" aria-modal="true" aria-labelledby="sch-list-title" style={{ minHeight: 280 }}>
        <div className="sch-head">
          <div className="sch-head-icon"><IconClock size={18} /></div>
          <div>
            <div className="sch-title" id="sch-list-title">
              Scheduled
              {scheduled.length > 0 && <span className="sch-count">{scheduled.length}</span>}
            </div>
            <div className="sch-sub">Only you see this list.</div>
          </div>
          <button className="sch-x" onClick={onClose} aria-label="Close"><IconX size={14} /></button>
        </div>

        {loading ? (
          <>
            <div className="sch-skel" />
            <div className="sch-skel" />
          </>
        ) : loadError && scheduled.length === 0 ? (
          <div className="sch-empty">
            <div className="sch-empty-title">Couldn't load your scheduled messages</div>
            <div className="sch-empty-sub">Check your connection and try again.</div>
            <button className="sch-btn" style={{ marginTop: 14, flex: 'none', padding: '10px 22px' }} onClick={fetchScheduled}>Retry</button>
          </div>
        ) : scheduled.length === 0 ? (
          <div className="sch-empty">
            <div className="sch-empty-icon"><IconClock size={22} /></div>
            <div className="sch-empty-title">Nothing scheduled in this chat</div>
            <div className="sch-empty-sub">Open the ⋯ menu and choose Schedule message to write one for later.</div>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.key}>
              <div className="sch-day">{g.label}</div>
              {g.items.map((msg) => {
                const d = new Date(msg.scheduled_for)
                const isEditing = editing?.id === msg.id
                const busy = busyId === msg.id
                return (
                  <div key={msg.id} className="sch-item">
                    {isEditing ? (
                      <div className="sch-edit">
                        <textarea
                          className="sch-textarea"
                          rows={3}
                          value={editing.content}
                          onChange={(e) => patchEdit({ content: e.target.value })}
                          aria-label="Message"
                          autoFocus
                        />
                        <div className="sch-fields" style={{ marginTop: 0 }}>
                          <label className="sch-field">
                            <span>Date</span>
                            <input type="date" className="sch-input" value={editing.date}
                              min={toLocalDateInput(new Date(now + MIN_LEAD_MS))}
                              onChange={(e) => patchEdit({ date: e.target.value })} />
                          </label>
                          <label className="sch-field">
                            <span>Time</span>
                            <input type="time" className="sch-input" value={editing.time}
                              onChange={(e) => patchEdit({ time: e.target.value })} />
                          </label>
                        </div>
                        {editError && <div className="sch-error" role="alert" style={{ marginTop: 0 }}>{editError}</div>}
                        <div className="sch-actions" style={{ marginTop: 0 }}>
                          <button className="sch-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                          <button className="sch-btn" onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="sch-item-text">{msg.content}</div>
                        <div className="sch-item-meta">
                          <span className="sch-item-time"><IconClock size={12} /> {formatTime(d)}</span>
                          <span>{relativeUntil(d, now)}</span>
                        </div>
                        <div className="sch-item-actions">
                          {confirmId === msg.id ? (
                            <>
                              <span className="sch-ask">Send this now?</span>
                              <button className="sch-link strong" onClick={() => sendNow(msg)}>Send</button>
                              <button className="sch-link" onClick={() => setConfirmId(null)}>Not yet</button>
                            </>
                          ) : (
                            <>
                              <button className="sch-link" disabled={busy} onClick={() => startEdit(msg)}>Edit</button>
                              <button className="sch-link" disabled={busy} onClick={() => setConfirmId(msg.id)}>Send now</button>
                              <button className="sch-link danger" disabled={busy} onClick={() => cancelMessage(msg)}>Cancel</button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))
        )}

        {(undo || notice) && (
          <div className="sch-toast" role="status">
            <span>{undo ? 'Message cancelled' : notice}</span>
            {undo && <button onClick={undoCancel}>Undo</button>}
          </div>
        )}
      </div>
    </div>
  )
}
