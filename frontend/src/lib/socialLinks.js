// src/lib/socialLinks.js
// Detects TikTok / Instagram post links inside a chat message so the bubble
// can show an official embed under the text. Pure string logic, no network.

const TIKTOK_VIDEO = /https?:\/\/(?:www\.|m\.)?tiktok\.com\/@([\w.\-]+)\/video\/(\d+)[^\s]*/i
const TIKTOK_SHORT = /https?:\/\/(?:(?:vm|vt)\.tiktok\.com\/[\w-]+|(?:www\.)?tiktok\.com\/t\/[\w-]+)\/?[^\s]*/i
const INSTAGRAM_POST = /https?:\/\/(?:www\.)?instagram\.com\/(?:([\w.]+)\/)?(p|reel|reels|tv)\/([\w-]+)[^\s]*/i

/**
 * @returns {null | {platform: 'tiktok'|'instagram', url: string, id?: string, embedUrl?: string, handle?: string, kind?: string}}
 *   tiktok  + id        -> full video link, can embed directly (handle = the @creator in the link)
 *   tiktok  + no id     -> short link (vm./vt./t/), id is resolved on tap
 *   instagram + embedUrl -> post / reel / tv link (kind = 'p' | 'reel' | 'tv'; handle only when the link has one)
 */
export function extractSocialLink(text) {
  if (typeof text !== 'string' || text.length === 0) return null

  let m = text.match(TIKTOK_VIDEO)
  if (m) return { platform: 'tiktok', url: m[0], id: m[2], handle: m[1] }

  m = text.match(TIKTOK_SHORT)
  if (m) return { platform: 'tiktok', url: m[0] }

  m = text.match(INSTAGRAM_POST)
  if (m) {
    const kind = m[2] === 'reels' ? 'reel' : m[2]
    return {
      platform: 'instagram',
      url: m[0],
      kind,
      handle: m[1] || undefined,
      embedUrl: `https://www.instagram.com/${kind}/${m[3]}/embed`,
    }
  }

  return null
}

/**
 * A tidy label for a link: no https://, no www., no ?utm_source=...&srtk=... tracking tail.
 *   https://www.instagram.com/reel/DeZhkhSKfIj/?utm_source=ig_web_copy_link&srtk=...  ->  instagram.com/reel/DeZhkhSKfIj
 * Display only: the real link is never changed.
 */
export function shortSocialUrl(url) {
  try {
    const u = new URL(url)
    return `${u.hostname.replace(/^(?:www|m)\./i, '')}${u.pathname.replace(/\/+$/, '')}`
  } catch {
    return String(url || '').replace(/^https?:\/\/(?:www\.)?/i, '').split(/[?#]/)[0].replace(/\/+$/, '')
  }
}
