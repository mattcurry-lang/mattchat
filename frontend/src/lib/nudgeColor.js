// Shared parsing + contrast logic so both the sender's picker preview
// and the actual chat bubble compute readable text color the same way.

export const NUDGE_COLOR_PRESETS = [
  { id: 'violet', label: 'Violet', hex: '#6c63ff' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
  { id: 'rose', label: 'Rose gold', hex: '#f472b6' },
  { id: 'sunny', label: 'Sunny yellow', hex: '#facc15' },
  { id: 'mint', label: 'Mint', hex: '#34d399' },
  { id: 'sky', label: 'Sky blue', hex: '#38bdf8' },
  { id: 'coral', label: 'Coral', hex: '#fb7185' },
  { id: 'lavender', label: 'Lavender', hex: '#c4b5fd' },
]

const DEFAULT_COLOR = '#6c63ff'
const HEX_RE = /^#[0-9a-fA-F]{6}$/

// Returns black or white depending on which reads better against
// the given hex background (standard relative-luminance check).
export function getReadableTextColor(hex) {
  const clean = HEX_RE.test(hex) ? hex : DEFAULT_COLOR
  const r = parseInt(clean.slice(1, 3), 16)
  const g = parseInt(clean.slice(3, 5), 16)
  const b = parseInt(clean.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#14121f' : '#ffffff'
}

// Parses `partner_nudge:#hex:encodedText` — falls back gracefully for
// the older `partner_nudge:encodedText` format sent before colors existed.
export function parsePartnerNudge(content) {
  const withoutPrefix = content.replace('partner_nudge:', '')
  const firstColon = withoutPrefix.indexOf(':')
  const maybeColor = firstColon !== -1 ? withoutPrefix.slice(0, firstColon) : null

  if (maybeColor && HEX_RE.test(maybeColor)) {
    return {
      color: maybeColor,
      text: decodeURIComponent(withoutPrefix.slice(firstColon + 1)),
    }
  }
  // legacy format — no color segment, whole remainder is the text
  return { color: DEFAULT_COLOR, text: decodeURIComponent(withoutPrefix) }
}

export function loadSavedNudgeColor(linkId) {
  try { return localStorage.getItem(`nudge_color:${linkId}`) || DEFAULT_COLOR }
  catch { return DEFAULT_COLOR }
}

export function saveNudgeColor(linkId, hex) {
  try { localStorage.setItem(`nudge_color:${linkId}`, hex) } catch {}
}
