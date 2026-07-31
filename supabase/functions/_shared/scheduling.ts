// supabase/functions/_shared/scheduling.ts
//
// Turns a classified, actionable item into concrete scheduling
// artifacts: a reminder time, and — for effort-heavy items with a
// due date — a spread of study session blocks in `study_sessions`.
// Deliberately conservative: no calendar writes here (that's a
// separate, opt-in step once calendar_accounts is confirmed), no
// invented travel-time estimates (would need a maps API we don't have
// — flagged as a gap, not guessed at).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Reminder lead time by priority — deadline-proximate for urgent,
// generous for low. Categories that are point-in-time (meeting,
// event) get a same-day nudge regardless of priority since "1 day
// before a meeting" is nearly useless.
const REMINDER_LEAD_MINUTES: Record<string, number> = {
  urgent: 60,
  high: 24 * 60,
  medium: 2 * 24 * 60,
  low: 3 * 24 * 60,
}
const POINT_IN_TIME_CATEGORIES = new Set(['meeting', 'event', 'job_interview'])
const POINT_IN_TIME_LEAD_MINUTES = 30

// Below this, a single sitting is enough — not worth splitting into
// blocks. Above it, break into 2-3 sessions spaced out before the
// due date so the whole thing isn't crammed the night before.
const STUDY_BLOCK_THRESHOLD_MINUTES = 90

function computeReminderAt(dueDate: string | null, dueTime: string | null, category: string, priority: string): string | null {
  if (!dueDate) return null
  const due = new Date(`${dueDate}T${dueTime || '09:00'}:00`)
  if (isNaN(due.getTime())) return null

  const leadMinutes = POINT_IN_TIME_CATEGORIES.has(category)
    ? POINT_IN_TIME_LEAD_MINUTES
    : (REMINDER_LEAD_MINUTES[priority] || REMINDER_LEAD_MINUTES.medium)

  const reminderAt = new Date(due.getTime() - leadMinutes * 60_000)
  // Never schedule a reminder in the past (e.g. due date is tomorrow
  // but priority implies a 3-day lead) — clamp to 10 min from now
  // instead so it still fires, just immediately.
  const now = Date.now()
  return (reminderAt.getTime() < now ? new Date(now + 10 * 60_000) : reminderAt).toISOString()
}

// Splits total effort into 2-3 sessions between now and the due date.
// Simple even spacing — no calendar-conflict awareness yet (would
// need to read the user's existing tasks/study_sessions to avoid
// double-booking a slot, worth a follow-up pass).
async function createStudyBlocks(userId: string, taskId: string, dueDate: string, dueTime: string | null, effortMinutes: number) {
  const due = new Date(`${dueDate}T${dueTime || '17:00'}:00`)
  const now = new Date()
  const daysUntilDue = Math.max(1, Math.floor((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))

  const sessionCount = effortMinutes > 240 ? 3 : 2
  if (daysUntilDue < sessionCount) return // not enough runway to spread it out — leave as one block, user does it in one sitting

  const perSessionMinutes = Math.ceil(effortMinutes / sessionCount)
  const spacingDays = Math.floor(daysUntilDue / (sessionCount + 1))

  const rows = []
  for (let i = 1; i <= sessionCount; i++) {
    const start = new Date(now.getTime() + spacingDays * i * 24 * 60 * 60 * 1000)
    start.setHours(18, 0, 0, 0) // default to evening slot — no real free/busy data to work from yet
    const end = new Date(start.getTime() + perSessionMinutes * 60_000)
    rows.push({ user_id: userId, task_id: taskId, start_time: start.toISOString(), end_time: end.toISOString() })
  }

  const { error } = await supabase.from('study_sessions').insert(rows)
  if (error) console.error('scheduling: study_sessions insert failed:', error)
}

// Main entry point — call this right after a task row is created.
// Takes the already-inserted task's id plus the same extracted/
// classification data used to create it, so it doesn't need to
// re-derive anything.
export async function scheduleTask(params: {
  userId: string
  taskId: string
  category: string
  priority: string
  dueDate: string | null
  dueTime: string | null
  estimatedEffortMinutes: number | null
}) {
  const { userId, taskId, category, priority, dueDate, dueTime, estimatedEffortMinutes } = params

  const reminderAt = computeReminderAt(dueDate, dueTime, category, priority)
  if (reminderAt) {
    const { error } = await supabase.from('ai_tasks').update({ reminder_at: reminderAt }).eq('id', taskId)
    if (error) console.error('scheduling: reminder_at update failed:', error)
  }

  const isStudyCategory = category === 'assignment' || category === 'exam'
  if (isStudyCategory && dueDate && estimatedEffortMinutes && estimatedEffortMinutes >= STUDY_BLOCK_THRESHOLD_MINUTES) {
    await createStudyBlocks(userId, taskId, dueDate, dueTime, estimatedEffortMinutes)
  }

  // Travel time for events/meetings with a physical location: skipped
  // deliberately. Doing this properly needs a geocoding/directions API
  // (Google Maps Distance Matrix or similar) which isn't wired up
  // anywhere in this codebase yet — a flat guess like "add 30 min"
  // would be worse than nothing. Worth its own small integration if
  // you want it: one new edge function, one new env var for a Maps
  // API key.
}
