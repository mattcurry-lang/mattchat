const keyFor = (userId) => `mattchat:zoom:link:${userId || 'anon'}`

/** Returns a clean https Zoom link, or null if the input isn't a valid Zoom meeting link. */
export function parseZoomLink(input) {
  if (!input) return null
  let raw = String(input).trim()
  const digits = raw.replace(/[\s-]/g, '')
  if (/^\d{9,11}$/.test(digits)) raw = `https://zoom.us/j/${digits}`        // bare meeting ID (no passcode)
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`
  let u
  try { u = new URL(raw) } catch { return null }
  const host = u.hostname.toLowerCase()
  const hostOk = host === 'zoom.us' || host.endsWith('.zoom.us') || host === 'zoom.com' || host.endsWith('.zoom.com')
  const pathOk = /^\/(j|my|wc\/join)\/[A-Za-z0-9_.-]+/.test(u.pathname)
  if (!hostOk || !pathOk) return null
  u.protocol = 'https:'
  return u.toString()
}

export const isZoomUrl = (url) => Boolean(parseZoomLink(url))

export function getMyZoomLink(userId) {
  try { return parseZoomLink(localStorage.getItem(keyFor(userId))) } catch { return null }
}
export function saveMyZoomLink(userId, link) {
  const clean = parseZoomLink(link)
  if (!clean) return null
  try { localStorage.setItem(keyFor(userId), clean) } catch { /* ignore */ }
  return clean
}
export function clearMyZoomLink(userId) {
  try { localStorage.removeItem(keyFor(userId)) } catch { /* ignore */ }
}
