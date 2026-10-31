// src/lib/messageActions.js
// Backend helpers for the message menu: edit a sent message, see who has read it, and react.
// (Saving / reminders live in messageSaves.js; delete / pin / forward are unchanged and still in supabase.js / ChatPage.)

import { supabase } from './supabase'

export const EDIT_WINDOW_MS = 15 * 60 * 1000          // same 15 minutes WhatsApp allows
export const EDIT_SETUP_HINT = 'Editing isn’t switched on yet. Ask your admin to run docs/step_message_saves.sql in Supabase.'

const isMissingColumn = (e) => !!e && e.code !== '23505' && (e.code === '42703' || e.code === 'PGRST204' || /edited_at/i.test(e.message || ''))

/** Can this person still edit this message? (own, plain text, not forwarded/deleted, inside the window) */
export function canEditMessage(message, currentUserId, now = Date.now()) {
  if (!message || !currentUserId || message.sender_id !== currentUserId) return false
  if (message.deleted_for_everyone || message.is_email || message.forwarded) return false
  if (message.message_type && message.message_type !== 'text') return false
  if (message.audio_url || message.poll_id || message.task_list_id) return false
  if (typeof message.content !== 'string' || !message.content.trim()) return false
  if (/^(?:call_log|missed_call|__)/i.test(message.content)) return false
  if (String(message.id || '').startsWith('temp')) return false          // still sending
  const sent = new Date(message.created_at).getTime()
  return Number.isFinite(sent) && now - sent <= EDIT_WINDOW_MS
}

/** Whole minutes left to edit (0 when closed). */
export function editMinutesLeft(message, now = Date.now()) {
  const sent = new Date(message?.created_at).getTime()
  if (!Number.isFinite(sent)) return 0
  return Math.max(0, Math.ceil((EDIT_WINDOW_MS - (now - sent)) / 60000))
}

export async function editMessage(messageId, currentUserId, newContent) {
  const text = (newContent || '').trim()
  if (!text) throw new Error('A message can’t be empty')

  const { data: msg, error } = await supabase
    .from('messages')
    .select('id, sender_id, content, created_at, message_type, is_email, forwarded, deleted_for_everyone, audio_url, poll_id, task_list_id')
    .eq('id', messageId)
    .maybeSingle()
  if (error || !msg) throw new Error('Couldn’t find that message')
  if (!canEditMessage(msg, currentUserId)) throw new Error('This message can no longer be edited')
  if (text === msg.content) return { ...msg }

  const editedAt = new Date().toISOString()
  const { data, error: upErr } = await supabase
    .from('messages')
    .update({ content: text, edited_at: editedAt })
    .eq('id', messageId)
    .eq('sender_id', currentUserId)
    .select('id')
  if (upErr) throw isMissingColumn(upErr) ? new Error(EDIT_SETUP_HINT) : upErr
  if (!data || data.length === 0) throw new Error('Couldn’t save the edit')
  return { ...msg, content: text, edited_at: editedAt }
}

/** Who has read a message, with names and (when the database records it) times. */
export async function getMessageReceipts(messageId) {
  let { data, error } = await supabase.from('message_reads').select('user_id, read_at').eq('message_id', messageId)
  if (error) ({ data, error } = await supabase.from('message_reads').select('user_id').eq('message_id', messageId))
  if (error || !data || data.length === 0) return []
  const ids = [...new Set(data.map((r) => r.user_id))]
  const { data: people } = await supabase.from('profiles').select('id, username').in('id', ids)
  const names = new Map((people || []).map((p) => [p.id, p.username]))
  return data.map((r) => ({ userId: r.user_id, name: names.get(r.user_id) || 'Someone', readAt: r.read_at || null }))
}

/** Which emoji has this person already put on this message? */
export async function getMyReactions(messageId, userId) {
  if (!messageId || !userId || String(messageId).startsWith('temp')) return new Set()
  const { data, error } = await supabase.from('message_reactions').select('emoji').eq('message_id', messageId).eq('user_id', userId)
  return new Set(error || !data ? [] : data.map((r) => r.emoji))
}

/** Same behaviour as tapping a reaction on the bubble: tap again to take it back. */
export async function toggleMessageReaction(messageId, userId, emoji) {
  const { data: existing, error } = await supabase
    .from('message_reactions').select('message_id').eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji).maybeSingle()
  if (error) throw error
  if (existing) {
    const { error: delErr } = await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji)
    if (delErr) throw delErr
    return 'removed'
  }
  const { error: insErr } = await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji })
  if (insErr) throw insErr
  return 'added'
}
