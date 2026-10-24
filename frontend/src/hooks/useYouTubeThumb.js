// src/hooks/useYouTubeThumb.js
// Instant picture first, sharper picture when it exists.
//   1. src starts as hqdefault (exists for every video) so the card never waits.
//   2. In the background we try maxresdefault, then sddefault. A candidate is used
//      only if it loads AND is a real image (not YouTube's 120x90 "missing" stand-in).
//   3. If none qualify, nothing changes and nothing flickers.

import { useEffect, useState } from 'react'
import { baseThumbUrl, thumbUrl, isRealThumb, isValidVideoId, UPGRADE_QUALITIES } from '../lib/youtubeThumb'

function probe(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') return resolve(false)
    const img = new Image()
    const timer = setTimeout(() => { img.onload = img.onerror = null; resolve(false) }, timeoutMs)
    img.onload = () => { clearTimeout(timer); resolve(isRealThumb(img)) }
    img.onerror = () => { clearTimeout(timer); resolve(false) }
    img.src = url
  })
}

export function useYouTubeThumb(videoId, { upgrade = true } = {}) {
  const valid = isValidVideoId(videoId)
  const [state, setState] = useState({ src: valid ? baseThumbUrl(videoId) : '', hd: false })

  useEffect(() => {
    setState({ src: valid ? baseThumbUrl(videoId) : '', hd: false })
    if (!valid || !upgrade) return undefined
    let cancelled = false
    ;(async () => {
      for (const q of UPGRADE_QUALITIES) {
        const url = thumbUrl(videoId, q)
        const ok = await probe(url)
        if (cancelled) return
        if (ok) { setState({ src: url, hd: q === 'maxresdefault' }); return }
      }
    })()
    return () => { cancelled = true }
  }, [videoId, valid, upgrade])

  return state
}
