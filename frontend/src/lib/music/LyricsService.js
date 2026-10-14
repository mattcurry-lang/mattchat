// Time-synced lyrics from LRCLIB (https://lrclib.net), free, no API key.
const API = 'https://lrclib.net/api'
const mem = new Map()

export function cleanMeta(track) {
  let artist = (track?.artist || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim()
  artist = artist.split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bx\b)\s*/i)[0].trim()

  let title = track?.title || ''
  if (title.includes(' - ')) {
    const [left, ...rest] = title.split(' - ')
    const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, '')
    const l = norm(left)
    const a = norm(artist)
    if (!a || l.includes(a) || a.includes(l)) {
      title = rest.join(' - ')
      if (!artist) artist = left.trim()
    }
  }
  title = title
    .replace(/[([][^)\]]*[)\]]/g, ' ')
    .replace(/\b(feat|ft)\.?\s.*$/i, '')
    .replace(/\b(official|lyric|lyrics|audio|video|visualizer)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { title, artist }
}

export function parseLrc(text) {
  if (!text) return null
  const re = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g
  const lines = []
  for (const raw of text.split('\n')) {
    const times = []
    re.lastIndex = 0
    let m
    while ((m = re.exec(raw))) {
      const frac = m[3] ? parseInt(m[3], 10) / 10 ** m[3].length : 0
      times.push(parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac)
    }
    if (!times.length) continue
    const body = raw.replace(re, '').trim()
    times.forEach((t) => lines.push({ t, text: body }))
  }
  if (!lines.length) return null
  return lines.sort((a, b) => a.t - b.t)
}

async function request(url) {
  try {
    const r = await fetch(url)
    if (r.status === 404) return { missing: true }
    if (!r.ok) return { failed: true }
    return { json: await r.json() }
  } catch {
    return { failed: true }
  }
}

function pickBest(list, dur) {
  if (!Array.isArray(list)) return null
  const usable = list.filter((h) => h && (h.syncedLyrics || h.plainLyrics || h.instrumental))
  if (!usable.length) return null
  const score = (h) => (h.syncedLyrics ? 0 : 1000) + (dur && h.duration ? Math.abs(h.duration - dur) : 0)
  const best = usable.sort((a, b) => score(a) - score(b))[0]
  if (dur && best.duration && Math.abs(best.duration - dur) > 20) return null
  return best
}

function build(hit) {
  if (!hit) return null
  if (hit.instrumental) return { synced: null, plain: '', instrumental: true }
  return { synced: parseLrc(hit.syncedLyrics), plain: hit.plainLyrics || '', instrumental: false }
}

export const LyricsService = {
  async get(track, durationHint) {
    if (!track) return null
    if (mem.has(track.id)) return mem.get(track.id)

    const { title, artist } = cleanMeta(track)
    if (!title) return null
    const dur = Math.round(durationHint || track.duration || 0)
    let failed = 0
    let hit = null

    const qs = new URLSearchParams({ track_name: title, artist_name: artist })
    if (dur) qs.set('duration', String(dur))
    const exact = await request(`${API}/get?${qs}`)
    if (exact.failed) failed++
    else if (exact.json) hit = exact.json

    if (!hit || !(hit.syncedLyrics || hit.plainLyrics || hit.instrumental)) {
      hit = null
      const found = await request(`${API}/search?${new URLSearchParams({ q: `${artist} ${title}`.trim() })}`)
      if (found.failed) failed++
      else if (found.json) hit = pickBest(found.json, dur)
    }

    if (!hit && failed >= 2) throw new Error('lyrics network failure')
    const result = build(hit)
    mem.set(track.id, result)
    return result
  },
}
