// src/lib/openInstagram.js
//
// Mattchat never performs Instagram-owned actions (like, comment, follow,
// message, save, share) itself — every one of those routes back to
// Instagram. This tries the native app deep link first (instagram://),
// and falls back to the web URL if the app isn't installed or the deep
// link fails to take focus within a short window. Same pattern as most
// "open in app" links: fire the custom scheme, and if the page is still
// visible after a beat, the app wasn't there, so fall back to https.

function tryOpen(appUrl, webUrl) {
  const fallbackTimer = setTimeout(() => {
    window.location.href = webUrl
  }, 900)

  const onVisibilityChange = () => {
    if (document.hidden) {
      clearTimeout(fallbackTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  window.location.href = appUrl
}

export function openInstagramProfile(username) {
  if (!username) return
  tryOpen(`instagram://user?username=${encodeURIComponent(username)}`, `https://instagram.com/${username}`)
}

export function openInstagramPost(permalinkOrId) {
  if (!permalinkOrId) return
  // permalink is already a full instagram.com URL when we have it from
  // the Graph API — the app deep link format is instagram://media?id=
  // which requires the numeric media id, not the shortcode, so when we
  // only have the permalink we just open that directly (it redirects
  // into the app automatically on mobile if installed).
  if (permalinkOrId.startsWith('http')) {
    window.location.href = permalinkOrId
    return
  }
  tryOpen(`instagram://media?id=${permalinkOrId}`, `https://instagram.com/p/${permalinkOrId}`)
}

export function openInstagramDirect(username) {
  if (!username) return
  tryOpen('instagram://direct/inbox', `https://instagram.com/direct/inbox`)
}

// action: 'like' | 'comment' | 'follow' | 'message' | 'save' | 'share'
export function routeInstagramAction(action, target, onOpening) {
  onOpening?.('Opening Instagram to complete this action.')
  if (action === 'message') {
    openInstagramDirect(target?.username)
  } else if (action === 'follow') {
    openInstagramProfile(target?.username)
  } else {
    openInstagramPost(target?.permalink || target?.id)
  }
}
