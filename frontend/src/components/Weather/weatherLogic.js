// Pure weather helpers: units, formatting, tips, intent detection. No React, no network.
import { describeCode, isWet, isSnowy, isStormy } from './weatherCodes'

// ── units ──
export const cToF = (c) => (c * 9) / 5 + 32
export const kmhToMph = (k) => k * 0.621371
export const kmToMi = (k) => k * 0.621371
export const mmToIn = (mm) => mm / 25.4
export const hPaToInHg = (h) => h * 0.02953
const num = (n) => typeof n === 'number' && Number.isFinite(n)

export function defaultUnit(locale) {
  const l = locale || (typeof navigator !== 'undefined' ? navigator.language : '') || ''
  const region = (l.split('-')[1] || '').toUpperCase()
  return ['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW'].includes(region) ? 'f' : 'c'
}
export const tempN = (c, unit) => (num(c) ? Math.round(unit === 'f' ? cToF(c) : c) : null)
export const temp = (c, unit) => (num(c) ? `${tempN(c, unit)}°` : '–')
export const speed = (kmh, unit) => (!num(kmh) ? { v: '–', u: '' } : unit === 'f' ? { v: Math.round(kmhToMph(kmh)), u: 'mph' } : { v: Math.round(kmh), u: 'km/h' })
export const distance = (km, unit) => (!num(km) ? { v: '–', u: '' } : unit === 'f' ? { v: Math.round(kmToMi(km)), u: 'mi' } : { v: Math.round(km), u: 'km' })
export const rainAmount = (mm, unit) => (!num(mm) ? { v: '–', u: '' } : unit === 'f' ? { v: Math.round(mmToIn(mm) * 100) / 100, u: 'in' } : { v: Math.round(mm * 10) / 10, u: 'mm' })
export const pressure = (hpa, unit) => (!num(hpa) ? { v: '–', u: '' } : unit === 'f' ? { v: (Math.round(hPaToInHg(hpa) * 100) / 100).toFixed(2), u: 'inHg' } : { v: Math.round(hpa), u: 'hPa' })

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
export const compass = (deg) => (num(deg) ? DIRS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16] : '–')

// ── scales ──
export function uvInfo(uv) {
  const v = num(uv) ? uv : 0
  if (v < 3) return { label: 'Low', color: '#4ade80', advice: 'No protection needed.' }
  if (v < 6) return { label: 'Moderate', color: '#facc15', advice: 'Wear sunscreen if you’ll be out a while.' }
  if (v < 8) return { label: 'High', color: '#fb923c', advice: 'Sunscreen, a hat and shade at midday.' }
  if (v < 11) return { label: 'Very high', color: '#f87171', advice: 'Limit sun between 10 AM and 4 PM.' }
  return { label: 'Extreme', color: '#c084fc', advice: 'Avoid the sun in the middle of the day.' }
}
export function aqiInfo(aqi) {
  if (!num(aqi)) return { label: 'Unavailable', color: '#94a3b8', advice: '' }
  if (aqi <= 50) return { label: 'Good', color: '#4ade80', advice: 'Air is clean — enjoy it.' }
  if (aqi <= 100) return { label: 'Moderate', color: '#facc15', advice: 'Fine for most people.' }
  if (aqi <= 150) return { label: 'Unhealthy for sensitive groups', color: '#fb923c', advice: 'Sensitive people should take it easy outside.' }
  if (aqi <= 200) return { label: 'Unhealthy', color: '#f87171', advice: 'Cut back on long outdoor exertion.' }
  if (aqi <= 300) return { label: 'Very unhealthy', color: '#c084fc', advice: 'Stay indoors if you can.' }
  return { label: 'Hazardous', color: '#e11d48', advice: 'Avoid going outside.' }
}
export function feelsNote(actualC, feelsC) {
  if (!num(actualC) || !num(feelsC)) return ''
  const d = feelsC - actualC
  if (d >= 2) return 'Feels warmer than the air — humidity is adding to it.'
  if (d <= -2) return 'Feels cooler than the air — wind is taking the edge off.'
  return 'Close to the actual temperature.'
}
// a colour for a °C value, used by the daily range bars
export function tempColor(c) {
  const stops = [[-10, '#60a5fa'], [5, '#38bdf8'], [14, '#2dd4bf'], [20, '#a3e635'], [26, '#facc15'], [32, '#fb923c'], [40, '#ef4444']]
  if (!num(c)) return '#94a3b8'
  if (c <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) if (c <= stops[i][0]) return stops[i][1]
  return stops[stops.length - 1][1]
}

// ── time (Open-Meteo returns local times with timezone=auto, e.g. "2026-10-24T15:30") ──
// All local strings are compared on the same (UTC-labelled) axis, so no timezone maths is needed.
export const localMs = (iso) => Date.parse(iso && iso.length === 16 ? `${iso}:00Z` : `${iso}Z`)
export function minutesSinceUpdate(w, nowMs = Date.now()) {
  if (!w || !w.current) return null
  return Math.max(0, Math.round((nowMs + (w.utcOffset || 0) * 1000 - localMs(w.current.time)) / 60000))
}
export function hourLabel(iso, isNow, hour12 = true) {
  if (isNow) return 'Now'
  const h = parseInt(iso.slice(11, 13), 10)
  if (!hour12) return `${String(h).padStart(2, '0')}:00`
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`
}
export function clockLabel(iso, hour12 = true) {
  const h = parseInt(iso.slice(11, 13), 10)
  const m = iso.slice(14, 16)
  if (!hour12) return `${String(h).padStart(2, '0')}:${m}`
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}`
}
export function dayLabel(dateStr, todayStr) {
  if (dateStr === todayStr) return 'Today'
  const d = new Date(`${dateStr}T12:00:00Z`)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]
}

// ── series for the hourly strip ──
export const METRICS = [
  { id: 'temp', label: 'Temp' }, { id: 'feels', label: 'Feels' }, { id: 'rain', label: 'Rain' }, { id: 'wind', label: 'Wind' }, { id: 'uv', label: 'UV' },
]
export function metricSeries(hourly, metric, unit, hours = 24, hour12 = true) {
  const rows = (hourly || []).slice(0, hours)
  const raw = (h) => (metric === 'temp' ? h.tempC : metric === 'feels' ? h.feelsC : metric === 'rain' ? h.precipProb : metric === 'wind' ? h.windKmh : h.uv)
  const show = (h) => {
    const v = raw(h)
    if (!num(v)) return '–'
    if (metric === 'temp' || metric === 'feels') return temp(v, unit)
    if (metric === 'rain') return `${Math.round(v)}%`
    if (metric === 'wind') return String(speed(v, unit).v)
    return String(Math.round(v))
  }
  const points = rows.map((h, i) => ({ time: h.time, label: hourLabel(h.time, i === 0, hour12), value: num(raw(h)) ? raw(h) : 0, display: show(h), code: h.code, isDay: h.isDay }))
  const vals = points.map((p) => p.value)
  return { points, min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 0 }
}

// daily bars share one scale (the coldest min to the hottest max of the whole week), like the best weather apps
export function dailyBars(daily, currentC) {
  if (!daily || !daily.length) return []
  const lo = Math.min(...daily.map((d) => d.minC))
  const hi = Math.max(...daily.map((d) => d.maxC))
  const span = hi - lo || 1
  const clamp = (n) => Math.max(0, Math.min(100, n))
  return daily.map((d, i) => ({
    ...d,
    left: clamp(((d.minC - lo) / span) * 100),
    width: Math.max(6, clamp(((d.maxC - d.minC) / span) * 100)),
    dot: i === 0 && num(currentC) ? clamp(((currentC - lo) / span) * 100) : null,
  }))
}

export function sunProgress(w) {
  const d = w && w.daily && w.daily[0]
  if (!d || !d.sunrise || !d.sunset || !w.current) return null
  const sr = localMs(d.sunrise); const ss = localMs(d.sunset); const now = localMs(w.current.time)
  return { progress: Math.max(0, Math.min(1, (now - sr) / (ss - sr))), isDay: now >= sr && now <= ss, sunrise: d.sunrise, sunset: d.sunset, daylightMin: Math.round((ss - sr) / 60000) }
}

// ── "Curry says" ──
function firstIndex(arr, fn) { for (let i = 0; i < arr.length; i++) if (fn(arr[i], i)) return i; return -1 }

export function buildTips(w, unit, hour12 = true) {
  if (!w || !w.current) return []
  const c = w.current
  const next12 = (w.hourly || []).slice(0, 12)
  const tips = []
  const raining = isWet(c.code) || (num(c.precipMm) && c.precipMm >= 0.2)
  const rainIdx = firstIndex(next12, (h) => num(h.precipProb) && h.precipProb >= 50)
  if (isStormy(c.code) || next12.some((h) => isStormy(h.code))) tips.push({ id: 'storm', emoji: '⛈️', text: 'Thunderstorms around — stay off open ground.' })
  else if (raining) tips.push({ id: 'rain', emoji: '☔', text: 'It’s wet out there right now — take an umbrella.' })
  else if (rainIdx >= 0) tips.push({ id: 'rain', emoji: '☂️', text: `Take an umbrella — rain likely ${rainIdx === 0 ? 'soon' : `around ${hourLabel(next12[rainIdx].time, false, hour12)}`} (${Math.round(next12[rainIdx].precipProb)}%).` })
  const uvMax = Math.max(0, ...next12.filter((h) => h.isDay).map((h) => (num(h.uv) ? h.uv : 0)))
  if (uvMax >= 6) {
    const peak = next12.find((h) => h.uv === uvMax)
    tips.push({ id: 'uv', emoji: '🧴', text: `UV peaks around ${hourLabel(peak.time, false, hour12)} — sunscreen and shade.` })
  }
  const feels = num(c.feelsC) ? c.feelsC : c.tempC
  if (feels <= 12) tips.push({ id: 'cold', emoji: '🧥', text: 'Bring a warm jacket.' })
  else if (feels <= 18 && !raining) tips.push({ id: 'cool', emoji: '🧥', text: 'A light jacket will do.' })
  else if (feels >= 32) tips.push({ id: 'hot', emoji: '💧', text: 'Hot out — drink plenty of water.' })
  if (num(c.gustKmh) && c.gustKmh >= 45) tips.push({ id: 'wind', emoji: '🌬️', text: `Gusts up to ${speed(c.gustKmh, unit).v} ${speed(c.gustKmh, unit).u}.` })
  if (w.aq && num(w.aq.usAqi) && w.aq.usAqi > 100) tips.push({ id: 'aqi', emoji: '😷', text: `Air quality is ${aqiInfo(w.aq.usAqi).label.toLowerCase()}.` })
  if (num(c.visibilityM) && c.visibilityM < 1000) tips.push({ id: 'vis', emoji: '🌫️', text: 'Low visibility — take care on the road.' })
  const best = bestWindow(w.hourly, hour12)
  if (best) tips.push({ id: 'best', emoji: '🌤️', text: `Best time to be outside: ${best.from} – ${best.to}.` })
  if (!tips.length && feels > 18 && feels < 30) tips.push({ id: 'nice', emoji: '😎', text: 'Lovely out — a good day to get outside.' })
  return tips.slice(0, 4)
}

// the longest comfortable daytime stretch in the next 12 hours (≥ 2 hours)
export function bestWindow(hourly, hour12 = true) {
  const rows = (hourly || []).slice(0, 12)
  const ok = (h) => h.isDay && num(h.feelsC) && h.feelsC >= 17 && h.feelsC <= 29 && (!num(h.precipProb) || h.precipProb < 30) && (!num(h.uv) || h.uv < 8) && (!num(h.windKmh) || h.windKmh < 35)
  let best = null; let start = -1
  for (let i = 0; i <= rows.length; i++) {
    const good = i < rows.length && ok(rows[i])
    if (good && start < 0) start = i
    if (!good && start >= 0) { const len = i - start; if (len >= 2 && (!best || len > best.len)) best = { start, end: i - 1, len }; start = -1 }
  }
  if (!best) return null
  const end = rows[best.end].time
  const endH = parseInt(end.slice(11, 13), 10) + 1
  const endIso = `${end.slice(0, 11)}${String(endH % 24).padStart(2, '0')}:00`
  return { from: hourLabel(rows[best.start].time, false, hour12), to: hourLabel(endIso, false, hour12) }
}

export function summarize(w, unit, hour12 = true) {
  if (!w || !w.current) return ''
  const c = w.current
  const d = describeCode(c.code, c.isDay)
  const parts = [`${d.label} right now`]
  if (num(c.feelsC) && Math.abs(c.feelsC - c.tempC) >= 2) parts[0] += `, feels like ${temp(c.feelsC, unit)}`
  const next12 = (w.hourly || []).slice(0, 12)
  const rainIdx = firstIndex(next12, (h, i) => i > 0 && num(h.precipProb) && h.precipProb >= 50)
  const today = w.daily && w.daily[0]
  let s = `${parts[0]}.`
  if (rainIdx > 0 && !isWet(c.code)) s += ` Rain looks likely around ${hourLabel(next12[rainIdx].time, false, hour12)}.`
  else if (isWet(c.code) || isSnowy(c.code)) {
    const dry = firstIndex(next12, (h) => num(h.precipProb) && h.precipProb < 30)
    if (dry > 0) s += ` It should ease around ${hourLabel(next12[dry].time, false, hour12)}.`
  }
  if (today) s += ` Today: high ${temp(today.maxC, unit)}, low ${temp(today.minC, unit)}.`
  return s
}

// ── intent detection for the command bar ──
const STRONG = /\b(weather|forecast|temperature|will it (rain|snow)|is it (raining|snowing|going to rain)|going to rain|(?:need|take|bring|carry)\s+(?:an?\s+)?umbrella|how (hot|cold|warm) is)\b/i
const WEAK = /\b(rain(?:ing|y)?|snow(?:ing)?|sunny|cloudy|windy)\b.*\b(today|now|tonight|tomorrow|outside)\b|\b(today|now|tonight|tomorrow|outside)\b.*\b(rain|raining|snow|snowing|sunny|cloudy|windy)\b/i
const TIME_TAIL = '(?:\\s+(?:today|tonight|tomorrow|right now|now|this (?:week|weekend|morning|afternoon|evening)|please))?'
const STOP = new Set(['what', 'whats', "what's", 'the', 'is', 'how', 'tell', 'show', 'me', 'get', 'give', 'check', 'current', 'todays', "today's", 'a', 'an', 'it', 'like', 'there', 'whats', 'any', 'and', 'of', 'in', 'for', 'at', 'my', 'now', 'today', 'tonight', 'tomorrow', 'hows', "how's", 'will', 'be', 'do', 'does', 'can', 'could', 'i', 'to', 'see', 'want', 'know', 'about'])
const NOT_A_PLACE = /^(?:my|the|here|me|home|today|tonight|tomorrow|now|this|there|outside|my (?:location|area|city|place|town)|this (?:week|weekend)|right now)$/i

export function extractPlace(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '')
  let m = t.match(new RegExp(`\\b(?:weather|forecast|temperature|rain|snow)\\s+(?:like\\s+)?(?:in|for|at|of)\\s+(.+?)${TIME_TAIL}$`, 'i'))
  if (!m) m = t.match(new RegExp(`\\b(?:in|for|at)\\s+([A-Za-z][A-Za-z .'’,\\-]{1,60}?)${TIME_TAIL}$`, 'i'))
  if (!m) m = t.match(new RegExp(`\\bhow (?:hot|cold|warm) is\\s+(?:it\\s+in\\s+)?([A-Za-z][A-Za-z .'’,\\-]{1,60}?)${TIME_TAIL}$`, 'i'))
  if (!m) {
    const pre = t.match(/^([A-Za-z][A-Za-z .'’-]{1,40}?)\s+(?:weather|forecast)\b/i)
    if (pre && pre[1].toLowerCase().split(/\s+/).every((wd) => !STOP.has(wd.replace(/[^a-z']/g, '')))) m = pre
  }
  if (!m) return null
  const name = m[1].trim().replace(/^the\s+/i, '').replace(/\s{2,}/g, ' ')
  if (!name || name.length > 60 || NOT_A_PLACE.test(name)) return null
  if (name.toLowerCase().split(/[\s,]+/).filter(Boolean).every((wd) => STOP.has(wd))) return null
  return name
}

export function detectWeatherIntent(text) {
  const t = String(text || '').trim()
  if (!t) return { isWeather: false, strong: false, place: null }
  const strong = STRONG.test(t)
  const weak = !strong && WEAK.test(t)
  if (!strong && !weak) return { isWeather: false, strong: false, place: null }
  return { isWeather: true, strong, place: extractPlace(t) }
}

// ── smooth sparkline for the hourly strip (Catmull-Rom → cubic Bézier) ──
export function sparkPath(values, width, height, pad = 6) {
  const n = values.length
  if (!n || !(width > 0) || !(height > 0)) return { line: '', area: '', pts: [] }
  const lo = Math.min(...values); const hi = Math.max(...values); const span = hi - lo || 1
  const step = width / n
  const pts = values.map((v, i) => ({ x: (i + 0.5) * step, y: pad + (1 - (v - lo) / span) * (height - pad * 2) }))
  if (n === 1) return { line: `M0 ${pts[0].y} L${width} ${pts[0].y}`, area: '', pts }
  let line = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i - 1] || pts[i]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6; const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6; const c2y = p2.y - (p3.y - p1.y) / 6
    const clampY = (y) => Math.max(pad, Math.min(height - pad, y))
    line += ` C${c1x.toFixed(1)} ${clampY(c1y).toFixed(1)} ${c2x.toFixed(1)} ${clampY(c2y).toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return { line, area: `${line} L${pts[n - 1].x.toFixed(1)} ${height} L${pts[0].x.toFixed(1)} ${height} Z`, pts }
}

export function distanceKmBetween(a, b) {
  const R = 6371; const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat); const dLon = rad(b.lon - a.lon)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}
export const visibilityNote = (m) => (!num(m) ? '' : m >= 10000 ? 'Clear view' : m >= 4000 ? 'Slightly hazy' : m >= 1000 ? 'Hazy' : 'Poor — take care')
export const humidityNote = (h) => (!num(h) ? '' : h < 30 ? 'Dry air' : h <= 60 ? 'Comfortable' : h <= 75 ? 'A little humid' : 'Very humid')
