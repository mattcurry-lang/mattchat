// src/beyond/services/batteryStatus.js
//
// Battery sharing for BEYOND. Three separate jobs, kept apart on purpose:
//
//   1. classifyBattery()      pure rules: what may be shown, and is it current?
//   2. setBatterySharing()    the consent switch, per conversation. Never touches
//                             location sharing.
//   3. startBatteryReporter() writes MY level, only while at least one share is on,
//                             only while the app is visible, and only where the
//                             browser supports it.
//
// Browser reality: navigator.getBattery() exists in Chromium browsers (Chrome,
// Edge, Samsung Internet on Android). It does NOT exist in iOS Safari or Firefox.
// A web app also cannot report while it is closed or in the background. So the
// reader side must always show age, and "unsupported" is a normal state, not an error.

import { formatAge } from './locationFreshness'

export const BATTERY_LIVE_MS = 2 * 60 * 1000       // reported within this = current
export const BATTERY_RECENT_MS = 15 * 60 * 1000    // within this = recent; beyond = last reported
const HEARTBEAT_MS = 90 * 1000                      // re-report an unchanged level this often (visible only)
const MIN_WRITE_GAP_MS = 20 * 1000                  // never write faster than this

export const BatteryState = Object.freeze({
  LOADING: 'loading',
  NOT_SHARING: 'not_sharing',
  NO_READING: 'no_reading',      // they share, but nothing has been reported yet (unsupported device, or app closed)
  LIVE: 'live',
  RECENT: 'recent',
  LAST_REPORTED: 'last_reported',
})

const ms = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null }

/**
 * share: null | { share_battery: boolean }   (row from device_status_shares for the OTHER person)
 * row:   null | { battery_level, charging, reported_at }
 */
export function classifyBattery({ share, row, now = Date.now(), loading = false }) {
  const off = (state, label) => ({
    state, show: false, isCurrent: false, level: null, charging: null, ageMs: null,
    label, chargingLabel: '', updatedLabel: '', availabilityLabel: '',
  })
  if (loading) return off(BatteryState.LOADING, 'Checking battery')
  if (!share || !share.share_battery) return off(BatteryState.NOT_SHARING, 'Battery not shared')

  const t = row ? ms(row.reported_at) : null
  const lvl = row && Number.isFinite(row.battery_level) ? Math.round(row.battery_level) : null
  if (t === null || lvl === null || lvl < 0 || lvl > 100) {
    return off(BatteryState.NO_READING, 'No battery reading yet')
  }

  const age = Math.max(0, now - t)
  const state = age <= BATTERY_LIVE_MS ? BatteryState.LIVE : age <= BATTERY_RECENT_MS ? BatteryState.RECENT : BatteryState.LAST_REPORTED
  return {
    state,
    show: true,
    isCurrent: state === BatteryState.LIVE,            // only LIVE may be drawn as "now"
    level: lvl,
    charging: !!row.charging,
    ageMs: age,
    label: state === BatteryState.LAST_REPORTED ? 'Last reported battery' : 'Battery',
    chargingLabel: row.charging ? 'Charging' : 'Not charging',
    updatedLabel: `Updated ${formatAge(age)}`,
    availabilityLabel: state === BatteryState.LIVE ? 'Device reporting' : `Last heard from ${formatAge(age)}`,
  }
}

export function supportsBatteryReporting() {
  return typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function'
}

/**
 * The consent switch. `on === false` also removes my stored reading once no
 * conversation is sharing any more, so nothing lingers.
 */
export async function setBatterySharing(supabase, userId, conversationId, on) {
  const { error } = await supabase.from('device_status_shares').upsert(
    { owner_id: userId, conversation_id: conversationId, share_battery: !!on, updated_at: new Date().toISOString() },
    { onConflict: 'owner_id,conversation_id' },
  )
  if (error) throw error
  if (!on) {
    const { count, error: cErr } = await supabase
      .from('device_status_shares')
      .select('conversation_id', { count: 'exact', head: true })
      .eq('owner_id', userId).eq('share_battery', true)
    if (!cErr && count === 0) await supabase.from('device_status').delete().eq('user_id', userId)
  }
}

/**
 * Starts reporting my battery. Returns a stop() function.
 * The caller starts this ONLY while at least one share is on, and stops it when
 * the last one is switched off. Returns null where the browser cannot do it.
 */
export function startBatteryReporter(supabase, userId) {
  if (!supportsBatteryReporting()) return null
  let stopped = false
  let battery = null
  let lastWrite = 0
  let timer = null

  const write = async () => {
    if (stopped || !battery || document.visibilityState !== 'visible') return
    const nowMs = Date.now()
    if (nowMs - lastWrite < MIN_WRITE_GAP_MS) return
    lastWrite = nowMs
    const { error } = await supabase.from('device_status').upsert({
      user_id: userId,
      battery_level: Math.round(battery.level * 100),
      charging: !!battery.charging,
      reported_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) console.error('[beyond] battery report failed:', error)
  }

  const onVisible = () => { if (document.visibilityState === 'visible') write() }

  navigator.getBattery().then((b) => {
    if (stopped) return
    battery = b
    b.addEventListener('levelchange', write)
    b.addEventListener('chargingchange', write)
    document.addEventListener('visibilitychange', onVisible)
    timer = setInterval(write, HEARTBEAT_MS)
    write()
  }).catch(() => { /* permission policy or unsupported: stay silent, reader shows "no reading" */ })

  return () => {
    stopped = true
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
    if (battery) {
      battery.removeEventListener('levelchange', write)
      battery.removeEventListener('chargingchange', write)
    }
  }
}
