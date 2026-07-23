import { registerPulsePlugin } from './registry'

// Google Calendar — upcoming events per connected account, from the
// pulse-data edge function's `googleCalendar` key. Mirrors gmail.js:
// one item per account with something upcoming, plus a distinct error
// item per account that needs reconnecting.
registerPulsePlugin({
  id: 'google_calendar',
  usesRemoteData: true,
  buildItems(raw) {
    const cal = raw?.googleCalendar
    if (!cal?.connected) return []

    const items = []
    cal.accounts.forEach((acc) => {
      if (acc.error) {
        items.push({
          id: `google_calendar-error-${acc.email}`,
          app: 'google_calendar',
          sender: acc.email,
          title: acc.error === 'token_expired' ? 'Reconnect needed' : "Couldn't check Calendar",
          count: 0,
          receivedAt: new Date().toISOString(),
          importance: 'low',
          error: true,
        })
        return
      }

      const upcomingCount = acc.upcomingEvents?.length || 0
      if (upcomingCount > 0) {
        const next = acc.upcomingEvents[0]
        items.push({
          id: `google_calendar-${acc.email}`,
          app: 'google_calendar',
          sender: acc.email,
          title: upcomingCount === 1
            ? `${next.summary || 'Untitled event'}`
            : `${upcomingCount} upcoming events`,
          count: upcomingCount,
          receivedAt: next.start || new Date().toISOString(),
          importance: isStartingSoon(next.start) ? 'high' : 'medium',
          eventUrl: next.htmlLink,
        })
      }
    })
    return items
  },
  onOpen(item) {
    window.open(item?.eventUrl || 'https://calendar.google.com', '_blank')
  },
})

// "high" importance when the next event starts within an hour — same
// spirit as gmail.js flagging 5+ unread as high, just a different
// signal for a different data type.
function isStartingSoon(startIso) {
  if (!startIso) return false
  const diffMs = new Date(startIso).getTime() - Date.now()
  return diffMs > 0 && diffMs < 60 * 60 * 1000
}
