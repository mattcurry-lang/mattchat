export const BIBLE_BOOKS = [
  { name: 'Genesis', chapters: 50 }, { name: 'Exodus', chapters: 40 }, { name: 'Leviticus', chapters: 27 },
  { name: 'Numbers', chapters: 36 }, { name: 'Deuteronomy', chapters: 34 }, { name: 'Joshua', chapters: 24 },
  { name: 'Judges', chapters: 21 }, { name: 'Ruth', chapters: 4 }, { name: '1 Samuel', chapters: 31 },
  { name: '2 Samuel', chapters: 24 }, { name: '1 Kings', chapters: 22 }, { name: '2 Kings', chapters: 25 },
  { name: '1 Chronicles', chapters: 29 }, { name: '2 Chronicles', chapters: 36 }, { name: 'Ezra', chapters: 10 },
  { name: 'Nehemiah', chapters: 13 }, { name: 'Esther', chapters: 10 }, { name: 'Job', chapters: 42 },
  { name: 'Psalm', chapters: 150 }, { name: 'Proverbs', chapters: 31 }, { name: 'Ecclesiastes', chapters: 12 },
  { name: 'Song of Solomon', chapters: 8 }, { name: 'Isaiah', chapters: 66 }, { name: 'Jeremiah', chapters: 52 },
  { name: 'Lamentations', chapters: 5 }, { name: 'Ezekiel', chapters: 48 }, { name: 'Daniel', chapters: 12 },
  { name: 'Hosea', chapters: 14 }, { name: 'Joel', chapters: 3 }, { name: 'Amos', chapters: 9 },
  { name: 'Obadiah', chapters: 1 }, { name: 'Jonah', chapters: 4 }, { name: 'Micah', chapters: 7 },
  { name: 'Nahum', chapters: 3 }, { name: 'Habakkuk', chapters: 3 }, { name: 'Zephaniah', chapters: 3 },
  { name: 'Haggai', chapters: 2 }, { name: 'Zechariah', chapters: 14 }, { name: 'Malachi', chapters: 4 },
  { name: 'Matthew', chapters: 28 }, { name: 'Mark', chapters: 16 }, { name: 'Luke', chapters: 24 },
  { name: 'John', chapters: 21 }, { name: 'Acts', chapters: 28 }, { name: 'Romans', chapters: 16 },
  { name: '1 Corinthians', chapters: 16 }, { name: '2 Corinthians', chapters: 13 }, { name: 'Galatians', chapters: 6 },
  { name: 'Ephesians', chapters: 6 }, { name: 'Philippians', chapters: 4 }, { name: 'Colossians', chapters: 4 },
  { name: '1 Thessalonians', chapters: 5 }, { name: '2 Thessalonians', chapters: 3 }, { name: '1 Timothy', chapters: 6 },
  { name: '2 Timothy', chapters: 4 }, { name: 'Titus', chapters: 3 }, { name: 'Philemon', chapters: 1 },
  { name: 'Hebrews', chapters: 13 }, { name: 'James', chapters: 5 }, { name: '1 Peter', chapters: 5 },
  { name: '2 Peter', chapters: 3 }, { name: '1 John', chapters: 5 }, { name: '2 John', chapters: 1 },
  { name: '3 John', chapters: 1 }, { name: 'Jude', chapters: 1 }, { name: 'Revelation', chapters: 22 },
]

// Finds a book by fuzzy/partial name match — case-insensitive,
// handles "genesis", "Genesis", "gen", partial typing, etc.
export function findBook(query) {
  const q = query.trim().toLowerCase()
  if (!q) return null
  // Exact match first
  const exact = BIBLE_BOOKS.find(b => b.name.toLowerCase() === q)
  if (exact) return exact
  // Then prefix match (so "gen" finds "Genesis")
  const prefix = BIBLE_BOOKS.find(b => b.name.toLowerCase().startsWith(q))
  if (prefix) return prefix
  return null
}

// Parses a query into one of three shapes:
//   { type: 'book', book }              — just a book name, e.g. "Genesis"
//   { type: 'chapter', book, chapter }   — book + chapter, e.g. "Genesis 3"
//   { type: 'verse', reference }         — anything with a colon, e.g. "Genesis 3:16" or unparseable — pass through as-is
export function parseBibleQuery(rawQuery) {
  const query = rawQuery.trim()
  if (!query) return null

  // "Genesis 3:16" or "Genesis 3:16-18" — has a colon, treat as a direct verse lookup
  if (query.includes(':')) {
    return { type: 'verse', reference: query }
  }

  // Try to split off a trailing chapter number: "Genesis 3", "1 John 2"
  const match = query.match(/^(.*?)\s+(\d{1,3})$/)
  if (match) {
    const book = findBook(match[1])
    if (book) {
      const chapter = Math.min(Math.max(parseInt(match[2], 10), 1), book.chapters)
      return { type: 'chapter', book, chapter }
    }
  }

  // Just a book name on its own: "Genesis"
  const book = findBook(query)
  if (book) return { type: 'book', book }

  // Fallback — let the existing single-reference lookup try it and
  // surface its own error message if it truly doesn't resolve.
  return { type: 'verse', reference: query }
}
