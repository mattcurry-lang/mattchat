import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'
import './ChatCards.css'

const RING = 2 * Math.PI * 15

const Check = () => (
  <svg className="cc-tick" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8.5l3.2 3.2L13 4.5" />
  </svg>
)

const Plus = () => (
  <svg className="cc-ico" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 3v10M3 8h10" />
  </svg>
)

export default function TaskMessage({ message, currentUserId }) {
  const [list, setList] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const addInputRef = useRef(null)
  const addBusy = useRef(false)

  useEffect(() => {
    if (!message.task_list_id) return
    loadList()

    // realtime: update tasks live when anyone checks/adds
    const unsubscribe = subscribeToChannel(
      `task-list:${message.task_list_id}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'tasks',
        filter: `task_list_id=eq.${message.task_list_id}`,
      }, (payload) => emit('change', payload)),
      { onEvent: loadTasks, onResync: loadList }
    )
    return unsubscribe
  }, [message.task_list_id])

  const loadList = async () => {
    setError(false)
    try {
      const { data, error: listErr } = await supabase
        .from('task_lists').select('*').eq('id', message.task_list_id).single()
      if (listErr) throw listErr
      setList(data)
      await loadTasks()
    } catch (err) {
      console.error('loadList failed:', err)
      setError(true)
    }
    setLoading(false)
  }

  const loadTasks = async () => {
    const { data, error: tasksErr } = await supabase
      .from('tasks')
      .select('*, created_by_profile:profiles!tasks_created_by_fkey(username), assigned_profile:profiles!tasks_assigned_to_fkey(username)')
      .eq('task_list_id', message.task_list_id)
      .order('position')
    if (tasksErr) { console.error('loadTasks failed:', tasksErr); return }
    setTasks(data || [])
  }

  // optimistic: the check lands instantly, then we sync with the server
  const toggleTask = async (task) => {
    const completed = !task.completed
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, completed } : t)))
    const { error: updErr } = await supabase.from('tasks').update({
      completed,
      completed_by: completed ? currentUserId : null,
      completed_at: completed ? new Date().toISOString() : null,
    }).eq('id', task.id)
    if (updErr) console.error('toggleTask failed:', updErr)
    await loadTasks() // also reverts the optimistic change if the update failed
  }

  // the add row stays open so people can add several tasks in a row
  const addTask = async () => {
    const text = newTask.trim()
    if (!text || addBusy.current) return
    addBusy.current = true
    setAdding(true)
    const { error: insErr } = await supabase.from('tasks').insert({
      task_list_id: message.task_list_id,
      created_by: currentUserId,
      text,
      position: tasks.length,
    })
    if (insErr) console.error('addTask failed:', insErr)
    else setNewTask('')
    addBusy.current = false
    setAdding(false)
    await loadTasks()
    addInputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTask() }
    if (e.key === 'Escape') { setShowAdd(false); setNewTask('') }
  }

  if (loading) {
    return (
      <div className="cc cc-card" aria-busy="true">
        <div className="cc-skel" style={{ width: '55%', marginBottom: 14 }} />
        <div className="cc-skel" style={{ width: '90%', marginBottom: 10 }} />
        <div className="cc-skel" style={{ width: '70%' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="cc cc-card">
        <div className="cc-errtext">Couldn't load this task list.</div>
        <button type="button" className="cc-retry" onClick={() => { setLoading(true); loadList() }}>
          Try again
        </button>
      </div>
    )
  }

  if (!list) return null

  const done = tasks.filter(t => t.completed).length
  const total = tasks.length
  const allDone = total > 0 && done === total
  const subtitle = total === 0 ? 'No tasks yet' : allDone ? 'All done' : `${done} of ${total} done`

  return (
    <div className="cc cc-card">
      <div className="tl-head">
        <div className="tl-head-text">
          <div className="tl-title">{list.title}</div>
          <div className={`tl-sub${allDone ? ' is-done' : ''}`}>{subtitle}</div>
        </div>
        <svg className="tl-ring" viewBox="0 0 36 36" aria-hidden="true">
          <circle className="tl-ring-bg" cx="18" cy="18" r="15" fill="none" strokeWidth="3.5" />
          <circle
            className="tl-ring-fg"
            cx="18" cy="18" r="15" fill="none" strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - (total ? done / total : 0))}
            transform="rotate(-90 18 18)"
            style={{ opacity: done ? 1 : 0 }}
          />
          {allDone && <path className="tl-ring-check" d="M12 18.5l4 4 8-9" />}
        </svg>
      </div>

      <div className="tl-list">
        {tasks.map(task => (
          <button
            key={task.id}
            type="button"
            role="checkbox"
            aria-checked={!!task.completed}
            className="tl-line tl-row"
            onClick={() => toggleTask(task)}
          >
            <span className={`tl-box${task.completed ? ' is-done' : ''}`}><Check /></span>
            <span className={`tl-text${task.completed ? ' is-done' : ''}`}>{task.text}</span>
            {task.assigned_profile?.username && (
              <span className="tl-who">@{task.assigned_profile.username}</span>
            )}
          </button>
        ))}

        {showAdd ? (
          <div className="tl-line tl-addrow">
            <span className="tl-plus"><Plus /></span>
            <input
              ref={addInputRef}
              className="tl-addinput"
              placeholder="New task"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => { if (!newTask.trim() && !addBusy.current) setShowAdd(false) }}
              maxLength={200}
              autoFocus
            />
            {newTask.trim() && (
              <button type="button" className="tl-addgo" onClick={addTask} disabled={adding}>
                {adding ? '…' : 'Add'}
              </button>
            )}
          </div>
        ) : (
          <button type="button" className="tl-line tl-add" onClick={() => setShowAdd(true)}>
            <span className="tl-plus"><Plus /></span>
            Add task
          </button>
        )}
      </div>
    </div>
  )
}
