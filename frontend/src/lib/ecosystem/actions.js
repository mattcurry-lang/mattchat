// src/lib/ecosystem/actions.js
// What each declared action actually does. Every runner reuses an existing
// Mattchat function, so permissions and behaviour stay exactly the same as
// when the user does it by hand.
//
//   runner(params, ctx) -> any    ctx = { userId, session }
//   Throw, or return { ok: false, error }, to record the run as failed.

import { confirmTask, completeTask, pushTaskToCalendar, sendMessage } from '../supabase'
import { sendEcoCard } from './cards'

const runners = {
  'task.confirm': ({ taskId }) => confirmTask(taskId),
  'task.complete': ({ taskId }) => completeTask(taskId),
  'calendar.push_task': ({ taskId }, ctx) => pushTaskToCalendar(ctx.session, taskId),
  'message.send': ({ conversationId, text }, ctx) => sendMessage(conversationId, ctx.userId, text),
  'card.send_task': ({ conversationId, title, dueDate }, ctx) =>
    sendEcoCard(conversationId, ctx.userId, { kind: 'task', title, dueDate }),
}

export function getActionRunner(actionId) {
  return runners[actionId]
}
