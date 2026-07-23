import React from 'react'
import { useTasks } from '../../hooks/useTasks'
import { confirmTask, dismissTask, completeTask } from '../../lib/supabase'

const PRIORITY_COLOR = { urgent: '#ef4444', high: '#f59e0b', medium: '#a78bfa', low: '#6b7280' }

function TaskCard({ task, onConfirm, onDismiss, onComplete }) {
  const isPending = task.status === 'pending'
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

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {isPending ? (
          <>
            <button onClick={() => onConfirm(task.id)} style={btnStyle('#667eea')}>Confirm task</button>
            <button onClick={() => onDismiss(task.id)} style={btnStyle('transparent', true)}>Not relevant</button>
          </>
        ) : (
          <button onClick={() => onComplete(task.id)} style={btnStyle('#22c55e')}>Mark complete</button>
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

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading tasks…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 16, maxWidth: 640, margin: '0 auto' }}>
      {pendingConfirmation.length > 0 && (
        <section>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24', marginBottom: 8 }}>
            Needs your confirmation ({pendingConfirmation.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingConfirmation.map(t => <TaskCard key={t.id} task={t} onConfirm={onConfirm} onDismiss={onDismiss} onComplete={onComplete} />)}
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
            {active.map(t => <TaskCard key={t.id} task={t} onConfirm={onConfirm} onDismiss={onDismiss} onComplete={onComplete} />)}
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
