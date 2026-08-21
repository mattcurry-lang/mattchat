// lib/cycleTrust.js
import { supabase as sb } from './supabase'

export async function listTrustedPeople(ownerId) {
  const { data, error } = await sb
    .from('trusted_people')
    .select('*, profiles:trusted_user_id(username, avatar_url)')
    .eq('owner_id', ownerId)
    .neq('status', 'revoked')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createTrustedInvite(ownerId, inviteEmail) {
  const existing = await listTrustedPeople(ownerId)
  if (existing.length >= 2) throw new Error('You can only have up to two trusted people')

  const { data, error } = await sb
    .from('trusted_people')
    .insert({ owner_id: ownerId, invite_email: inviteEmail || null, status: 'pending', permission_level: 1 })
    .select()
    .single()
  if (error) throw error
  return { ...data, inviteUrl: `${window.location.origin}/trusted-invite/${data.invite_token}` }
}

export async function acceptTrustedInvite(inviteToken) {
  const { data, error } = await sb.rpc('accept_trusted_invite', { p_invite_token: inviteToken })
  if (error) throw error
  if (!data.ok) throw new Error(data.error)
  return data
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
    .select('*, owner:owner_id(username, avatar_url)')
    .eq('status', 'accepted')
  if (error) throw error
  return data || []
}

export async function getSharedCycleStatus(ownerId) {
  const { data, error } = await sb.rpc('get_shared_cycle_status', { p_owner_id: ownerId })
  if (error) throw error
  return data
}
