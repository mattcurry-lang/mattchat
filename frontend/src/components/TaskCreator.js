import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './ChatCards.css'

const MAX_TASKS = 10

const CloseIcon = () => (
  <svg className="cc-ico" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
)

const PlusIcon = () => (
  <svg className="cc-ico" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 3v10M3 8h10" />
  </svg>
)

export default function TaskCreator({ conversationId, senderId, onSent, onCancel }) {
  const uid = useRef(0)
  const mk = (text = '') => ({ id: ++uid.current, text })

  const [title, setTitle] = useState('')
  const [tasks, setTasks] = useState(() => [mk(), mk()])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  // focus management: set an id, the effect focuses that row once it exists
  const inputRefs = useRef({})
  const [focusId, setFocusId] = useState(null)
  useEffect(() => {
    if (focusId == null) return
    inputRefs.current[focusId]?.focus()
    setFocusId(null)
  }, [focusId])

  const updateTask = (id, text) =>
    setTasks(ts => ts.map(t => (t.id === id ? { ...t, text } : t)))

  const addTask = () => {
    if (tasks.length >= MAX_TASKS) return
    const t = mk()
    setTasks([...tasks, t])
    setFocusId(t.id)
  }

  const removeTask = (id) => {
    if (tasks.length <= 1) return
    setTasks(tasks.filter(t => t.id !== id))
  }

  const handleKeyDown = (e, i) => {
    const task = tasks[i]
    if (e.key === 'Enter') {
      e.preventDefault()
      if (i < tasks.length - 1) setFocusId(tasks[i + 1].id)
      else if (task.text.trim()) addTask()
    } else if (e.key === 'Backspace' && !task.text && tasks.length > 1) {
      e.preventDefault()
      setFocusId(tasks[i > 0 ? i - 1 : 1].id)
      removeTask(task.id)
    }
  }

  // pasting a multi-line list (even with "- " or "1." bullets) becomes one task per line
  const handlePaste = (e, i) => {
    const raw = e.clipboardData.getData('text')
    if (!/\r?\n/.test(raw.trim())) return
    const lines = raw
      .split(/\r?\n/)
      .map(l => l.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s*/, '').trim().slice(0, 200))
      .filter(Boolean)
    if (!lines.length) return
    e.preventDefault()

    const replaceCurrent = !tasks[i].text.trim()
    const start = replaceCurrent ? i : i + 1
    const next = [...tasks]
    next.splice(start, replaceCurrent ? 1 : 0, ...lines.map(mk))
    const capped = next.slice(0, MAX_TASKS)
    setTasks(capped)
    setFocusId(capped[Math.min(start + lines.length - 1, capped.length - 1)].id)
  }

  const canSend = title.trim() && tasks.some(t => t.text.trim())

  const send = async () => {
    if (!canSend || sending) return
    setSending(true)
    setError(null)
    try {
      const validTasks = tasks.map(t => t.text.trim()).filter(Boolean)

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
      setError("Couldn't create the list. Try again.")
      setSending(false)
    }
  }

  return (
    <div
      className="cc cc-sheet"
      role="dialog"
      aria-label="New task list"
      onKeyDown={e => { if (e.key === 'Escape') onCancel && onCancel() }}
    >
      <div className="cc-head">
        <span className="cc-head-title">New task list</span>
        <button type="button" className="cc-close" onClick={onCancel} aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      {error && <p className="cc-error" role="alert">{error}</p>}

      <input
        className="cc-main"
        placeholder="Name your list"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            inputRefs.current[tasks[0].id]?.focus()
          }
        }}
        maxLength={100}
        autoFocus
      />

      <div className="cc-rows">
        {tasks.map((task, i) => (
          <div key={task.id} className="cc-row">
            <span className="cc-dot" />
            <input
              ref={el => { inputRefs.current[task.id] = el }}
              className="cc-input"
              placeholder={i === 0 ? 'What needs doing?' : 'Next task'}
              value={task.text}
              onChange={e => updateTask(task.id, e.target.value)}
              onKeyDown={e => handleKeyDown(e, i)}
              onPaste={e => handlePaste(e, i)}
              maxLength={200}
            />
            {tasks.length > 1 && (
              <button
                type="button"
                className="cc-rm"
                onClick={() => removeTask(task.id)}
                aria-label="Remove task"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        ))}
      </div>

      {tasks.length < MAX_TASKS && (
        <button type="button" className="cc-add" onClick={addTask}>
          <PlusIcon /> Add task
        </button>
      )}

      <div className="cc-foot">
        <button type="button" className="cc-btn cc-btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="cc-btn cc-btn-primary"
          onClick={send}
          disabled={!canSend || sending}
        >
          {sending ? 'Creating…' : 'Create list'}
        </button>
      </div>
    </div>
  )
}
