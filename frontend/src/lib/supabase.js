import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helpers
export const signUp = async (email, password, username) => {
  const cleanUsername = username.trim()

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

export const connectGmail = async (session) => {
  const res = await fetch(`${supabaseUrl}/functions/v1/gmail-oauth?action=start`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  if (!data.ok || !data.url) throw new Error(data.error || 'Could not start the Gmail connection')
  window.location.href = data.url
}

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

const unhideConversationForUser = async (userId, conversationId) => {
  await supabase
    .from('hidden_conversations')
    .delete()
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
}

export const hideConversationForUser = async (userId, conversationId) => {
  const { error } = await supabase
    .from('hidden_conversations')
    .upsert({ user_id: userId, conversation_id: conversationId, hidden_at: new Date().toISOString() })
  if (error) throw error
}

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
