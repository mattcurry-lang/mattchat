import { supabase } from './supabase'

export async function fetchShortsFeed(session, { category, query, pageToken, forYou } = {}) {
  const { data, error } = await supabase.functions.invoke('youtube-shorts-feed', {
    body: { category, query, pageToken, forYou },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) throw error
  return data
}

export async function saveShortsProgress(userId, video, positionSeconds) {
  return supabase.from('shorts_watch_history').upsert({
    user_id: userId,
    video_id: video.videoId,
    category: video.category,
    title: video.title,
    channel_title: video.channelTitle,
    thumbnail_url: video.thumbnailUrl,
    position_seconds: positionSeconds,
    duration_seconds: video.durationSeconds || 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,video_id' })
}

export async function getShortsProgress(userId, videoId) {
  const { data } = await supabase
    .from('shorts_watch_history')
    .select('position_seconds')
    .eq('user_id', userId).eq('video_id', videoId).maybeSingle()
  return data?.position_seconds || 0
}

export async function listRecentShorts(userId, limit = 20) {
  const { data } = await supabase
    .from('shorts_watch_history')
    .select('*').eq('user_id', userId)
    .order('updated_at', { ascending: false }).limit(limit)
  return data || []
}

// Fire-and-forget — call when a Short is skipped/finished so Curry
// can learn from it. Never awaited by the UI.
export function logShortsInteraction(userId, video, watchSeconds, { skipped = false, liked = false } = {}) {
  supabase.from('shorts_interactions').insert({
    user_id: userId,
    video_id: video.videoId,
    category: video.category,
    watch_seconds: watchSeconds,
    duration_seconds: video.durationSeconds || 0,
    skipped, liked,
  }).then(({ error }) => { if (error) console.error('logShortsInteraction failed:', error) })
}

export async function toggleShortsLike(userId, videoId, currentlyLiked) {
  if (currentlyLiked) {
    await supabase.from('shorts_likes').delete().eq('user_id', userId).eq('video_id', videoId)
    return false
  }
  await supabase.from('shorts_likes').insert({ user_id: userId, video_id: videoId })
  return true
}

export async function getLikedShortIds(userId, videoIds) {
  if (!videoIds.length) return new Set()
  const { data } = await supabase.from('shorts_likes').select('video_id')
    .eq('user_id', userId).in('video_id', videoIds)
  return new Set((data || []).map(r => r.video_id))
}
