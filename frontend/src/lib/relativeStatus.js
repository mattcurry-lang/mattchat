import { differenceInMinutes, differenceInHours, isToday, isYesterday, format } from 'date-fns'

// status: 'sent' | 'delivered' | 'read'
export function formatLastActivity(timestamp, status) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const verb = status === 'read' ? 'Seen' : status === 'delivered' ? 'Delivered' : 'Sent'

  const mins = differenceInMinutes(new Date(), date)
  if (mins < 1) return `${verb} just now`
  if (mins < 60) return `${verb} ${mins}m ago`

  const hrs = differenceInHours(new Date(), date)
  if (isToday(date)) return `${verb} ${hrs}h ago`
  if (isYesterday(date)) return `${verb} yesterday`

  return `${verb} ${format(date, 'MMM d')}`
}
