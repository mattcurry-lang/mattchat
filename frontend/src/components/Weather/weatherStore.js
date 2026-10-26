// What Curry remembers about weather on this device: your home location (once you've shared it),
// the places you saved, your unit, and whether you've been asked. Nothing leaves the browser.
const KEY = 'mattchat:weather:v1'
const EMPTY = { home: null, places: [], unit: null, asked: false }

export function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { home: s.home || null, places: Array.isArray(s.places) ? s.places : [], unit: s.unit || null, asked: !!s.asked }
  } catch { return { ...EMPTY } }
}
export function saveStore(patch) {
  const next = { ...loadStore(), ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage full or blocked: carry on */ }
  return next
}
export const placeKey = (p) => `${Number(p.lat).toFixed(2)},${Number(p.lon).toFixed(2)}`

export function addPlace(p) {
  const { places } = loadStore()
  if (places.some((x) => placeKey(x) === placeKey(p))) return places
  const next = [...places, { name: p.name, region: p.region || '', country: p.country || '', countryCode: p.countryCode || '', lat: p.lat, lon: p.lon }].slice(-8)
  saveStore({ places: next })
  return next
}
export function removePlace(key) {
  const next = loadStore().places.filter((x) => placeKey(x) !== key)
  saveStore({ places: next })
  return next
}

// 'granted' | 'prompt' | 'denied' | 'unknown' (older Safari has no Permissions API for geolocation)
export async function getGeoPermission() {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.permissions.query) return 'unknown'
    const r = await navigator.permissions.query({ name: 'geolocation' })
    return r.state
  } catch { return 'unknown' }
}

// Resolves { lat, lon }. Rejects with { code: 'denied' | 'unavailable' | 'timeout' | 'unsupported', message }.
export function getPosition({ timeout = 10000, maximumAge = 10 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return reject({ code: 'unsupported', message: 'This browser can’t share a location.' })
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err && err.code === 1 ? { code: 'denied', message: 'Location access is blocked.' }
        : err && err.code === 3 ? { code: 'timeout', message: 'Finding you took too long.' }
        : { code: 'unavailable', message: 'Couldn’t work out where you are.' }),
      { enableHighAccuracy: false, timeout, maximumAge },
    )
  })
}
