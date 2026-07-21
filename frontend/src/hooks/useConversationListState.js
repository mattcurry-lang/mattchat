import { useMemo } from 'react'

/**
 * useConversationListState
 * Merges conversations + unread counts + typing + presence into one
 * per-conversation view model, so the sidebar row doesn't have to
 * juggle four separate maps inline.
 */
export function useConversationListState({
  conversations,
  unreadCounts,
  typingMap,
  isOnline,
  getLastSeenLabel,
  getOtherUserId,
  currentUserId,
  openConvoId,
}) {
  return useMemo(() => {
    const map = {}
    conversations.forEach(c => {
      const otherId = getOtherUserId(c, currentUserId)
      const unread = unreadCounts[c.id] || 0
      const typingUserId = typingMap[c.id]
      // Suppress the list "typing…" for whichever chat is currently open —
      // that conversation already shows typing inline via useChat's `typing`.
      const isTyping = !!typingUserId && c.id !== openConvoId

      map[c.id] = {
        conversation: c,
        lastMessage: c.last_message,
        timestamp: c.updated_at,
        unreadMessageCount: unread,
        typingUser: isTyping ? typingUserId : null,
        isTyping,
        onlineStatus: otherId ? isOnline(otherId) : false,
        lastSeen: otherId ? getLastSeenLabel(otherId) : null,
        previewKind: isTyping ? 'typing' : unread > 1 ? 'unread_count' : 'message',
      }
    })
    return map
  }, [conversations, unreadCounts, typingMap, isOnline, getLastSeenLabel, getOtherUserId, currentUserId, openConvoId])
}
