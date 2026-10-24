import { supabase } from '../supabase'

/**
 * lib/music/RelatedService.js
 *
 * "Songs like this one", fetched from the `music-related` edge function
 * (supabase/functions/music-related). That function asks Deezer's public
 * radio / related-artist data (no key needed) and, if LASTFM_API_KEY is set,
 * Last.fm's listening-based similar tracks, then merges them.
 *
 * It returns plain { artist, title } pairs - NOT playable tracks - so this
 * costs no YouTube quota. RadioEngine turns the pairs into playable tracks
 * one at a time, only when a song is about to play.
 *
 * If the function isn't deployed (or fails) this resolves to [] and the radio
 * falls back to its local/provider signals - the app never breaks because of it.
 */

const MEM = new Map()                      // seed key -> { at, items }
const OK_MS = 30 * 60 * 1000               // good answers are reused for 30 min
const FAIL_MS = 10 * 60 * 1000             // after a failure, don't retry for 10 min
const GONE_MS = 30 * 60 * 1000             // function missing (404): stay quiet for 30 min
let unavailableUntil = 0

const seedKey = (s) => `${(s.artist || '').toLowerCase().trim()}|${(s.title || '').toLowerCase().trim()}`

export const RelatedService = {
  /** @returns {Promise<Array<{artist:string,title:string,artwork?:string,duration?:number,score:number,source:string}>>} */
  async get(seed, { limit = 40 } = {}) {
    if (!seed?.artist) return []
    if (Date.now() < unavailableUntil) return []
    const key = seedKey(seed)
    const hit = MEM.get(key)
    if (hit && Date.now() < hit.until) return hit.items

    try {
      const { data, error } = await supabase.functions.invoke('music-related', {
        body: { artist: seed.artist, title: seed.title || '', limit },
      })
      if (error) throw error
      const items = Array.isArray(data?.items) ? data.items.filter((i) => i?.artist && i?.title) : []
      MEM.set(key, { items, until: Date.now() + (items.length ? OK_MS : FAIL_MS) })
      return items
    } catch (err) {
      const status = err?.context?.status
      if (status === 404 || /not found|Failed to send a request/i.test(err?.message || '')) unavailableUntil = Date.now() + GONE_MS
      MEM.set(key, { items: [], until: Date.now() + FAIL_MS })
      return []
    }
  },

  /** test helper */
  _reset() { MEM.clear(); unavailableUntil = 0 },
}
