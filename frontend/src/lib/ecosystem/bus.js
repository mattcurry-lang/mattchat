// src/lib/ecosystem/bus.js
// Publish / subscribe on the eco_events table, plus the consent calls.
// Every function swallows its own errors (logged, never thrown) so an
// ecosystem hiccup can never break chat.

import { supabase } from '../supabase'
import { subscribeToChannel } from '../realtimeManager'
import { getEcosystemApp, getEventDefinition } from './registry'

// ── Publish ──────────────────────────────────────────────
// Returns the new event id, or null if it was a duplicate / was rejected.
export async function publishEvent({ appId, type, payload = {}, conversationId = null, dedupeKey = null }) {
  const def = getEventDefinition(type)
  if (!def || def.app.id !== appId) {
    console.warn(`[ecosystem] "${appId}" is not registered to emit "${type}"`)
    return null
  }
  try {
    const { data, error } = await supabase.rpc('eco_publish_event', {
      p_app_id: appId,
      p_type: type,
      p_payload: payload,
      p_conversation_id: conversationId,
      p_dedupe_key: dedupeKey,
    })
    if (error) throw error
    return data || null
  } catch (e) {
    console.error('[ecosystem] publish failed:', e?.message || e)
    return null
  }
}

// ── Subscribe ────────────────────────────────────────────
// handler(row) is called for each new event for this user.
// Pass { types: ['task.confirmed'] } to only hear some of them.
// Returns an unsubscribe function. Uses the shared realtime manager, so
// any number of listeners share one channel and get reconnects for free.
export function subscribeToEvents(userId, handler, { types } = {}) {
  if (!userId) return () => {}
  const wanted = types?.length ? new Set(types) : null
  return subscribeToChannel(
    `eco-events:${userId}`,
    (channel, emit) =>
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'eco_events', filter: `user_id=eq.${userId}` },
        (p) => emit('event', p.new)
      ),
    {
      onEvent: (_kind, row) => {
        if (wanted && !wanted.has(row?.type)) return
        handler(row)
      },
    }
  )
}

export async function listRecentEvents(userId, { limit = 30, types } = {}) {
  try {
    let q = supabase.from('eco_events').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(limit)
    if (types?.length) q = q.in('type', types)
    const { data, error } = await q
    if (error) throw error
    return data || []
  } catch (e) {
    console.error('[ecosystem] listRecentEvents failed:', e?.message || e)
    return []
  }
}

// ── Consent ──────────────────────────────────────────────
// Mattchat itself is always allowed; everything else needs an active row.
export async function getConnections(userId) {
  try {
    const { data, error } = await supabase.from('eco_app_connections')
      .select('app_id, scopes, status, updated_at').eq('user_id', userId)
    if (error) throw error
    return data || []
  } catch (e) {
    console.error('[ecosystem] getConnections failed:', e?.message || e)
    return []
  }
}

export async function connectApp(userId, appId) {
  const app = getEcosystemApp(appId)
  if (!app) { console.warn(`[ecosystem] unknown app "${appId}"`); return false }
  try {
    const { error } = await supabase.from('eco_app_connections').upsert(
      { user_id: userId, app_id: appId, scopes: app.scopes, status: 'active', updated_at: new Date().toISOString() },
      { onConflict: 'user_id,app_id' }
    )
    if (error) throw error
    return true
  } catch (e) {
    console.error('[ecosystem] connectApp failed:', e?.message || e)
    return false
  }
}

export async function disconnectApp(userId, appId) {
  try {
    const { error } = await supabase.from('eco_app_connections')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('app_id', appId)
    if (error) throw error
    return true
  } catch (e) {
    console.error('[ecosystem] disconnectApp failed:', e?.message || e)
    return false
  }
}
