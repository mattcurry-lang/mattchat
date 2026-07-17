// src/lib/instagram.js
//
// Client-side helpers for Connected Apps → Instagram. Mirrors the
// connectGmail / connectPinterest pattern already in lib/supabase.js:
// each "connect" function calls an edge function to get an auth URL,
// then redirects the whole page there (Instagram's OAuth screen isn't
// embeddable in an iframe/popup reliably, so a full redirect — same as
// Gmail/Pinterest — is the safe default).
//
// Add these alongside the existing connectGmail/connectPinterest
// exports in lib/supabase.js, or import them directly from this file —
// either works since they just need the shared `supabase` client.

import { supabase } from './supabase'

export async function connectInstagram(session) {
  const { data, error } = await supabase.functions.invoke('instagram-oauth-start', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) throw error
  if (!data?.url) throw new Error('Could not start Instagram connection')
  window.location.href = data.url
}

export async function disconnectInstagram(session) {
  const { data, error } = await supabase.functions.invoke('instagram-disconnect', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) throw error
  return data
}

async function callInstagramApi(session, action, params = {}) {
  const { data, error } = await supabase.functions.invoke('instagram-api', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action, params },
  })
  if (error) throw error
  return data
}

export function getInstagramProfile(session) {
  return callInstagramApi(session, 'profile')
}

export function getInstagramMedia(session, { limit, after } = {}) {
  return callInstagramApi(session, 'media', { limit, after })
}

export function searchInstagramProfile(session, username) {
  return callInstagramApi(session, 'search_profile', { username })
}

// Reads the sanitized view (no tokens) directly — cheaper than an edge
// function round trip for the simple "is this connected" check used by
// ConnectedAppsSection on every profile page load.
export async function getConnectedAccountsStatus(userId) {
  const { data, error } = await supabase
    .from('connected_accounts_public')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data || []
}
