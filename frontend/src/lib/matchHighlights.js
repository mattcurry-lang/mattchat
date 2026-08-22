import { supabase, searchYouTube } from './supabase'

// Only these channels' videos are ever surfaced as "highlights" —
// keeps this to official sources rather than random reuploads.
// Matched case-insensitively against the video's channelTitle.
const ALLOWED_HIGHLIGHT_CHANNELS = ['premier league']

export async function getCachedHighlight(matchId) {
  const { data, error } = await supabase
    .from('pulse_highlights_cache')
    .select('*')
    .eq('match_id', matchId)
    .maybeSingle()
  if (error) throw error
  return data
}

function pickBestResult(results, homeTeam, awayTeam) {
  const allowed = results.filter(r =>
    ALLOWED_HIGHLIGHT_CHANNELS.some(c => (r.channelTitle || '').toLowerCase().includes(c))
  )
  if (allowed.length === 0) return null

  // Prefer a result whose title actually mentions both team names —
  // helps pick the right video when a channel has posted several
  // highlight reels close together.
  const homeLower = homeTeam.toLowerCase()
  const awayLower = awayTeam.toLowerCase()
  const bestMatch = allowed.find(r => {
    const t = r.title.toLowerCase()
    return t.includes(homeLower) && t.includes(awayLower)
  })
  return bestMatch || allowed[0]
}

// session: needed by searchYouTube (same as YouTubePulsePage's usage).
// match: { id, homeTeam, awayTeam }
export async function findMatchHighlights(session, match) {
  const existing = await getCachedHighlight(match.id)
  if (existing) return existing // whether found or not_found, don't re-search

  const query = `${match.homeTeam} vs ${match.awayTeam} highlights premier league`
  const res = await searchYouTube(session, query)
  const results = res?.ok ? res.results : []
  const best = pickBestResult(results, match.homeTeam, match.awayTeam)

  const row = best ? {
    match_id: match.id,
    home_team: match.homeTeam,
    away_team: match.awayTeam,
    video_id: best.videoId,
    title: best.title,
    channel_title: best.channelTitle,
    not_found: false,
    fetched_at: new Date().toISOString(),
  } : {
    match_id: match.id,
    home_team: match.homeTeam,
    away_team: match.awayTeam,
    video_id: null,
    title: null,
    channel_title: null,
    not_found: true,
    fetched_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('pulse_highlights_cache').upsert(row)
  if (error) console.error('caching highlight result failed:', error)

  return row
}
