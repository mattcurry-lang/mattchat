// src/hooks/useDekutUsage.js
import { useState, useEffect, useCallback } from 'react'

const MAX_RECENTS = 8

const keys = (uniId) => ({
  favorites: `mattchat:${uniId}:favorites`,
  recents: `mattchat:${uniId}:recents`,
  counts: `mattchat:${uniId}:usage-counts`,
})

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable — fail silently, feature degrades gracefully
  }
}

export function timeAgo(ts) {
  const diffMin = Math.round((Date.now() - ts) / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return diffDay === 1 ? 'Yesterday' : `${diffDay}d ago`
}

export function useDekutUsage(universityId = 'dekut') {
  const k = keys(universityId)
  const [favorites, setFavorites] = useState(() => readJSON(k.favorites, []))
  const [recents, setRecents] = useState(() => readJSON(k.recents, []))
  const [counts, setCounts] = useState(() => readJSON(k.counts, {}))

  useEffect(() => writeJSON(k.favorites, favorites), [favorites]) // eslint-disable-line
  useEffect(() => writeJSON(k.recents, recents), [recents]) // eslint-disable-line
  useEffect(() => writeJSON(k.counts, counts), [counts]) // eslint-disable-line

  const toggleFavorite = useCallback((serviceId) => {
    setFavorites((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    )
  }, [])

  const recordUsage = useCallback((serviceId) => {
    setCounts((prev) => ({ ...prev, [serviceId]: (prev[serviceId] || 0) + 1 }))
    setRecents((prev) => [
      { id: serviceId, at: Date.now() },
      ...prev.filter((r) => r.id !== serviceId),
    ].slice(0, MAX_RECENTS))
  }, [])

  return {
    favorites,
    recents,
    counts,
    isFavorite: (id) => favorites.includes(id),
    toggleFavorite,
    recordUsage,
  }
}
