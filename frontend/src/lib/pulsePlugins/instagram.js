import { registerPulsePlugin } from './registry'
import { openInstagramProfile } from '../openInstagram'

// Instagram — connection status only (no DM/notification access
// exists via the official API), shown as an informational card, not
// framed as "unread messages" since that data doesn't exist for
// Mattchat.
registerPulsePlugin({
  id: 'instagram',
  usesRemoteData: true,

  buildItems(raw) {
    const instagram = raw?.instagram
    if (!instagram?.connected) return []
    return [{
      id: 'instagram-status',
      app: 'instagram',
      sender: `@${instagram.username}`,
      title: 'Connected — view your profile and posts in Mattchat',
      count: 0,
      receivedAt: new Date().toISOString(),
      importance: 'low',
      isStatusOnly: true,
    }]
  },

  onOpen(item) {
    openInstagramProfile(item.sender?.replace('@', ''))
  },
})
