import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helpers
export const signUp = async (email, password, username) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: username } }
  })
  if (error) throw error
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

export const getOrCreateConversation = async (currentUserId, otherUserEmail) => {
  const { data: otherUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', otherUserEmail)
    .single()
  if (!otherUser) throw new Error('User not found')

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
