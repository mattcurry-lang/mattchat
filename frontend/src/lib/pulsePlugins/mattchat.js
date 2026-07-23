import { registerPulsePlugin } from './registry'

// Mattchat's own unread conversations — always real, from the same
// data ChatPage already renders in the sidebar. Local data only, so
// this renders immediately without waiting on the pulse-data fetch
// (see usesRemoteData: false).
registerPulsePlugin({
  id: 'mattchat',
  usesRemoteData: false,

  buildItems(raw, ctx) {
    const { conversations, unreadCounts, getConvoName } = ctx
    const items = []
    ;(conversations || []).forEach((c) => {
      const unread = unreadCounts?.[c.id] || 0
      if (unread === 0) return
      items.push({
        id: `mattchat-${c.id}`,
        app: 'mattchat',
        sender: getConvoName ? getConvoName(c) : 'Mattchat',
        title: `${unread} unread message${unread > 1 ? 's' : ''}`,
        count: unread,
        receivedAt: c.updated_at,
        importance: unread >= 4 ? 'high' : 'medium',
        conversationId: c.id,
      })
    })
    return items
  },

  onOpen(item, ctx) {
    if (item.conversationId) ctx.onOpenConversation?.(item.conversationId)
  },
})
