import React, { useState } from 'react'
import { useTasks } from '../../hooks/useTasks'
import { confirmTask, dismissTask, completeTask, updateTask } from '../../lib/supabase'

const PRIORITY_COLOR = { urgent: '#ef4444', high: '#f59e0b', medium: '#a78bfa', low: '#6b7280' }

function RescheduleRow({ task, onDone }) {
  const [date, setDate] = useState(task.due_date || '')
  const [time, setTime] = useState(task.due_time || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await updateTask(task.id, { due_date: date || null, due_time: time || null })
      onDone()
    } catch (e) {
      console.error('Reschedule failed:', e)
    }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
        style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', color: 'var(--text-primary)', fontSize: 11.5, fontFamily: 'inherit' }} />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
        style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', color: 'var(--text-primary)', fontSize: 11.5, fontFamily: 'inherit' }} />
      <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
        {saving ? '…' : 'Save'}
      </button>
      <button onClick={onDone} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 11, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
        Cancel
      </button>
    </div>
  )
}

function TaskCard({ task, onConfirm, onDismiss, onComplete, onOpenSourceEmail }) {
  const isPending = task.status === 'pending'
  const [rescheduling, setRescheduling] = useState(false)

  return (
    <div style={{
      background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{task.title}</div>
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: PRIORITY_COLOR[task.priority] || '#a78bfa',
          background: `${PRIORITY_COLOR[task.priority] || '#a78bfa'}22`, borderRadius: 20, padding: '2px 8px',
        }}>{task.priority?.toUpperCase()}</span>
      </div>

      {task.description && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{task.description}</div>}

      <div style={{ display: 'flex', gap: 10, fontSize: 11.5, color: 'var(--text-muted)' }}>
        {task.due_date && <span>📅 {task.due_date}{task.due_time ? ` · ${task.due_time}` : ''}</span>}
        {task.category && <span>🏷️ {task.category}</span>}
        {task.source === 'email' && task.emails && <span>📧 from {task.emails.sender}</span>}
      </div>

      {task.checklist?.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
          {task.checklist.map((c, i) => <li key={i}>{c.label}</li>)}
        </ul>
      )}

      {rescheduling && <RescheduleRow task={task} onDone={() => setRescheduling(false)} />}

      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        {isPending ? (
          <>
            <button onClick={() => onConfirm(task.id)} style={btnStyle('#667eea')}>Confirm task</button>
            <button onClick={() => onDismiss(task.id)} style={btnStyle('transparent', true)}>Not relevant</button>
          </>
        ) : (
          <>
            {task.status !== 'completed' && (
              <button onClick={() => onComplete(task.id)} style={btnStyle('#22c55e')}>Mark complete</button>
            )}
            {task.status !== 'completed' && !rescheduling && (
              <button onClick={() => setRescheduling(true)} style={btnStyle('transparent', true)}>Reschedule</button>
            )}
            {task.source === 'email' && task.source_email_id && (
              <button onClick={() => onOpenSourceEmail(task)} style={btnStyle('transparent', true)}>View email</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function btnStyle(bg, ghost = false) {
  return {
    background: ghost ? 'none' : bg, border: ghost ? '1px solid var(--border)' : 'none',
    borderRadius: 20, color: ghost ? 'var(--text-muted)' : '#fff', fontSize: 11.5, fontWeight: 700,
    padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
  }
}

export default function TasksPage({ userId }) {
  const { pendingConfirmation, active, completed, loading, reload } = useTasks(userId)

  const handle = (fn) => async (taskId) => { await fn(taskId); reload() }
  const onConfirm = handle(confirmTask)
  const onDismiss = handle(dismissTask)
  const onComplete = handle(completeTask)

  // Simple v1: since we don't have a full email-reading UI yet, this
  // just alerts with the subject/sender — swap for a real modal/view
  // once an email detail screen exists elsewhere in the app.
  const onOpenSourceEmail = (task) => {
    const email = task.emails
    alert(email ? `From: ${email.sender}\nSubject: ${email.subject}` : 'Original email not found.')
  }

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading tasks…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 16, maxWidth: 640, margin: '0 auto' }}>
      {pendingConfirmation.length > 0 && (
        <section>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24', marginBottom: 8 }}>
            Needs your confirmation ({pendingConfirmation.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingConfirmation.map(t => <TaskCard key={t.id} task={t} onConfirm={onConfirm} onDismiss={onDismiss} onComplete={onComplete} onOpenSourceEmail={onOpenSourceEmail} />)}
          </div>
        </section>
      )}

      <section>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
          Active ({active.length})
        </h3>
        {active.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Nothing active — you're caught up.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {active.map(t => <TaskCard key={t.id} task={t} onConfirm={onConfirm} onDismiss={onDismiss} onComplete={onComplete} onOpenSourceEmail={onOpenSourceEmail} />)}
          </div>
        )}
      </section>

      {completed.length > 0 && (
        <section>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8 }}>
            Completed ({completed.length})
          </h3>
        </section>
      )}
    </div>
  )
}
