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

const SCHEDULE_CSS = `
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
  .sch-head-icon { width:36px; height:36px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:rgba(167,139,250,.14); color:#a78bfa; }
  .sch-title { font-size:16px; font-weight:800; letter-spacing:-.01em; display:flex; align-items:center; gap:8px; }
  .sch-sub { font-size:12px; color:var(--text-muted,#9d97b5); margin-top:2px; }
  .sch-count { font-size:11px; font-weight:800; padding:1px 8px; border-radius:999px; color:#c4b5fd; background:rgba(167,139,250,.16); }
  .sch-x { margin-left:auto; width:32px; height:32px; border-radius:50%; border:none; background:transparent; color:var(--text-muted,#9d97b5); display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
  .sch-x:hover { background:var(--bg-surface-2,rgba(255,255,255,.07)); color:var(--text-primary,#fff); }

  .sch-textarea, .sch-input { width:100%; box-sizing:border-box; padding:11px 14px; border-radius:14px; background:var(--bg-surface-2,rgba(255,255,255,.05)); border:1px solid var(--border,rgba(255,255,255,.1)); color:inherit; font:inherit; font-size:14.5px; line-height:1.5; outline:none; transition:border-color .15s, box-shadow .15s; }
  .sch-textarea { resize:none; }
  .sch-input { padding:10px 12px; }
  .sch-textarea:focus, .sch-input:focus { border-color:rgba(167,139,250,.6); box-shadow:0 0 0 4px rgba(167,139,250,.12); }
  .sch-label { display:block; margin:16px 2px 8px; font-size:10.5px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--text-muted,#9d97b5); }

  .sch-presets { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .sch-preset { display:flex; flex-direction:column; align-items:flex-start; gap:3px; padding:11px 12px; border-radius:14px; text-align:left; cursor:pointer; font:inherit; color:inherit; background:var(--bg-surface-2,rgba(255,255,255,.05)); border:1px solid var(--border,rgba(255,255,255,.1)); transition:border-color .15s, background .15s, transform .1s; }
  .sch-preset:hover { border-color:rgba(167,139,250,.45); }
  .sch-preset:active { transform:scale(.98); }
  .sch-preset.on { border-color:#8b7cf6; background:rgba(139,124,246,.16); box-shadow:0 0 0 3px rgba(139,124,246,.14); }
  .sch-preset.wide { grid-column:span 2; flex-direction:row; align-items:center; gap:8px; }
  .sch-preset-label { font-size:13.5px; font-weight:700; }
  .sch-preset-time { font-size:11.5px; color:var(--text-muted,#9d97b5); }

  .sch-fields { display:flex; gap:10px; margin-top:10px; }
  .sch-field { flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; }
  .sch-field > span { font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--text-muted,#9d97b5); }
  .sch-tz { margin-top:10px; font-size:11.5px; color:var(--text-muted,#9d97b5); }
  .sch-preview { margin-top:14px; padding:10px 12px; border-radius:12px; font-size:13px; background:rgba(167,139,250,.1); border:1px solid rgba(167,139,250,.25); }
  .sch-preview strong { color:#c4b5fd; }
  .sch-error { margin-top:12px; padding:9px 12px; border-radius:10px; font-size:12.5px; color:#fca5a5; background:rgba(248,113,113,.09); border:1px solid rgba(248,113,113,.28); }

  .sch-actions { display:flex; gap:8px; margin-top:16px; }
  .sch-btn { flex:1; padding:12px; border:none; border-radius:14px; color:#fff; font:inherit; font-size:14px; font-weight:800; cursor:pointer; background:linear-gradient(135deg,#667eea,#764ba2); box-shadow:0 8px 20px rgba(118,75,162,.35); transition:opacity .15s, transform .1s; }
  .sch-btn:disabled { opacity:.45; cursor:default; box-shadow:none; }
  .sch-btn:not(:disabled):active { transform:scale(.98); }
  .sch-btn-ghost { padding:12px 16px; border-radius:14px; font:inherit; font-size:14px; font-weight:700; cursor:pointer; color:var(--text-secondary,#c9c4dd); background:transparent; border:1px solid var(--border,rgba(255,255,255,.12)); }
  .sch-hint { margin-top:10px; text-align:center; font-size:11px; color:var(--text-muted,#9d97b5); }

  .sch-done { display:flex; flex-direction:column; align-items:center; text-align:center; padding:18px 4px 6px; gap:6px; }
  .sch-done-check { width:56px; height:56px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; background:linear-gradient(135deg,#34d399,#10b981); box-shadow:0 10px 28px rgba(16,185,129,.4); animation:schCheck .35s cubic-bezier(.22,1,.36,1); }
  .sch-done-title { margin-top:10px; font-size:18px; font-weight:800; }
  .sch-done-sub { font-size:13.5px; color:var(--text-secondary,#c9c4dd); margin-bottom:12px; }

  .sch-day { margin:16px 2px 8px; font-size:10.5px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--text-muted,#9d97b5); }
  .sch-day:first-of-type { margin-top:4px; }
  .sch-item { padding:12px 14px; border-radius:16px; margin-bottom:8px; background:var(--bg-surface-2,rgba(255,255,255,.05)); border:1px solid var(--border,rgba(255,255,255,.1)); }
  .sch-item-text { font-size:14px; line-height:1.5; white-space:pre-wrap; word-break:break-word; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
  .sch-item-meta { display:flex; align-items:center; gap:10px; margin-top:8px; font-size:12px; color:var(--text-muted,#9d97b5); }
  .sch-item-time { display:inline-flex; align-items:center; gap:5px; color:#c4b5fd; font-weight:700; }
  .sch-item-actions { display:flex; align-items:center; gap:4px; margin:10px -6px -4px; flex-wrap:wrap; }
  .sch-link { padding:6px 10px; border:none; border-radius:8px; background:transparent; font:inherit; font-size:12.5px; font-weight:700; cursor:pointer; color:var(--text-secondary,#c9c4dd); }
  .sch-link:hover:not(:disabled) { background:rgba(167,139,250,.12); color:#c4b5fd; }
  .sch-link.danger:hover:not(:disabled) { background:rgba(248,113,113,.12); color:#f87171; }
  .sch-link.strong { color:#c4b5fd; }
  .sch-link:disabled { opacity:.5; cursor:default; }
  .sch-ask { font-size:12.5px; font-weight:700; margin-right:4px; padding-left:6px; }
  .sch-edit { display:flex; flex-direction:column; gap:10px; }
  .sch-empty { text-align:center; padding:28px 12px 10px; color:var(--text-secondary,#c9c4dd); }
  .sch-empty-icon { width:48px; height:48px; border-radius:16px; margin:0 auto 12px; display:flex; align-items:center; justify-content:center; color:#a78bfa; background:rgba(167,139,250,.12); }
  .sch-empty-title { font-size:15px; font-weight:800; color:var(--text-primary,#f2f0f8); }
  .sch-empty-sub { font-size:12.5px; margin-top:4px; line-height:1.5; color:var(--text-muted,#9d97b5); }
  .sch-skel { height:78px; border-radius:16px; margin-bottom:8px; background:var(--bg-surface-2,rgba(255,255,255,.06)); animation:schShimmer 1.4s ease infinite; }
  .sch-toast { position:sticky; bottom:0; margin-top:10px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; border-radius:14px; font-size:13px; font-weight:600; color:#fff; background:#2a2840; border:1px solid rgba(167,139,250,.3); box-shadow:0 10px 28px rgba(0,0,0,.4); }
  .sch-toast button { background:none; border:none; color:#c4b5fd; font:inherit; font-weight:800; cursor:pointer; }

  .sch-x:focus-visible, .sch-preset:focus-visible, .sch-btn:focus-visible, .sch-btn-ghost:focus-visible, .sch-link:focus-visible, .sch-toast button:focus-visible { outline:2px solid #a78bfa; outline-offset:2px; }
  @media (prefers-reduced-motion: reduce) {
    .sch-overlay, .sch-sheet, .sch-done-check, .sch-skel { animation:none; }
    .sch-preset, .sch-btn { transition:none; }
  }
`

export function ensureScheduleStyles() {
  if (typeof document === 'undefined' || document.getElementById('schedule-styles')) return
  const el = document.createElement('style')
  el.id = 'schedule-styles'
  el.textContent = SCHEDULE_CSS
  document.head.appendChild(el)
}
