// Open-Meteo (forecast, air quality, place search) + BigDataCloud (name for your GPS spot).
//
// LICENSING: Open-Meteo's free API is for NON-COMMERCIAL use only (< 10,000 calls/day) and requires a visible
// "Weather data by Open-Meteo.com" credit. If Mattchat is commercial, subscribe to a plan and set
// REACT_APP_OPEN_METEO_KEY — calls then go to the customer hosts below. (Keys in a browser bundle are visible
// to anyone; for a real paid key, proxy these calls through a Supabase edge function instead.)
import { placeKey } from './weatherStore'

const KEY = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_OPEN_METEO_KEY) || ''
const HOSTS = KEY
  ? { forecast: 'https://customer-api.open-meteo.com', air: 'https://customer-air-quality-api.open-meteo.com', geo: 'https://customer-geocoding-api.open-meteo.com' }
  : { forecast: 'https://api.open-meteo.com', air: 'https://air-quality-api.open-meteo.com', geo: 'https://geocoding-api.open-meteo.com' }
const withKey = (url) => (KEY ? `${url}&apikey=${encodeURIComponent(KEY)}` : url)

const CURRENT = 'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
const HOURLY = 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,is_day,wind_speed_10m,uv_index,visibility,dew_point_2m'
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max'

async function getJson(url, { timeout = 10000 } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) {
      let reason = ''
      try { reason = (await res.json()).reason || '' } catch { /* not json */ }
      const err = new Error(reason || `Weather service returned ${res.status}`)
      err.status = res.status
      throw err
    }
    return await res.json()
  } catch (e) {
    if (e && e.name === 'AbortError') { const err = new Error('The weather service took too long to answer.'); err.timeout = true; throw err }
    throw e
  } finally { clearTimeout(timer) }
}

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Turn Open-Meteo's column-oriented JSON into row objects the UI can use. Exported for tests. */
export function normalizeForecast(raw, aqRaw, place) {
  const c = raw.current || {}
  const h = raw.hourly || {}
  const d = raw.daily || {}
  const times = h.time || []
  const curHour = `${String(c.time || '').slice(0, 13)}:00`
  let start = times.indexOf(curHour)
  if (start < 0) start = 0
  const at = (arr, i) => (arr && i < arr.length ? n(arr[i]) : null)
  const hourly = times.slice(start, start + 48).map((t, k) => {
    const i = start + k
    return {
      time: t, tempC: at(h.temperature_2m, i), feelsC: at(h.apparent_temperature, i), precipProb: at(h.precipitation_probability, i),
      precipMm: at(h.precipitation, i), code: at(h.weather_code, i), isDay: at(h.is_day, i) !== 0, windKmh: at(h.wind_speed_10m, i),
      uv: at(h.uv_index, i), visibilityM: at(h.visibility, i), dewC: at(h.dew_point_2m, i),
    }
  })
  const now = hourly[0] || {}
  const daily = (d.time || []).map((date, i) => ({
    date, code: at(d.weather_code, i), maxC: at(d.temperature_2m_max, i), minC: at(d.temperature_2m_min, i),
    sunrise: d.sunrise ? d.sunrise[i] : null, sunset: d.sunset ? d.sunset[i] : null, uvMax: at(d.uv_index_max, i),
    precipProbMax: at(d.precipitation_probability_max, i), precipSumMm: at(d.precipitation_sum, i), windMaxKmh: at(d.wind_speed_10m_max, i),
  })).filter((x) => x.maxC != null && x.minC != null)
  const ac = aqRaw && aqRaw.current
  return {
    place: place || null, lat: raw.latitude, lon: raw.longitude, timezone: raw.timezone, utcOffset: raw.utc_offset_seconds || 0, fetchedAt: Date.now(),
    current: {
      time: c.time, tempC: n(c.temperature_2m), feelsC: n(c.apparent_temperature), humidity: n(c.relative_humidity_2m), isDay: c.is_day !== 0,
      precipMm: n(c.precipitation), code: n(c.weather_code), cloud: n(c.cloud_cover), pressure: n(c.surface_pressure),
      windKmh: n(c.wind_speed_10m), windDeg: n(c.wind_direction_10m), gustKmh: n(c.wind_gusts_10m),
      uv: n(now.uv), visibilityM: n(now.visibilityM), dewC: n(now.dewC),
    },
    hourly, daily,
    aq: ac ? { usAqi: n(ac.us_aqi), euAqi: n(ac.european_aqi), pm25: n(ac.pm2_5), pm10: n(ac.pm10) } : null,
  }
}

const cache = new Map()
const TTL = 10 * 60 * 1000

// Two parts of the UI often want the same place at the same moment (the card and a place chip). They share one
// request, which keeps us well inside Open-Meteo's daily limit and avoids a flicker of two different results.
const inflight = new Map()

export function fetchWeather(place, { force = false } = {}) {
  const key = placeKey(place)
  const hit = cache.get(key)
  if (!force && hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.data)
  if (inflight.has(key)) return inflight.get(key)
  const p = load(place, key).finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

async function load(place, key) {
  const { lat, lon } = place
  const fUrl = withKey(`${HOSTS.forecast}/v1/forecast?latitude=${lat}&longitude=${lon}&current=${CURRENT}&hourly=${HOURLY}&daily=${DAILY}&timezone=auto&forecast_days=7`)
  const aUrl = withKey(`${HOSTS.air}/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,european_aqi,pm2_5,pm10&timezone=auto`)
  // air quality is a bonus: its failure must never break the card
  const [raw, aq] = await Promise.all([getJson(fUrl), getJson(aUrl, { timeout: 8000 }).catch(() => null)])
  const data = normalizeForecast(raw, aq, place)
  cache.set(key, { at: Date.now(), data })
  return data
}
export const cachedWeather = (place) => { const h = cache.get(placeKey(place)); return h ? h.data : null }
export const clearWeatherCache = () => { cache.clear(); inflight.clear() }

export async function searchPlaces(query, count = 6) {
  const q = String(query || '').trim()
  if (q.length < 2) return []
  const j = await getJson(withKey(`${HOSTS.geo}/v1/search?name=${encodeURIComponent(q)}&count=${count}&language=en&format=json`), { timeout: 8000 })
  return (j.results || []).map((r) => ({
    name: r.name, region: r.admin1 || '', country: r.country || '', countryCode: (r.country_code || '').toUpperCase(),
    lat: r.latitude, lon: r.longitude, timezone: r.timezone || '', population: r.population || 0,
  }))
}

// BigDataCloud's free client-side endpoint: only for naming the device's own location, called from the browser.
export async function reverseGeocode(lat, lon) {
  try {
    const j = await getJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`, { timeout: 6000 })
    const name = j.city || j.locality || j.principalSubdivision || j.countryName || ''
    return { name: name || 'Your location', region: j.principalSubdivision || '', country: j.countryName || '', countryCode: (j.countryCode || '').toUpperCase() }
  } catch { return { name: 'Your location', region: '', country: '', countryCode: '' } }
}

export const flag = (cc) => (cc && cc.length === 2 ? String.fromCodePoint(...cc.toUpperCase().split('').map((ch) => 127397 + ch.charCodeAt(0))) : '')
