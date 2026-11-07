// src/beyond/services/locationFreshness.js
//
// Pure rules: given what the existing location-sharing service says about a
// contact, decide what BEYOND is allowed to show. No network, no React, no
// Supabase, so it is trivially testable and cannot start a GPS subscription.
//
// Input comes from an adapter over the EXISTING location service (not written
// yet; see the plan). Shape expected from that adapter:
//
//   share: null | {
//     active:     boolean,        // sender has sharing switched on for this viewer
//     expiresAt:  string|null,    // ISO; null = no expiry set
//     stoppedAt:  string|null,    // ISO; set when the sender pressed stop
//   }
//   fix: null | { lat, lng, accuracy?, speed?, heading?, recordedAt }  // recordedAt = ISO
//
// Decisions encoded here (change the constants, not the call sites):
//   - Stopped or expired  -> NO position is returned at all, not even "last known".
//   - Active but silent   -> position is returned only as "last known", never as live.
//   - Live means a fix newer than LIVE_MS. Everything older is labelled with its age.

export const LIVE_MS = 2 * 60 * 1000          // newer than this = live
export const RECENT_MS = 10 * 60 * 1000       // newer than this = "recently"; older = last known
export const MOVING_MPS = 1.0                 // m/s above which we call someone moving
export const MAX_TRUSTED_ACCURACY_M = 200     // coarser than this: show the circle, don't claim a spot

export const LocationState = Object.freeze({
  LOADING: 'loading',          // adapter has not answered yet
  NOT_SHARING: 'not_sharing',  // never shared with you / switched off
  STOPPED: 'stopped',          // they stopped sharing
  EXPIRED: 'expired',          // sharing window ended
  LIVE: 'live',
  RECENT: 'recent',            // sharing active, fix a few minutes old
  LAST_KNOWN: 'last_known',    // sharing active, fix is old (their device is probably offline)
  OFFLINE: 'offline',          // you are offline, so freshness cannot be confirmed
})

const toMs = (iso) => {
  const t = typeof iso === 'number' ? iso : Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

export function formatAge(ms) {
  if (ms == null || ms < 0) return ''
  const s = Math.round(ms / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s} seconds ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

function movementOf(fix) {
  const speed = fix && typeof fix.speed === 'number' && fix.speed >= 0 ? fix.speed : null
  if (speed === null) return 'unknown'              // GPS did not report it: do not guess
  if (typeof fix.accuracy === 'number' && fix.accuracy > MAX_TRUSTED_ACCURACY_M) return 'unknown'
  return speed >= MOVING_MPS ? 'moving' : 'still'
}

/**
 * @returns {{
 *   state: string,
 *   canShowPosition: boolean,   // false => the map must not draw a marker at all
 *   isLive: boolean,            // true only for LIVE; drives the pulsing marker
 *   position: null | {lat:number,lng:number},
 *   accuracyM: number|null,
 *   accuracyIsCoarse: boolean,
 *   movement: 'moving'|'still'|'unknown',
 *   ageMs: number|null,
 *   label: string,              // short status line for the info panel
 *   updatedLabel: string,       // "Updated 3 minutes ago" or ''
 * }}
 */
export function classifyLocation({ share, fix, now = Date.now(), viewerOnline = true, loading = false }) {
  const none = (state, label) => ({
    state, canShowPosition: false, isLive: false, position: null, accuracyM: null,
    accuracyIsCoarse: false, movement: 'unknown', ageMs: null, label, updatedLabel: '',
  })

  if (loading) return none(LocationState.LOADING, 'Checking location')
  if (!share) return none(LocationState.NOT_SHARING, 'Not sharing their location with you')

  if (share.stoppedAt || share.active === false) return none(LocationState.STOPPED, 'Stopped sharing their location')
  const exp = share.expiresAt ? toMs(share.expiresAt) : null
  if (exp !== null && exp <= now) return none(LocationState.EXPIRED, 'Location sharing has ended')

  const valid =
    fix && Number.isFinite(fix.lat) && Number.isFinite(fix.lng) &&
    Math.abs(fix.lat) <= 90 && Math.abs(fix.lng) <= 180 && toMs(fix.recordedAt) !== null
  if (!valid) return none(LocationState.LOADING, 'Waiting for their location')

  const age = Math.max(0, now - toMs(fix.recordedAt))
  const accuracyM = typeof fix.accuracy === 'number' ? fix.accuracy : null
  const base = {
    canShowPosition: true,
    position: { lat: fix.lat, lng: fix.lng },
    accuracyM,
    accuracyIsCoarse: accuracyM !== null && accuracyM > MAX_TRUSTED_ACCURACY_M,
    ageMs: age,
    updatedLabel: `Updated ${formatAge(age)}`,
  }

  // If WE are offline, the fix could be much older than it looks: never claim live.
  if (!viewerOnline) {
    return { ...base, state: LocationState.OFFLINE, isLive: false, movement: 'unknown', label: 'You are offline. This may be out of date' }
  }
  if (age <= LIVE_MS) {
    return { ...base, state: LocationState.LIVE, isLive: true, movement: movementOf(fix), label: 'Sharing live location' }
  }
  if (age <= RECENT_MS) {
    return { ...base, state: LocationState.RECENT, isLive: false, movement: 'unknown', label: 'Sharing location' }
  }
  return { ...base, state: LocationState.LAST_KNOWN, isLive: false, movement: 'unknown', label: 'Last known location' }
}
