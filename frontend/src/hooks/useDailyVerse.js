import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const VERSE_CACHE_KEY = 'pulse_bible_verse_cache'

export function useDailyVerse() {
  const [verse, setVerse] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const today = new Date().toISOString().slice(0, 10)

    const load = async () => {
      try {
        const cached = JSON.parse(sessionStorage.getItem(VERSE_CACHE_KEY) || 'null')
        if (cached?.date === today) { if (!cancelled) { setVerse(cached.verse); setLoading(false) }; return }
      } catch {}

      const { data, error } = await supabase.functions.invoke('pulse-bible')
      if (cancelled) return
      if (error || !data?.ok) { setVerse(null); setLoading(false); return }

     const v = { reference: data.reference, text: data.verse_text, fullText: data.full_text, version: data.version }
      try { sessionStorage.setItem(VERSE_CACHE_KEY, JSON.stringify({ date: today, verse: v })) } catch {}
      setVerse(v)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { verse, loading }
}
