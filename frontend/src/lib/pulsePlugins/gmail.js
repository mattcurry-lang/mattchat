import { registerPulsePlugin } from './registry'

// Gmail — real unread counts per connected account, from the
// pulse-data edge function's `gmail` key.
registerPulsePlugin({
  id: 'gmail',
  usesRemoteData: true,

  buildItems(raw) {
    const gmail = raw?.gmail
    if (!gmail?.connected) return []

    const items = []
    gmail.accounts.forEach((acc) => {
      if (acc.error) {
        items.push({
          id: `gmail-error-${acc.email}`,
          app: 'gmail',
          sender: acc.email,
          title: acc.error === 'token_expired' ? 'Reconnect needed' : "Couldn't check inbox",
          count: 0,
          receivedAt: new Date().toISOString(),
          importance: 'low',
          error: true,
        })
        return
      }
      if (acc.unreadCount > 0) {
        items.push({
          id: `gmail-${acc.email}`,
          app: 'gmail',
          sender: acc.email,
          title: `${acc.unreadCount} unread email${acc.unreadCount > 1 ? 's' : ''}`,
          count: acc.unreadCount,
          receivedAt: new Date().toISOString(),
          importance: acc.unreadCount >= 5 ? 'high' : 'medium',
        })
      }
    })
    return items
  },

  onOpen() {
    window.open('https://mail.google.com', '_blank')
  },
})
