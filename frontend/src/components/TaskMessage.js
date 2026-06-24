import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function TaskMessage({ message, currentUserId }) {
  const [list, setList] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTask, setNewTask] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (!message.task_list_id) return
    loadList()

    // realtime: update tasks live when anyone checks/adds
    const channel = supabase
      .channel(`tasks:${message.task_list_id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tasks',
        filter: `task_list_id=eq.${message.task_list_id}`
      }, () => loadTasks())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [message.task_list_id])

  const loadList = async () => {
    const { data } = await supabase
      .from('task_lists').select('*').eq('id', message.task_list_id).single()
    setList(data)
    await loadTasks()
    setLoading(false)
  }

  const loadTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*, created_by_profile:profiles!tasks_created_by_fkey(username), assigned_profile:profiles!tasks_assigned_to_fkey(username)')
      .eq('task_list_id', message.task_list_id)
      .order('position')
    setTasks(data || [])
  }

  const toggleTask = async (task) => {
    const completed = !task.completed
    await supabase.from('tasks').update({
      completed,
      completed_by: completed ? currentUserId : null,
      completed_at: completed ? new Date().toISOString() : null,
    }).eq('id', task.id)
    await loadTasks()
  }

  const addTask = async () => {
    if (!newTask.trim()) return
    setAdding(true)
    await supabase.from('tasks').insert({
      task_list_id: message.task_list_id,
      created_by: currentUserId,
      text: newTask.trim(),
      position: tasks.length,
    })
    setNewTask('')
    setAdding(false)
    setShowAdd(false)
    await loadTasks()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTask() }
    if (e.key === 'Escape') { setShowAdd(false); setNewTask('') }
  }

  if (loading) return <div style={s.loading}>Loading tasks…</div>
  if (!list) return null

  const done = tasks.filter(t => t.completed).length
  const total = tasks.length

  return (
    <div style={s.wrap}>
      {/* header */}
      <div style={s.header}>
        <span style={s.listTitle}>{list.title}</span>
        <span style={s.progress}>{done}/{total}</span>
      </div>

      {/* progress bar */}
      {total > 0 && (
        <div style={s.track}>
          <div style={{ ...s.fill, width: `${(done / total) * 100}%` }} />
        </div>
      )}

      {/* tasks */}
      <div style={s.taskList}>
        {tasks.map(task => (
          <div key={task.id} style={s.taskRow} onClick={() => toggleTask(task)}>
            <div style={{ ...s.check, ...(task.completed ? s.checkDone : {}) }}>
              {task.completed && '✓'}
            </div>
            <span style={{ ...s.taskText, ...(task.completed ? s.taskDone : {}) }}>
              {task.text}
            </span>
          </div>
        ))}
      </div>

      {/* add task inline */}
      {showAdd ? (
        <div style={s.addRow}>
          <input
            style={s.addInput}
            placeholder="New task…"
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            disabled={adding}
          />
          <button style={s.addConfirm} onClick={addTask} disabled={adding || !newTask.trim()}>
            {adding ? '…' : '↵'}
          </button>
        </div>
      ) : (
        <button style={s.addBtn} onClick={() => setShowAdd(true)}>+ Add task</button>
      )}

      {total > 0 && done === total && (
        <div style={s.allDone}>🎉 All done!</div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    background: '#1e1b4b', borderRadius: 16, padding: '14px 16px',
    maxWidth: 300, minWidth: 220,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  listTitle: { fontSize: 15, fontWeight: 600, color: '#fff' },
  progress: { fontSize: 12, color: '#888', background: 'rgba(255,255,255,0.07)', padding: '2px 8px', borderRadius: 99 },
  track: { height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 12, overflow: 'hidden' },
  fill: { height: '100%', background: '#7C6FF7', borderRadius: 2, transition: 'width 0.3s ease' },
  taskList: { display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 },
  taskRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 4px', cursor: 'pointer', borderRadius: 8,
    transition: 'background 0.1s',
  },
  check: {
    width: 18, height: 18, borderRadius: 5,
    border: '1.5px solid rgba(255,255,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, color: '#fff', flexShrink: 0, transition: 'all 0.15s',
  },
  checkDone: { background: '#7C6FF7', borderColor: '#7C6FF7' },
  taskText: { fontSize: 13, color: '#ddd', lineHeight: 1.4, transition: 'all 0.15s' },
  taskDone: { color: '#555', textDecoration: 'line-through' },
  addRow: { display: 'flex', gap: 6, marginTop: 4 },
  addInput: {
    flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(124,111,247,0.4)',
    borderRadius: 8, padding: '7px 10px', color: '#fff', fontSize: 13, outline: 'none',
  },
  addConfirm: {
    background: '#7C6FF7', border: 'none', borderRadius: 8,
    color: '#fff', padding: '7px 12px', cursor: 'pointer', fontSize: 14,
  },
  addBtn: {
    background: 'none', border: 'none', color: '#7C6FF7',
    fontSize: 12, cursor: 'pointer', padding: '4px 0',
    textAlign: 'left',
  },
  allDone: { fontSize: 12, color: '#7C6FF7', marginTop: 6, textAlign: 'center' },
  loading: { color: '#666', fontSize: 13, padding: 12 },
}
