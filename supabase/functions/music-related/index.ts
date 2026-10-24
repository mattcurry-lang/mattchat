// supabase/functions/music-related/index.ts
//
// "Songs like this one" for Mattchat's music radio.
//
//   POST { artist, title?, limit? }  ->  { items: [{ artist, title, artwork?, duration?, score, source }], sources: [...] }
//
// It returns NAMES only (artist + title), never playable links, so it costs no YouTube quota. The app
// matches names to playable tracks one at a time, only when a song is about to play.
//
// Sources (merged; a song both agree on gets a boost):
//   - Deezer public API (no key): the artist's radio + the top songs of related artists
//   - Last.fm (optional, needs the LASTFM_API_KEY secret): listening-based similar tracks.
//     Last.fm data is free for non-commercial use and asks for "powered by AudioScrobbler" credit.
//
// Deploy:   supabase functions deploy music-related
// Optional: supabase secrets set LASTFM_API_KEY=your_key
// (JWT verification stays ON: only signed-in Mattchat users can call it.)

export type Item = { artist: string; title: string; artwork?: string; duration?: number; score: number; source: string }
type Json = any
type Fetcher = (url: string) => Promise<Json>

const DEEZER = 'https://api.deezer.com'
const LASTFM = 'https://ws.audioscrobbler.com/2.0/'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export async function getJson(url: string, ms = 5000): Promise<Json> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))
export const clean = (s = '') =>
  String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\s-\s(topic|vevo)$/i, ' ')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

// ── Deezer ────────────────────────────────────────────────
export async function fromDeezer(artist: string, fetchJson: Fetcher = getJson): Promise<Item[]> {
  const found = await fetchJson(`${DEEZER}/search/artist?q=${encodeURIComponent(artist)}&limit=5`)
  const want = clean(artist)
  const list: Json[] = found?.data || []
  const pick = list.find((a) => clean(a.name) === want) || list.find((a) => clean(a.name).includes(want) || want.includes(clean(a.name))) || null
  if (!pick) return []

  const [radio, related] = await Promise.all([
    fetchJson(`${DEEZER}/artist/${pick.id}/radio?limit=40`).catch(() => ({ data: [] })),
    fetchJson(`${DEEZER}/artist/${pick.id}/related?limit=8`).catch(() => ({ data: [] })),
  ])

  const items: Item[] = []
  const toItem = (t: Json, score: number, source: string): Item | null => {
    const a = t?.artist?.name; const title = t?.title_short || t?.title
    if (!a || !title) return null
    return { artist: a, title, artwork: t?.album?.cover_medium || t?.album?.cover, duration: t?.duration, score: clamp01(score), source }
  }

  ;(radio?.data || []).forEach((t: Json, i: number) => { const it = toItem(t, 0.8 - i * 0.004, 'deezer'); if (it) items.push(it) })

  const rel: Json[] = (related?.data || []).slice(0, 5)
  const tops = await Promise.all(rel.map((r) => fetchJson(`${DEEZER}/artist/${r.id}/top?limit=4`).catch(() => ({ data: [] }))))
  tops.forEach((res, ri) => {
    ;(res?.data || []).forEach((t: Json, ti: number) => { const it = toItem(t, 0.64 - ri * 0.05 - ti * 0.02, 'deezer'); if (it) items.push(it) })
  })
  return items
}

// ── Last.fm (optional) ────────────────────────────────────
export async function fromLastfm(artist: string, title: string, key: string | undefined, fetchJson: Fetcher = getJson): Promise<Item[]> {
  if (!key) return []
  const base = `${LASTFM}?api_key=${encodeURIComponent(key)}&format=json&autocorrect=1`
  const a = encodeURIComponent(artist)
  const items: Item[] = []

  if (title) {
    const sim = await fetchJson(`${base}&method=track.getsimilar&artist=${a}&track=${encodeURIComponent(title)}&limit=40`).catch(() => null)
    const tracks: Json[] = sim?.similartracks?.track || []
    tracks.forEach((t) => {
      if (t?.name && t?.artist?.name) items.push({ artist: t.artist.name, title: t.name, score: clamp01(Number(t.match)), source: 'lastfm' })
    })
  }
  if (items.length < 10) {
    const simA = await fetchJson(`${base}&method=artist.getsimilar&artist=${a}&limit=6`).catch(() => null)
    const artists: Json[] = (simA?.similarartists?.artist || []).slice(0, 5)
    const tops = await Promise.all(artists.map((x) => fetchJson(`${base}&method=artist.gettoptracks&artist=${encodeURIComponent(x.name)}&limit=3`).catch(() => null)))
    tops.forEach((res, i) => {
      const w = clamp01(Number(artists[i].match)) * 0.8
      ;(res?.toptracks?.track || []).forEach((t: Json) => { if (t?.name) items.push({ artist: artists[i].name, title: t.name, score: w, source: 'lastfm' }) })
    })
  }
  return items
}

// ── merge ─────────────────────────────────────────────────
export function merge(lists: Item[][], seed: { artist: string; title?: string }, limit = 40, perArtist = 4): Item[] {
  const byKey = new Map<string, Item & { n: number }>()
  const seedKey = `${clean(seed.artist)}|${clean(seed.title || '')}`
  for (const list of lists) {
    const seen = new Set<string>()
    for (const it of list) {
      const key = `${clean(it.artist)}|${clean(it.title)}`
      if (key === seedKey || seen.has(key)) continue
      seen.add(key)
      const prev = byKey.get(key)
      if (!prev) byKey.set(key, { ...it, n: 1 })
      else { prev.n += 1; prev.score = Math.max(prev.score, it.score); prev.source = `${prev.source}+${it.source}`; if (!prev.artwork) prev.artwork = it.artwork }
    }
  }
  const all = [...byKey.values()].map((x) => ({ ...x, score: clamp01(x.score + (x.n > 1 ? 0.15 : 0)) })).sort((a, b) => b.score - a.score)
  const counts = new Map<string, number>(); const out: Item[] = []
  for (const x of all) {
    const a = clean(x.artist); const c = counts.get(a) || 0
    if (c >= perArtist) continue
    counts.set(a, c + 1)
    const { n: _n, ...item } = x
    out.push(item)
    if (out.length >= limit) break
  }
  return out
}

// ── handler ───────────────────────────────────────────────
export async function handle(req: Request, env: { lastfmKey?: string } = {}, fetchJson: Fetcher = getJson): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let body: Json
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const artist = String(body?.artist || '').trim().slice(0, 120)
  const title = String(body?.title || '').trim().slice(0, 160)
  const limit = Math.max(5, Math.min(60, Number(body?.limit) || 40))
  if (!artist) return json({ error: 'artist is required' }, 400)

  const [deezer, lastfm] = await Promise.allSettled([fromDeezer(artist, fetchJson), fromLastfm(artist, title, env.lastfmKey, fetchJson)])
  const lists = [deezer, lastfm].map((r) => (r.status === 'fulfilled' ? r.value : []))
  const sources = [lists[0].length ? 'deezer' : '', lists[1].length ? 'lastfm' : ''].filter(Boolean)
  return json({ items: merge(lists, { artist, title }, limit), sources })
}

declare const Deno: any
Deno.serve((req: Request) => handle(req, { lastfmKey: Deno.env.get('LASTFM_API_KEY') }))
