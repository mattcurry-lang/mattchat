// src/lib/ecosystem/suggestions.js
// "Suggested for you": plain rules over how you actually use Mattchat.
// This is NOT an AI model and it reads no email or message text. It only uses:
//   * counts of your recent confirmed/completed tasks (status, due date, whether
//     they reached your calendar)
//   * how many task cards other people shared with you, per chat
//   * how your own flows have been running
// Everything is computed on your device from rows you already own.

import { supabase } from '../supabase'

const DAY = 24 * 60 * 60 * 1000
export const WINDOW_DAYS = 30
export const MIN_DATED_TASKS = 3     // tasks with a deadline that aren't on the calendar
export const MIN_CARDS = 2           // cards shared with you in one chat
export const MIN_FAILED_RUNS = 3     // consecutive runs that didn't finish
const MAX_SUGGESTIONS = 3

// ── gather the few signals ───────────────────────────────
export async function loadSignals(userId) {
  const since = new Date(Date.now() - WINDOW_DAYS * DAY).toISOString()
  const out = { tasks: [], cardChats: {} }

  const t = await supabase.from('ai_tasks')
    .select('status, due_date, calendar_event_id, updated_at')
    .eq('user_id', userId).in('status', ['confirmed', 'completed']).gte('updated_at', since).limit(500)
  if (!t.error) out.tasks = t.data || []

  // Only the chat id of cards other people sent: never the card text.
  const m = await supabase.from('messages')
    .select('conversation_id')
    .eq('message_type', 'eco_card').neq('sender_id', userId).gte('created_at', since).limit(300)
  if (!m.error) {
    for (const row of m.data || []) out.cardChats[row.conversation_id] = (out.cardChats[row.conversation_id] || 0) + 1
  }
  return out
}

// ── turn signals into suggestions ────────────────────────
// Each suggestion: { id, templateId, title, reason, score, conversationId? }
export function buildSuggestions({ signals, flows = [], conversations = [] }) {
  const out = []
  const tasks = signals?.tasks || []

  // 1) Deadlines that never reach the calendar
  const dated = tasks.filter((t) => t.due_date)
  const missing = dated.filter((t) => !t.calendar_event_id)
  const hasCalendarFlow = flows.some((f) => f.action_type === 'calendar.push_task')   // even a switched-off one: don't nag
  if (!hasCalendarFlow && missing.length >= MIN_DATED_TASKS) {
    out.push({
      id: 'cal', templateId: 'cal', score: missing.length,
      title: 'Put your confirmed tasks on your calendar',
      reason: missing.length === dated.length
        ? `You confirmed ${dated.length} tasks with deadlines in the last ${WINDOW_DAYS} days, and none are on your calendar.`
        : `${missing.length} of your ${dated.length} recent tasks with deadlines aren’t on your calendar.`,
    })
  }

  // 2) Chats that keep sharing task cards with you
  Object.entries(signals?.cardChats || {})
    .filter(([, count]) => count >= MIN_CARDS)
    .forEach(([chatId, count]) => {
      const chat = conversations.find((c) => c.id === chatId)
      if (!chat) return
      if (flows.some((f) => f.trigger_event === 'card.received' && f.trigger_filter?.conversationId === chatId)) return
      out.push({
        id: `auto-add:${chatId}`, templateId: 'auto-add', conversationId: chatId, score: count,
        title: `Add task cards from ${chat.name} to your tasks`,
        reason: `${chat.name} shared ${count} task cards with you in the last ${WINDOW_DAYS} days.`,
      })
    })

  return out.sort((a, b) => b.score - a.score).slice(0, MAX_SUGGESTIONS)
}

// ── flows that keep failing ──────────────────────────────
// Switched-on flows whose latest MIN_FAILED_RUNS runs all failed or were skipped.
export function flowsNeedingAttention(flows = [], runs = []) {
  return flows
    .filter((f) => f.enabled)
    .map((flow) => {
      const mine = runs
        .filter((r) => r.flow_id === flow.id && r.status !== 'running')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, MIN_FAILED_RUNS)
      if (mine.length < MIN_FAILED_RUNS || mine.some((r) => r.status === 'ok')) return null
      return { flow, lastRun: mine[0], count: mine.length }
    })
    .filter(Boolean)
}

// ── "Not now" memory (this device only) ──────────────────
const dismissKey = (userId) => `eco.dismissed.${userId}`

export function loadDismissed(userId) {
  try {
    const v = JSON.parse(window.localStorage.getItem(dismissKey(userId)))
    return new Set(Array.isArray(v) ? v : [])
  } catch {
    return new Set()
  }
}

export function dismissSuggestion(userId, id) {
  const set = loadDismissed(userId)
  set.add(id)
  try { window.localStorage.setItem(dismissKey(userId), JSON.stringify([...set].slice(-50))) } catch { /* storage unavailable */ }
  return set
}
