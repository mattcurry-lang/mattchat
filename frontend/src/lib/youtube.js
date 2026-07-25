// Matches youtube.com/watch?v=, youtu.be/, youtube.com/shorts/ — the
// three URL shapes people actually paste. Captures the video id.
const YOUTUBE_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

export function extractYouTubeId(text) {
  if (!text) return null
  const match = text.match(YOUTUBE_URL_REGEX)
  return match ? match[1] : null
}

// oEmbed is public, no API key needed — gives us title, author, and a
// thumbnail without touching the (quota-limited, OAuth-gated) YouTube
// Data API at all for this simple preview-card step.
export async function fetchYouTubeOEmbed(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    )
    if (!res.ok) return null
    const data = await res.json()
    return {
      title: data.title,
      authorName: data.author_name,
      thumbnailUrl: data.thumbnail_url,
    }
  } catch (e) {
    console.error('fetchYouTubeOEmbed failed:', e)
    return null
  }
}
