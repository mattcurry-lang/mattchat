// Shared helpers + styles for the schedule-message UI.
// Everything here works in the user's LOCAL time zone.

export const MIN_LEAD_MS = 5 * 60 * 1000 // at least 5 minutes ahead
export const MAX_DAYS = 365              // up to a year ahead

const pad = (n) => String(n).padStart(2, '0')

export const toLocalDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const toLocalTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

// 'YYYY-MM-DD' + 'HH:MM' (local) -> Date, or null if incomplete/invalid
export function parseLocalDateTime(date, time) {
  if (!date || !time) return null
  const [y, mo, da] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  if ([y, mo, da, h, mi].some((n) => Number.isNaN(n))) return null
  const d = new Date(y, mo - 1, da, h, mi, 0, 0)
  if (Number.isNaN(d.getTime()) || d.getMonth() !== mo - 1) return null // e.g. Feb 31
  return d
}

export const formatTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function dayLabel(d, now = new Date()) {
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(d) - startOf(now)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  const opts = diffDays > 1 && diffDays < 7 ? { weekday: 'long' } : { weekday: 'short', month: 'short', day: 'numeric' }
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric'
  return d.toLocaleDateString([], opts)
}

export const formatWhen = (d, now = new Date()) => `${dayLabel(d, now)}, ${formatTime(d)}`

export function relativeUntil(d, now = Date.now()) {
  const diff = d.getTime() - now
  if (diff <= 0) return 'sending…'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'in under a minute'
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `in ${days}d ${hours % 24}h`
  if (hours > 0) return `in ${hours}h ${mins % 60}m`
  return `in ${mins}m`
}

// Quick picks that always make sense for the current time of day.
export function buildPresets(now = new Date()) {
  const at = (h, m = 0, addDays = 0) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + addDays, h, m, 0, 0)
  const minStart = now.getTime() + MIN_LEAD_MS

  const list = []
  list.push({ id: 'hour', label: 'In 1 hour', date: new Date(Math.ceil((now.getTime() + 3600000) / 300000) * 300000) })

  const evening = at(18)
  list.push(
    evening.getTime() - now.getTime() >= 30 * 60000
      ? { id: 'evening', label: 'This evening', date: evening }
      : { id: 'evening', label: 'Tomorrow evening', date: at(18, 0, 1) }
  )

  list.push({ id: 'morning', label: 'Tomorrow morning', date: at(9, 0, 1) })

  const daysToMonday = ((1 - now.getDay() + 7) % 7) || 7
  list.push({ id: 'monday', label: 'Next Monday', date: at(9, 0, daysToMonday) })

  const seen = new Set()
  return list.filter((p) => {
    const t = p.date.getTime()
    if (t < minStart || seen.has(t)) return false
    seen.add(t)
    return true
  })
}

export function localTimeZone() {
  try { return (Intl.DateTimeFormat().resolvedOptions().timeZone || '').replace(/_/g, ' ') } catch { return '' }
}

// Remember the last custom time-of-day the person picked.
const LAST_KEY = 'mattchat:lastScheduleTime'
export function getLastScheduleTime() {
  try { return localStorage.getItem(LAST_KEY) || '' } catch { return '' }
}
export function saveLastScheduleTime(t) {
  try { localStorage.setItem(LAST_KEY, t) } catch { /* ignore */ }
}

const SCHEDULE_CSS = 
  .sch-overlay { position:fixed; inset:0; z-index:3000; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(8,8,16,.6); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); animation:schFade .18s ease; }
  .sch-sheet { position:relative; width:100%; max-width:440px; max-height:calc(100vh - 32px); max-height:calc(100dvh - 32px); overflow-y:auto; box-sizing:border-box; padding:18px; border-radius:22px; background:var(--bg-surface-1,#14141f); color:var(--text-primary,#f2f0f8); border:1px solid var(--border,rgba(167,139,250,.18)); box-shadow:0 24px 64px rgba(0,0,0,.45); animation:schPop .2s cubic-bezier(.22,1,.36,1); }
  @media (max-width:640px) {
    .sch-overlay { align-items:flex-end; padding:0; }
    .sch-sheet { max-width:none; max-height:92vh; max-height:92dvh; border-radius:22px 22px 0 0; padding-bottom:max(18px, env(safe-area-inset-bottom)); animation:schSlide .26s cubic-bezier(.22,1,.36,1); }
  }
  @keyframes schFade { from { opacity:0; } to { opacity:1; } }
  @keyframes schPop { from { opacity:0; transform:translateY(8px) scale(.98); } to { opacity:1; transform:none; } }
  @keyframes schSlide { from { transform:translateY(100%); } to { transform:none; } }
  @keyframes schShimmer { 0% { opacity:.5; } 50% { opacity:1; } 100% { opacity:.5; } }
  @keyframes schCheck { from { transform:scale(.4); opacity:0; } to { transform:scale(1); opacity:1; } }

  .sch-head { display:flex; align-items:flex-start; gap:12px; margin-bottom:14px; }
