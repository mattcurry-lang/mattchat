// src/components/emojiSearch.js
// Turns the generated pack into something the picker can search, plus skin tones.

// Raw pack (from emojiPackData.js) -> { groups, entries, byGroup }
export function buildPack({ GROUPS, EMOJIS }) {
  const entries = EMOJIS.map(([char, label, tags, g, skins]) => ({
    char,
    label,
    g,
    skins: skins || null,
    // lower-cased once, so each keystroke is just substring checks
    search: `${label} ${tags}`.toLowerCase(),
  }))
  const byGroup = GROUPS.map(() => [])
  entries.forEach((e) => byGroup[e.g].push(e))
  return { groups: GROUPS, entries, byGroup }
}

const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// "heart eyes", "kenya", "lol", or the emoji itself. Every word must match.
// Ranking, best first: the exact name ("fire" -> 🔥), a whole word in the name
// ("heart" -> red heart), a name that starts with the word, a whole keyword,
// then any other partial match. Shorter names win ties, then Unicode order.
export function searchEntries(entries, query, limit = 96) {
  const raw = String(query || '').trim()
  if (!raw) return []
  const exact = entries.filter((e) => e.char === raw || (e.skins && e.skins.includes(raw)))
  if (exact.length) return exact.slice(0, limit)

  const words = strip(raw).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const phrase = words.join(' ')
  const first = words[0]

  const ranked = []
  entries.forEach((e, index) => {
    const label = strip(e.label)
    const hay = strip(e.search)
    if (!words.every((w) => hay.includes(w))) return
    const labelTokens = label.split(/[^a-z0-9+]+/).filter(Boolean)
    const hayTokens = hay.split(/[^a-z0-9+]+/).filter(Boolean)
    let rank = 4
    if (label === phrase) rank = 0
    else if (labelTokens.includes(first)) rank = 1
    else if (label.startsWith(first)) rank = 2
    else if (hayTokens.includes(first)) rank = 3
    ranked.push({ e, rank, len: label.length, index })
  })
  ranked.sort((a, b) => a.rank - b.rank || a.len - b.len || a.index - b.index)
  return ranked.slice(0, limit).map((r) => r.e)
}

// tone: 0 = default yellow, 1..5 = light..dark. Emojis without variants stay as they are.
export function withSkinTone(entry, tone) {
  if (tone > 0 && entry.skins && entry.skins[tone - 1]) return entry.skins[tone - 1]
  return entry.char
}
