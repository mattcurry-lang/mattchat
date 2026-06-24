import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function TaskCreator({ conversationId, senderId, onSent, onCancel }) {
  const [title, setTitle] = useState('')
  const [tasks, setTasks] = useState(['', ''])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const updateTask = (i, val) => {
    const next = [...tasks]
    next[i] = val
    setTasks(next)
  }

  const addTask = () => {
    if (tasks.length < 10) setTasks([...tasks, ''])
  }

  const removeTask = (i) => {
    if (tasks.length <= 1) return
    setTasks(tasks.filter((_, idx) => idx !== i))
  }

  const handleKeyDown = (e, i) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (i === tasks.length - 1) addTask()
    }
  }

  const canSend = title.trim() && tasks.filter(t => t.trim()).length >= 1

  const send = async () => {
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      const validTasks = tasks.map(t => t.trim()).filter(Boolean)

      // 1. create task list
      const { data: list, error: listErr } = await supabase
        .from('task_lists')
        .insert({ conversation_id: conversationId, creator_id: senderId, title: title.trim() })
        .select().single()
      if (listErr) throw listErr

      // 2. insert tasks
      const { error: taskErr } = await supabase
        .from('tasks')
        .insert(validTasks.map((text, i) => ({ task_list_id: list.id, created_by: senderId, text, position: i })))
      if (taskErr) throw taskErr

      // 3. insert message
      const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: `✅ ${title.trim()}`,
          message_type: 'task',
          task_list_id: list.id,
        })
        .select().single()
      if (msgErr) throw msgErr

      // 4. update conversation preview
      await supabase.from('conversations')
        .update({ updated_at: new Date().toISOString(), last_message: `✅ ${title.trim()}` })
        .eq('id', conversationId)

      onSent && onSent(msg)
    } catch (err) {
      console.error(err)
      setError('Failed to create task list. Try again.')
      setSending(false)
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.title}>✅ New Task List</span>
        <button style={s.closeBtn} onClick={onCancel}>✕</button>
      </div>

      {error && <p style={s.error}>{error}</p>}

      <input
        style={s.titleInput}
        placeholder="List title e.g. 'Project tasks', 'Shopping'"
        value={title}
        onChange={e => setTitle(e.target.value)}
        maxLength={100}
        autoFocus
      />

      <div style={s.label}>Tasks</div>
      {tasks.map((task, i) => (
        <div key={i} style={s.taskRow}>
          <span style={s.checkbox}>○</span>
          <input
            style={s.taskInput}
            placeholder={`Task ${i + 1}`}
            value={task}
            onChange={e => updateTask(i, e.target.value)}
            onKeyDown={e => handleKeyDown(e, i)}
            maxLength={200}
          />
          {tasks.length > 1 && (
            <button style={s.removeBtn} onClick={() => removeTask(i)}>✕</button>
          )}
        </div>
      ))}

      {tasks.length < 10 && (
        <button style={s.addBtn} onClick={addTask}>+ Add task</button>
      )}

      <div style={s.footer}>
        <button style={s.cancelBtn} onClick={onCancel}>Cancel</button>
        <button
          style={{ ...s.sendBtn, opacity: canSend ? 1 : 0.4 }}
          onClick={send}
          disabled={!canSend || sending}
        >
          {sending ? 'Creating…' : 'Create List'}
        </button>
      </div>
    </div>
  )
}

const s = {
  wrap: {
    position: 'absolute', bottom: '100%', left: 0, right: 0,
    background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16, padding: 16, marginBottom: 8,
    boxShadow: '0 -4px 24px rgba(0,0,0,0.4)', zIndex: 100,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 15, fontWeight: 600, color: '#fff' },
  closeBtn: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  titleInput: {
    width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 14,
    outline: 'none', marginBottom: 12, boxSizing: 'border-box',
  },
  label: { fontSize: 12, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' },
  taskRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  checkbox: { color: '#555', fontSize: 16, flexShrink: 0 },
  taskInput: {
    flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none',
  },
  removeBtn: { background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13, flexShrink: 0 },
  addBtn: {
    background: 'none', border: '1px dashed rgba(124,111,247,0.4)',
    borderRadius: 8, color: '#7C6FF7', padding: '6px 12px',
    fontSize: 13, cursor: 'pointer', width: '100%', marginBottom: 12,
  },
  footer: { display: 'flex', gap: 8, marginTop: 4 },
  cancelBtn: {
    flex: 1, background: 'rgba(255,255,255,0.06)', border: 'none',
    borderRadius: 10, padding: 10, color: '#aaa', fontSize: 14, cursor: 'pointer',
  },
  sendBtn: {
    flex: 2, background: '#7C6FF7', border: 'none',
    borderRadius: 10, padding: 10, color: '#fff', fontSize: 14,
    fontWeight: 600, cursor: 'pointer',
  },
  error: { color: '#ef4444', fontSize: 12, marginBottom: 8 },
}
