// src/lib/ecosystem/cards.js
// Ecosystem cards: structured messages that appear in a chat as a card
// instead of plain text. Stored like your music/poll messages:
//   messages.message_type = 'eco_card', messages.content = JSON string.
//
// Card v1 shape: { v: 1, kind: 'task', source: 'tasks', title, dueDate|null, automated }

import { supabase } from '../supabase'

const KINDS = new Set(['task'])
const MAX_TITLE = 140

// Allow-list every field. Anything arriving from a flow or another user is
// treated as untrusted text: trimmed, length-limited, never executed.
export function sanitizeCard(card) {
  if (!card || !KINDS.has(card.kind)) throw new Error('Unsupported card type')
  const title = String(card.title ?? '').trim().slice(0, MAX_TITLE)
  if (!title) throw new Error('A card needs a title')
  const d = String(card.dueDate ?? '').trim().slice(0, 10)          // accepts 'YYYY-MM-DD' or a full ISO timestamp
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : null
  return { v: 1, kind: card.kind, source: 'tasks', title, dueDate, automated: card.automated !== false }
}

// For rendering a received message. Returns null if it isn't a valid card.
export function parseEcoCard(content) {
  try {
    const raw = JSON.parse(content)
    if (raw?.v !== 1) return null
    return sanitizeCard(raw)
  } catch {
    return null
  }
}

// A prefilled Google Calendar "add event" link. Works for anyone, no API access
// needed. Due dates become all-day events.
export function googleCalendarUrl(card) {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: card.title, details: 'Shared via Mattchat' })
  if (card.dueDate) {
    const [y, m, d] = card.dueDate.split('-').map(Number)
    const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
    p.set('dates', `${card.dueDate.replace(/-/g, '')}/${next.replace(/-/g, '')}`)
  }
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

// Post a card into a conversation as `senderId`.
export async function sendEcoCard(conversationId, senderId, card) {
  const clean = sanitizeCard(card)
  const { data, error } = await supabase.from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content: JSON.stringify(clean), message_type: 'eco_card' })
    .select().single()
  if (error) throw error
  // The chat list shows last_message, so give it readable text, never JSON.
  await supabase.from('conversations')
    .update({ updated_at: new Date().toISOString(), last_message: `📌 ${clean.title}` })
    .eq('id', conversationId)
  return data
}
