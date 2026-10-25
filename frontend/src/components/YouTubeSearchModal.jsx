// src/components/YouTubeSearchModal.jsx
// "Search YouTube" from a chat. It now shows the SAME search as the Pulse YouTube page
// (thumbnails with a glow, a featured first result, loading skeletons, "Show more", recent
// searches, clear error/empty states, readable text on your dark background), so the two can
// never drift apart again. Props are unchanged: { session, onClose, onSelectVideo(videoId) }.
//
// Also fixed: the old pop-up used a bottom-sheet overlay class, so on a wide screen it hugged
// the bottom-left corner. It is now centred on desktop and a bottom sheet on phones.

import React, { useEffect } from 'react'
import YouTubePulsePage from './Pulse/YouTubePulsePage'
import { ensureYouTubeStyles } from './youtube/youtubeStyles'

ensureYouTubeStyles()

export default function YouTubeSearchModal({ session, onClose, onSelectVideo }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="mc-ytm-overlay" onClick={onClose} role="presentation">
      <div className="mc-ytm-panel" role="dialog" aria-modal="true" aria-label="Search YouTube" onClick={(e) => e.stopPropagation()}>
        <YouTubePulsePage
          modal
          session={session}
          userId={session?.user?.id}
          onSelectVideo={onSelectVideo}
          onClose={onClose}
          subtitle="Pick a video to share in this chat"
        />
      </div>
    </div>
  )
}
