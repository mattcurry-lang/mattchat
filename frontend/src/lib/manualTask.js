// src/lib/manualTask.js
// Create a task by hand (no email needed). Goes through the same ai_tasks
// table as scanned tasks, so Confirm/Complete, the calendar push and
// Ecosystem flows all work on it exactly the same way.

import { supabase } from './supabase'

export async function createManualTask(userId, { title, dueDate } = {}) {
  const cleanTitle = String(title ?? '').trim().slice(0, 140)
  if (!cleanTitle) throw new Error('Please enter a task title.')

  const d = String(dueDate ?? '').trim().slice(0, 10)
  const due_date = /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : null

  // You wrote it yourself, so it starts as 'confirmed' (active), like tasks
  // the email scanner already confirms. Your own flows will see
  // task.created and task.confirmed for it.
  const { data, error } = await supabase.from('ai_tasks')
    .insert({ user_id: userId, title: cleanTitle, due_date, status: 'confirmed', source: 'manual' })
    .select().single()
  if (error) throw error
  return data
}
