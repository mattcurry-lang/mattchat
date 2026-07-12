import { useState, useEffect, useCallback } from 'react'

// Reads/writes a `data-theme` attribute on <html>, which the CSS
// variable overrides in App.css key off of. Persisted in
// localStorage so it survives refreshes. Defaults to dark (today's
// look) for anyone who hasn't chosen yet.
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('mattchat-theme') || 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('mattchat-theme', theme) } catch {}
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
