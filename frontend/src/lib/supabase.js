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

// Reset password
export const resetPasswordForEmail = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export const updatePassword = async (newPassword) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
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
      profiles!messages_sender_id_fkey(usernam
