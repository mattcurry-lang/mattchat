import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helpers
export const signUp = async (email, password, username) => {
  const cleanUsername = username.trim()

  // Pre-check availability so people get an immediate, honest answer
  // instead of Supabase Auth's generic "Database error saving new
  // user" message. This runs BEFORE auth.signUp() creates anything,
  // and .ilike() with no wildcards is an exact case-insensitive match
  // — the same rule enforced by the profiles_username_lower_key index.
  const { data: existing, error: checkError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', cleanUsername)
    .maybeSingle()

  if (checkError) throw checkError
  if (existing) throw new Error('That username is already taken. Please choose another.')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username: cleanUsername, display_name: cleanUsername } }
  })

  if (error) {
    // Race-condition fallback: two people submitted the same username
    // at nearly the same instant, both passed the check above, and
    // the handle_new_user trigger hit the unique index. Supabase Auth
    // wraps that as a generic message — translate it into something
    // a user can actually understand.
    if (error.message?.toLowerCase().includes('database error saving new user')) {
      throw new Error('That username or email is already taken. Please try a different one.')
    }
    throw error
  }

  return data
}
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
export const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Sends the "forgot password" reset email. Google/Supabase will send
// the user a link that lands back on this app at /reset-password with
// a recovery token in the URL — that page should call updatePassword()
// below once the user types their new password.
export const resetPasswordForEmail = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

// Call this from the /reset-password page once the user submits a new
// password. Supabase's client picks up the recovery token from the
// URL automatically (via detectSessionInUrl), so this just needs the
// new password itself — no token handling required here.
export const updatePassword = async (newPassword) => {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
  return data
}

// Starts the "Connect Gmail" flow — asks the gmail-oauth edge function
// for Google's consent URL, then navigates the whole page there (this
// has to be a real top-level redirect, not a fetch, since Google's
// consent screen can't be shown inside an XHR response). Google will
// eventually redirect back to this app at "/?email_connect=success"
// (or denied/expired/error) once the user finishes or cancels.
export const connectGmail = async (session) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/gmail-oauth?action=start`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  if (!data.ok || !data.url) throw new Error(data.error || 'Could not start the Gmail connection')
  window.location.href = data.url
}

// Lists the current user's connected email accounts — id and address
// only, never tokens (the edge function enforces that, not this call).
export const listEmailAccounts = async (session) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/gmail-oauth?action=list`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  return data.accounts || []
}

export const disconnectEmailAccount = async (session, accountId) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/gmail-oauth?action=disconnect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Could not disconnect that account')
}
// ── Google Drive (mirrors the Gmail connect pattern above) ───────────
export const connectGoogleDrive = async (session) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/google-drive-oauth?action=start`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  if (!data.ok || !data.url) throw new Error(data.error || 'Could not start the Google Drive connection')
  window.location.href = data.url
}

export const listGoogleDriveAccounts = async (session) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/google-drive-oauth?action=list`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  return data.accounts || []
}

export const disconnectGoogleDriveAccount = async (session, accountId) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/google-drive-oauth?action=disconnect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Could not disconnect that Drive account')
}

// ── Google Calendar (mirrors the Gmail connect pattern above) ────────
export const connectGoogleCalendar = async (session) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/google-calendar-oauth?action=start`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  if (!data.ok || !data.url) throw new Error(data.error || 'Could not start the Google Calendar connection')
  window.location.href = data.url
}

export const listGoogleCalendarAccounts = async (session) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/google-calendar-oauth?action=list`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  return data.accounts || []
}

export const disconnectGoogleCalendarAccount = async (session, accountId) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/google-calendar-oauth?action=disconnect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Could not disconnect that Calendar account')
}
// Message helpers
export const getConversations = async (userId) => {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      conversation_members!inner(user_id),
      messages(content, created_at, sender_id)
    `)
    .eq('conversation_members.user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export const getMessages = async (conversationId) => {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      id,
      conversation_id,
      sender_id,
      content,
      is_email,
      message_type,
      audio_url,
      audio_duration,
      transcript,
      transcript_status,
      is_pinned,
      reply_to_message_id,
      forwarded,
      deleted_for_everyone,
      created_at,
      profiles!messages_sender_id_fkey(username, avatar_url)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('getMessages error:', error)
    return []
  }
  return data || []
}

export const sendMessage = async (conversationId, senderId, content, isEmail = false) => {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content, is_email: isEmail })
    .select()
    .single()
  if (error) throw error
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString(), last_message: content })
    .eq('id', conversationId)
  return data
}

// Un-hides a conversation for a single user, if it was previously
// hidden by them. Safe to call even if no hidden row exists — used
// any time we're about to hand a conversation back to someone (e.g.
// getOrCreateConversation finding an existing thread), so a chat you
// deleted comes back automatically the moment either side texts again.
const unhideConversationForUser = async (userId, conversationId) => {
  await supabase
    .from('hidden_conversations')
    .delete()
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
}

// Hides a conversation for the given user only. This is what "delete
// conversation" in the UI should call now instead of actually deleting
// rows — the conversation, its messages, and anything tied to it
// (Curry AI consent, pinned messages, etc.) all stay exactly as they
// are for the other member and in the database. It just stops showing
// up in this user's own conversation list.
export const hideConversationForUser = async (userId, conversationId) => {
  const { error } = await supabase
    .from('hidden_conversations')
    .upsert({ user_id: userId, conversation_id: conversationId, hidden_at: new Date().toISOString() })
  if (error) throw error
}

// Accepts EITHER a username or an email as `identifier`. Tries email
// first when the input looks like one (contains "@"), then always
// falls back to a case-insensitive username match — safe now that
// usernames are enforced unique regardless of case
// (profiles_username_lower_key), so this can never resolve to the
// wrong person.
export const getOrCreateConversation = async (currentUserId, identifier) => {
  const clean = (identifier || '').trim()
  if (!clean) throw new Error('Enter a username or email')

  let otherUser = null

  if (clean.includes('@')) {
    const { data } = await supabase.from('profiles').select('id').eq('email', clean).maybeSingle()
    otherUser = data
  }

  if (!otherUser) {
    const { data } = await supabase.from('profiles').select('id').ilike('username', clean).maybeSingle()
    otherUser = data
  }

  if (!otherUser) throw new Error("Couldn't find anyone with that username or email")
  if (otherUser.id === currentUserId) throw new Error("That's you! Try a different username or email")

  const { data: myConvos } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', currentUserId)
  const { data: theirConvos } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', otherUser.id)

  const myIds = (myConvos || []).map(r => r.conversation_id)
  const theirIds = (theirConvos || []).map(r => r.conversation_id)
  const shared = myIds.find(id => theirIds.includes(id))

  if (shared) {
    // A conversation with this person already exists. Whether or not
    // you'd hidden/deleted it on your side, texting them again should
    // just reopen that same thread — never create a second one.
    await unhideConversationForUser(currentUserId, shared)
    return shared
  }

  const newId = crypto.randomUUID()
  const { error: convoError } = await supabase
    .from('conversations')
    .insert({ id: newId, is_group: false, updated_at: new Date().toISOString() })
  if (convoError) throw convoError
  const { error: memberError } = await supabase
    .from('conversation_members')
    .insert([
      { conversation_id: newId, user_id: currentUserId },
      { conversation_id: newId, user_id: otherUser.id }
    ])
  if (memberError) throw memberError
  return newId
}

export async function uploadStatusMedia(file, userId) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('status-media').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}

export async function getStatusMediaUrl(path) {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from('status-media')
    .createSignedUrl(path, 60 * 60 * 24) // 24h, matches how long a status lives anyway
  if (error) {
    console.error('createSignedUrl failed:', error)
    return null
  }
  return data.signedUrl
}

export async function createStatus({ userId, type, caption, mediaPath, background }) {
  const { error } = await supabase.from('statuses').insert({
    user_id: userId, type, caption: caption || null, media_path: mediaPath || null, background: background || null,
  })
  if (error) throw new Error(error.message)
}

export async function markStatusViewed(statusId, viewerId) {
  await supabase.from('status_views').upsert(
    { status_id: statusId, viewer_id: viewerId },
    { onConflict: 'status_id,viewer_id' }
  )
}

export async function getStatusViewers(statusId) {
  const { data } = await supabase
    .from('status_views')
    .select('viewer_id, viewed_at, profiles!status_views_viewer_id_fkey(username)')
    .eq('status_id', statusId)
    .order('viewed_at', { ascending: false })
  return data || []
}

export async function deleteStatus(statusId) {
  const { error } = await supabase.from('statuses').delete().eq('id', statusId)
  if (error) throw new Error(error.message)
}

// Toggles a reaction: if this user already reacted with this emoji,
// removes it (un-like). Otherwise upserts it — so switching from one
// emoji to another just overwrites, no duplicate rows possible thanks
// to the unique(status_id, user_id) constraint.
export async function toggleStatusReaction(statusId, userId, emoji = '❤️') {
  const { data: existing } = await supabase
    .from('status_reactions')
    .select('id, emoji')
    .eq('status_id', statusId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing && existing.emoji === emoji) {
    await supabase.from('status_reactions').delete().eq('id', existing.id)
    return { liked: false }
  }

  const { error } = await supabase
    .from('status_reactions')
    .upsert({ status_id: statusId, user_id: userId, emoji }, { onConflict: 'status_id,user_id' })
  if (error) throw new Error(error.message)
  return { liked: true }
}

export async function getStatusReactions(statusId) {
  const { data } = await supabase
    .from('status_reactions')
    .select('user_id, emoji, created_at, profiles!status_reactions_user_id_fkey(username)')
    .eq('status_id', statusId)
    .order('created_at', { ascending: false })
  return data || []
}

// Same "find or create a 1:1 conversation" logic as getOrCreateConversation,
// but takes the other person's user id directly instead of a
// username/email string — used by replyToStatus below, since we
// already know the status owner's id and shouldn't force an extra
// username lookup just to get back to the same id.
export async function getOrCreateConversationByUserId(currentUserId, otherUserId) {
  if (otherUserId === currentUserId) throw new Error("That's you!")

  const { data: myConvos } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', currentUserId)
  const { data: theirConvos } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', otherUserId)

  const myIds = (myConvos || []).map(r => r.conversation_id)
  const theirIds = (theirConvos || []).map(r => r.conversation_id)
  const shared = myIds.find(id => theirIds.includes(id))

  if (shared) {
    await unhideConversationForUser(currentUserId, shared)
    return shared
  }

  const newId = crypto.randomUUID()
  const { error: convoError } = await supabase
    .from('conversations')
    .insert({ id: newId, is_group: false, updated_at: new Date().toISOString() })
  if (convoError) throw convoError
  const { error: memberError } = await supabase
    .from('conversation_members')
    .insert([
      { conversation_id: newId, user_id: currentUserId },
      { conversation_id: newId, user_id: otherUserId }
    ])
  if (memberError) throw memberError
  return newId
}

// Sends a status reply as a normal DM, tagged with a "status_reply:"
// prefix (same convention as sticker:/gif:/call_log: elsewhere in the
// app) so the chat can render it with a small status-icon tag instead
// of baking a sentence like "Replied to your status" into the literal
// text — that read wrong from the sender's own point of view.
export async function replyToStatus(currentUserId, statusOwnerId, statusCaption, replyText) {
  const convoId = await getOrCreateConversationByUserId(currentUserId, statusOwnerId)
  const encodedCaption = encodeURIComponent((statusCaption || '').slice(0, 80))
  await sendMessage(convoId, currentUserId, `status_reply:${encodedCaption}::${replyText}`)
  return convoId
}

// 12-hour window for "delete for everyone" — matches WhatsApp's
// concept but with a longer allowance, per your call.
const DELETE_FOR_EVERYONE_WINDOW_MS = 12 * 60 * 60 * 1000

export function canDeleteForEveryone(message, currentUserId) {
  if (message.sender_id !== currentUserId) return false
  if (message.deleted_for_everyone) return false
  return Date.now() - new Date(message.created_at).getTime() <= DELETE_FOR_EVERYONE_WINDOW_MS
}

// Soft-deletes for everyone: clears the content and sets a flag, so
// the bubble can render "This message was deleted" instead of
// disappearing outright. Only the sender can do this, and only
// within the window above — enforced here AND worth mirroring in an
// RLS policy/trigger later if you want server-side enforcement too.
export async function deleteMessageForEveryone(messageId, currentUserId) {
  const { data: msg, error: fetchErr } = await supabase
    .from('messages').select('sender_id, created_at, deleted_for_everyone').eq('id', messageId).single()
  if (fetchErr) throw new Error(fetchErr.message)
  if (!canDeleteForEveryone(msg, currentUserId)) {
    throw new Error("This message can no longer be deleted for everyone (12-hour window passed, or it isn't yours).")
  }
  const { error } = await supabase
    .from('messages')
    .update({ content: '', deleted_for_everyone: true, deleted_at: new Date().toISOString() })
    .eq('id', messageId)
  if (error) throw new Error(error.message)
}

// Hides a message for the current viewer only — everyone else still
// sees it exactly as before.
export async function deleteMessageForMe(messageId, userId) {
  const { error } = await supabase
    .from('hidden_messages')
    .upsert({ message_id: messageId, user_id: userId })
  if (error) throw new Error(error.message)
}

// Ids this user has hidden for themself, for a given conversation's
// message set — used to filter the rendered list client-side.
export async function getHiddenMessageIds(userId, messageIds) {
  if (!messageIds.length) return new Set()
  const { data } = await supabase
    .from('hidden_messages')
    .select('message_id')
    .eq('user_id', userId)
    .in('message_id', messageIds)
  return new Set((data || []).map(r => r.message_id))
}

// Forwards a message's content into another conversation, as a fresh
// message tagged forwarded:true (so the bubble can show a "Forwarded"
// label like WhatsApp does, without a reply-quote attached).
export async function forwardMessageToConversation(conversationId, senderId, content) {
  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content, forwarded: true })
  if (error) throw new Error(error.message)
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString(), last_message: content })
    .eq('id', conversationId)
}

// Sends a message's content as a real email, reusing the same
// gmail-oauth-connected account flow — routes through Curry's chat
// endpoint, which already knows how to parse a "send an email"
// instruction into a real Gmail send action.
export async function forwardMessageToEmail(session, toAddress, content) {
  const prompt = `Send an email to ${toAddress} with subject "Forwarded message from Mattchat" and body: ${content}`
  const { callCurryAI } = await import('../components/CurryAI')
  const data = await callCurryAI('chat', { message: prompt }, session)
  if (!data.ok) throw new Error('Could not send the email — make sure Gmail is connected in your profile menu.')
  return data
}

// Sends a reply that's linked to an original message via
// reply_to_message_id, so the bubble can render a quoted preview
// above the reply text, like WhatsApp's swipe-to-reply.
export async function sendReplyMessage(conversationId, senderId, content, replyToMessageId) {
  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content, reply_to_message_id: replyToMessageId })
  if (error) throw new Error(error.message)
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString(), last_message: content })
    .eq('id', conversationId)
}


// ── Spotify (mirrors the Gmail connect pattern above) ───────────
export const connectSpotify = async (session) => {
const res = await fetch(`${supabaseUrl}/functions/v1/spotify-oauth?action=start`, {
 headers: { Authorization: `Bearer ${session.access_token}` },
})
const data = await res.json()
if (!data.ok || !data.url) throw new Error(data.error || 'Could not start the Spotify connection')
 window.location.href = data.url
}
export const disconnectSpotify = async (session) => {
 const res = await fetch(`${supabaseUrl}/functions/v1/spotify-oauth?action=disconnect`, {
method: 'POST',
headers: { Authorization: `Bearer ${session.access_token}` },
 })
 const data = await res.json()
 if (!data.ok) throw new Error(data.error || 'Could not disconnect Spotify')

}

// Returns { connected, accessToken, product, displayName } — the

// access token is always fresh (the edge function refreshes it

// server-side if needed), so callers never have to think about

// expiry themselves.

export const getSpotifyToken = async (session) => {
 const res = await fetch(`${supabaseUrl}/functions/v1/spotify-token`, {
headers: { Authorization: `Bearer ${session.access_token}` },
 })
 return res.json()
}

export async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, cacheControl: '3600' })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: data.publicUrl, avatar_source: 'upload', profile_setup_completed: true })
    .eq('id', userId)
  if (updateError) throw updateError

  return data.publicUrl
}

export async function skipProfileSetup(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({ profile_setup_completed: true, avatar_source: 'skipped' })
    .eq('id', userId)
  if (error) throw error
}

export async function setUsagePreference(userId, preference) {
  const { error } = await supabase
    .from('profiles')
    .update({ usage_preference: preference })
    .eq('id', userId)
  if (error) throw error
}

// ── Pinterest ────────────────────────────────────────────
export const connectPinterest = async (session) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/pinterest-oauth?action=start`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  if (!data.ok || !data.url) throw new Error(data.error || 'Could not start the Pinterest connection')
  window.location.href = data.url
}

export const disconnectPinterest = async (session) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/pinterest-oauth?action=disconnect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Could not disconnect Pinterest')
}

export const listPinterestBoards = async (session) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/pinterest-oauth?action=list_boards`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  return res.json() // { ok, connected, boards }
}

export const listPinterestPins = async (session, boardId) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/pinterest-oauth?action=list_pins&board_id=${boardId}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  return res.json() // { ok, pins }
}

// Sets the profile avatar directly to a Pinterest-hosted image URL —
// no re-upload needed, Pinterest's CDN URLs are public and stable.
export async function setAvatarFromUrl(userId, imageUrl) {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: imageUrl, avatar_source: 'pinterest', profile_setup_completed: true })
    .eq('id', userId)
  if (error) throw error
}

export async function updateProfileDetails(userId, { bio, organization, currentlyStudying, interests }) {
  const { error } = await supabase
    .from('profiles')
    .update({
      bio: bio ?? null,
      organization: organization ?? null,
      currently_studying: currentlyStudying ?? null,
      interests: interests ?? [],
    })
    .eq('id', userId)
  if (error) throw error
}

export async function setAvatarCategory(userId, category) {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_category: category })
    .eq('id', userId)
  if (error) throw error
}

// Computes "usually replies within X" from real message history between
// the two people — average gap between one person's message and the
// other's next reply, over the last N exchanges. Real behavior, not a
// guess, so it stays honest as the two people actually talk more.
export function computeReplyTimeLabel(messages, otherUserId, currentUserId) {
  if (!messages || messages.length < 4) return null

  const gaps = []
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1]
    const curr = messages[i]
    if (prev.sender_id === currentUserId && curr.sender_id === otherUserId) {
      const gapMs = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()
      if (gapMs > 0 && gapMs < 24 * 60 * 60 * 1000) gaps.push(gapMs) // ignore >24h gaps (not a "reply")
    }
  }

  if (gaps.length < 3) return null // not enough signal to be meaningful

  const avgMs = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const mins = Math.round(avgMs / 60000)

  if (mins < 1) return 'Usually replies instantly'
  if (mins < 60) return `Usually replies within ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `Usually replies within ${hours} hr`
  return null // don't show if it's consistently slow — not flattering, not useful
}
