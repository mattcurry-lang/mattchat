import { supabase as sb } from './supabase'

export async function listTrustedPeople(ownerId) {
  const { data, error } = await sb
    .from('trusted_people')
    .select('*, profiles!trusted_user_id(username, avatar_url)')
    .eq('owner_id', ownerId)
    .neq('status', 'revoked')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createTrustedInvite(ownerId, trustedUserId) {
  if (ownerId === trustedUserId) throw new Error("You can't add yourself as a trusted person")

  const existing = await listTrustedPeople(ownerId)
  if (existing.length >= 2) throw new Error('You can only have up to two trusted people')
  if (existing.some(p => p.trusted_user_id === trustedUserId)) {
    throw new Error('Already invited or connected with this person')
  }

  const { data, error } = await sb
    .from('trusted_people')
    .insert({ owner_id: ownerId, trusted_user_id: trustedUserId, status: 'pending', permission_level: 1 })
    .select('*, profiles!trusted_user_id(username, avatar_url)')
    .single()
  if (error) throw error
  return data
}
export async function countPendingTrustedInvites(userId) {
  const { count, error } = await sb
    .from('trusted_people')
    .select('id', { count: 'exact', head: true })
    .eq('trusted_user_id', userId)
    .eq('status', 'pending')
  if (error) throw error
  return count || 0
}
export async function listPendingTrustedInvites() {
  const { data: userData, error: userErr } = await sb.auth.getUser()
  if (userErr) throw userErr
  const { data, error } = await sb
    .from('trusted_people')
    .select('*, owner:profiles!owner_id(username, avatar_url)')
    .eq('trusted_user_id', userData.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function respondToTrustedInvite(linkId, accept) {
  const { data, error } = await sb.rpc('respond_to_trusted_invite', { p_link_id: linkId, p_accept: accept })
  if (error) throw error
  if (!data.ok) throw new Error(data.error)
  return data
}

 
export async function acceptTrustedInvite(linkId) {
  return respondToTrustedInvite(linkId, true)
}

export async function declineTrustedInvite(linkId) {
  return respondToTrustedInvite(linkId, false)
}

export async function updateTrustedPermission(id, patch) {
  const { error } = await sb.from('trusted_people').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function revokeTrustedPerson(id) {
  const { error } = await sb.from('trusted_people').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function listPeopleITrust() {
  const { data, error } = await sb
    .from('trusted_people')
    .select('*, owner:profiles!owner_id(username, avatar_url)')
    .eq('status', 'accepted')
  if (error) throw error
  return data || []
}

export async function getSharedCycleStatus(ownerId) {
  const { data, error } = await sb.rpc('get_shared_cycle_status', { p_owner_id: ownerId })
  if (error) throw error
  return data
}

export async function searchProfilesByUsername(query, excludeUserId) {
  if (!query || query.trim().length < 2) return []
  const { data, error } = await sb
    .from('profiles')
    .select('id, username, avatar_url')
    .ilike('username', `%${query.trim()}%`)
    .neq('id', excludeUserId)
    .limit(15)
  if (error) throw error
  return data || []
}
