// Same eight themes as ProfileMenuSheet. Use these when showing someone else's theme
// (profile card banner, flair, and so on).
export const PROFILE_THEMES = [
  { id: 'violet', label: 'Violet', a: '#6c63ff', b: '#a78bfa' },
  { id: 'ocean', label: 'Ocean', a: '#0ea5e9', b: '#22d3ee' },
  { id: 'aurora', label: 'Aurora', a: '#06b6d4', b: '#8b5cf6' },
  { id: 'sunset', label: 'Sunset', a: '#f97316', b: '#ec4899' },
  { id: 'forest', label: 'Forest', a: '#16a34a', b: '#84cc16' },
  { id: 'gold', label: 'Gold', a: '#d97706', b: '#fbbf24' },
  { id: 'rose', label: 'Rose', a: '#e11d48', b: '#fb7185' },
  { id: 'graphite', label: 'Graphite', a: '#334155', b: '#64748b' },
]

export const themeById = (id) => PROFILE_THEMES.find((t) => t.id === id) || PROFILE_THEMES[0]

export const themeGradient = (t) => `linear-gradient(135deg, ${t.a}, ${t.b})`

// the dotted banner used on the profile page
export const themeBanner = (id) =>
  `radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1.6px), ${themeGradient(themeById(id))}`
