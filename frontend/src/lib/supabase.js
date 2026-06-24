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
      profiles(username, avatar_url)
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
  if (shared) return shared

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
