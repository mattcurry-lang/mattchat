// src/components/Tasks/AddTaskRow.jsx
// "+ Add task" at the top of the AI Tasks screen.
//   userId   current user's id
//   onAdded  optional: called after a task is saved

import React, { useState } from 'react'
import { createManualTask } from '../../lib/manualTask'

const field = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12,
  border: '1px solid var(--border)', background: 'var(--bg-surface-1, #14141f)',
  color: 'var(--dark-text, #ffffff)', colorScheme: 'dark', fontSize: 15, fontFamily: 'inherit',
}
const pill = (bg, ghost) => ({
  background: ghost ? 'none' : bg, border: ghost ? '1px solid var(--border)' : 'none',
  borderRadius: 20, color: ghost ? 'var(--text-muted)' : '#fff', fontSize: 13, fontWeight: 700,
  padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit',
})

export default function AddTaskRow({ userId, onAdded }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const close = () => { setOpen(false); setTitle(''); setDueDate(''); setError('') }

  const save = async () => {
    if (saving) return
    setError('')
    setSaving(true)
    try {
      await createManualTask(userId, { title, dueDate })
      close()
      onAdded?.()
    } catch (e) {
      setError(e?.message === 'Please enter a task title.' ? e.message : 'Couldn’t save the task. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ ...pill('#667eea'), alignSelf: 'flex-start', fontSize: 13.5, padding: '9px 18px' }}>
        + Add task
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-surface-1, #14141f)' }}>
      <input
        style={field} aria-label="Task title" placeholder="What needs doing?" value={title} maxLength={140} autoFocus
        onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save() }}
      />
      <label style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>
        Due date (optional)
        <input type="date" style={{ ...field, marginTop: 6 }} aria-label="Due date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      {error && <div role="alert" style={{ fontSize: 13, color: '#f87171' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={close} disabled={saving} style={pill('transparent', true)}>Cancel</button>
        <button type="button" onClick={save} disabled={saving} style={{ ...pill('#667eea'), opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save task'}</button>
      </div>
    </div>
  )
}
