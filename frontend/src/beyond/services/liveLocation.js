// src/beyond/services/liveLocation.js
//
// Live location, WRITE side. Extends the existing one-off location flow
// (LocationShareModal) with a duration; it does not replace it.
//
//   - ONE navigator.geolocation watch for the whole app (the publisher below),
//     running only while at least one share is active AND the app is visible.
//   - Writes are throttled: at most one per 10 s, and when standing still only
//     one per 60 s.
//   - The database refuses writes when no share is active (see 002 SQL), so even
//     a bug here cannot keep publishing after sharing ended.
//
// Honest limit of a web app: when Mattchat is closed or in the background, the
// phone stops reporting. Viewers then see "Last known location" with its age,
// never "live".

import { supabase } from '../../lib/supabase'

const MIN_GAP_MS = 10 * 1000
const MAX_GAP_MS = 60 * 1000
const MIN_MOVE_M = 15

export async function fetchMyActiveShares(userId) {
  const { data, error } = await supabase
    .from('live_location_shares')
    .select('conversation_id, expires_at')
    .eq('owner_id', userId)
    .is('stopped_at', null)
    .gt('expires_at', new Date().toISOString())
  if (error) throw error
  return data || []
}

export async function startLiveShare(conversationId, minutes) {
  const { error } = await supabase.rpc('start_live_share', { p_conversation: conversationId, p_minutes: minutes })
  if (error) throw error
}

export async function stopLiveShare(conversationId) {
  const { error } = await supabase.rpc('stop_live_share', { p_conversation: conversationId })
  if (error) throw error
}

// Ask for permission and a first fix BEFORE any share exists. If the person
// says no, nothing is created. Rejects with { code: 'denied'|'unsupported'|'failed' }.
export function getPositionOnce() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return reject({ code: 'unsupported' })
    navigator.geolocation.getCurrentPosition(
      resolve,
      (e) => reject({ code: e.code === 1 ? 'denied' : 'failed' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    )
  })
}

function distanceM(a, b) {
  const R = 6371000
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.latitude - a.lat)
  const dLng = rad(b.longitude - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function createLocationPublisher({ userId, onError }) {
  let wanted = false
  let watchId = null
  let last = null // { lat, lng, t }

  const onPos = (pos) => {
    const c = pos.coords
    const now = Date.now()
    if (last) {
      const gap = now - last.t
      if (gap < MIN_GAP_MS) return
      if (gap < MAX_GAP_MS && distanceM(last, c) < MIN_MOVE_M) return
    }
    last = { lat: c.latitude, lng: c.longitude, t: now }
    supabase
      .from('live_locations')
      .upsert(
        {
          user_id: userId,
          lat: c.latitude,
          lng: c.longitude,
          accuracy: num(c.accuracy),
          speed: num(c.speed) !== null && c.speed >= 0 ? c.speed : null,
          heading: num(c.heading) !== null && c.heading >= 0 && c.heading <= 360 ? c.heading : null,
          // recorded_at is set by the database
        },
        { onConflict: 'user_id' },
      )
      .then(({ error }) => { if (error) console.error('[beyond] location write failed:', error) })
  }

  const onErr = (e) => { if (e.code === 1) onError?.('denied') } // timeouts / no-signal: keep watching

  const startWatch = () => {
    if (watchId !== null || !navigator.geolocation) return
    watchId = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 })
  }
  const stopWatch = () => {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null }
  }
  const onVis = () => {
    if (!wanted) return
    if (document.visibilityState === 'visible') startWatch(); else stopWatch()
  }

  return {
    start() {
      if (wanted) return
      wanted = true
      document.addEventListener('visibilitychange', onVis)
      if (document.visibilityState === 'visible') startWatch()
    },
    stop() {
      wanted = false
      stopWatch()
      document.removeEventListener('visibilitychange', onVis)
      last = null
    },
  }
}
