import { useState, useEffect, useCallback } from 'react'
import { listTasks } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

export function useTasks(userId) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!userId) return
    try {
      setTasks(await listTasks(userId))
    } catch (e) {
      console.error('useTasks: reload failed:', e)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (!userId) return
    const unsubscribe = subscribeToChannel(
      `tasks:${userId}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'ai_tasks', filter: `user_id=eq.${userId}`,
      }, (p) => emit('change', p)),
      { onEvent: reload, onResync: reload }
    )
    return unsubscribe
  }, [userId, reload])

  const pendingConfirmation = tasks.filter(t => t.status === 'pending')
  const active = tasks.filter(t => t.status === 'confirmed' || t.status === 'in_progress')
  const completed = tasks.filter(t => t.status === 'completed')

  return { tasks, pendingConfirmation, active, completed, loading, reload }
}
