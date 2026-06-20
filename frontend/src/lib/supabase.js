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
    .select(`*, profiles(username, avatar_url)`)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
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

  const { data: existing } = await supabase
    .from('conversations')
    .select('id, conversation_members!inner(user_id)')
    .eq('is_group', false)
    .eq('conversation_members.user_id', currentUserId)

  const directConvo = existing?.find(c =>
    c.conversation_members.some(m => m.user_id === otherUser.id)
  )
  if (directConvo) return directConvo.id

  // Generate the ID ourselves so we never need to SELECT the row back.
  // (RLS on `conversations` only allows SELECT for existing members, but
  // at the moment of insert no membership row exists yet — chaining
  // .select().single() onto the insert would fail RLS for that reason.)
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
