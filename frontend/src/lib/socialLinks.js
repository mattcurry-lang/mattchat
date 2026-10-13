// src/lib/socialLinks.js
// Detects TikTok / Instagram post links inside a chat message so the bubble
// can show an official embed under the text. Pure string logic, no network.

const TIKTOK_VIDEO = /https?:\/\/(?:www\.|m\.)?tiktok\.com\/@[\w.\-]+\/video\/(\d+)[^\s]*/i
const TIKTOK_SHORT = /https?:\/\/(?:(?:vm|vt)\.tiktok\.com\/[\w-]+|(?:www\.)?tiktok\.com\/t\/[\w-]+)\/?[^\s]*/i
const INSTAGRAM_POST = /https?:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)[^\s]*/i

/**
 * @returns {null | {platform: 'tiktok'|'instagram', url: string, id?: string, embedUrl?: string}}
 *   tiktok  + id        -> full video link, can embed directly
 *   tiktok  + no id     -> short link (vm./vt./t/), id is resolved on tap
 *   instagram + embedUrl -> post / reel / tv link
 */
export function extractSocialLink(text) {
  if (typeof text !== 'string' || text.length === 0) return null

  let m = text.match(TIKTOK_VIDEO)
  if (m) return { platform: 'tiktok', url: m[0], id: m[1] }

  m = text.match(TIKTOK_SHORT)
  if (m) return { platform: 'tiktok', url: m[0] }

  m = text.match(INSTAGRAM_POST)
  if (m) {
    const kind = m[1] === 'reels' ? 'reel' : m[1]
    return {
      platform: 'instagram',
      url: m[0],
      embedUrl: `https://www.instagram.com/${kind}/${m[2]}/embed`,
    }
  }

  return null
}
