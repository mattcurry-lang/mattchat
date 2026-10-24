// src/lib/youtubeThumb.js
// Everything about showing a YouTube video's picture and facts, with no API key.
//
// Thumbnails live at i.ytimg.com/vi/<id>/<quality>.jpg:
//   maxresdefault 1280x720 (16:9, sharpest, but missing for older videos)
//   sddefault      640x480 (4:3, black bars baked in)
//   hqdefault      480x360 (4:3, black bars baked in, exists for essentially every video)
//   mqdefault      320x180 (16:9, always there but small)
// The 4:3 ones are the 16:9 picture with bars, so showing them with object-fit: cover
// in a 16:9 frame crops the bars off exactly.

const BASE = 'https://i.ytimg.com/vi'

export const thumbUrl = (id, quality) => `${BASE}/${id}/${quality}.jpg`
export const baseThumbUrl = (id) => thumbUrl(id, 'hqdefault')       // safe first paint
export const fallbackThumbUrl = (id) => thumbUrl(id, 'mqdefault')
export const UPGRADE_QUALITIES = ['maxresdefault', 'sddefault']

// YouTube answers a missing size with a tiny 120x90 placeholder (and a 404).
export const MIN_REAL_WIDTH = 200
export const isRealThumb = (img) => !!img && img.naturalWidth >= MIN_REAL_WIDTH

export const isValidVideoId = (id) => /^[A-Za-z0-9_-]{11}$/.test(String(id || ''))
export const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`

// Links inside AI-written text must never be able to run code (javascript:, data:).
export function safeHttpUrl(value) {
  try {
    const u = new URL(String(value))
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

// "1:05" -> 65, "1:02:03" -> 3723, junk -> 0
export function timestampToSeconds(ts) {
  if (!ts) return 0
  const parts = String(ts).split(':').map(Number)
  if (!parts.length || parts.some((n) => Number.isNaN(n) || n < 0)) return 0
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

// Search results may carry a duration as seconds or as an ISO-8601 string (PT4M13S).
export function formatDuration(value) {
  if (value == null || value === '') return ''
  let sec = Number(value)
  if (Number.isNaN(sec)) {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value))
    if (!m) return ''
    sec = (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)
  }
  if (!(sec > 0)) return ''
  const h = Math.floor(sec / 3600)
  const mm = Math.floor((sec % 3600) / 60)
  const ss = Math.floor(sec % 60)
  return h > 0 ? `${h}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`
}

export function formatViews(n) {
  const v = Number(n)
  if (!(v >= 0) || n == null || n === '') return ''
  const f = (x, s) => `${x.toFixed(x >= 10 ? 0 : 1).replace(/\.0$/, '')}${s} views`
  if (v >= 1e9) return f(v / 1e9, 'B')
  if (v >= 1e6) return f(v / 1e6, 'M')
  if (v >= 1e3) return f(v / 1e3, 'K')
  return `${v} views`
}

export function timeAgo(iso, now = Date.now()) {
  const t = new Date(iso).getTime()
  if (!iso || Number.isNaN(t)) return ''
  const s = Math.max(0, (now - t) / 1000)
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [name, secs] of units) {
    if (s >= secs) { const n = Math.floor(s / secs); return `${n} ${name}${n > 1 ? 's' : ''} ago` }
  }
  return 'just now'
}

// A stable colour per channel name for the little avatar circle.
export function avatarGradient(name) {
  let h = 0
  for (const ch of String(name || '?')) h = (h * 31 + ch.charCodeAt(0)) % 360
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 50) % 360} 70% 42%))`
}
export const initialOf = (name) => (String(name || '?').trim()[0] || '?').toUpperCase()
