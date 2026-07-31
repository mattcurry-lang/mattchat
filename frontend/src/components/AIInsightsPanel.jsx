import { useState, useEffect, useMemo, useCallback } from 'react'
import { callCurryAI } from './CurryAI'
import {
  IconX, IconSparkle, IconCheckSquare, IconClock, IconMessageSquare, IconMusic, IconFilm,
  IconBook, IconHeart, IconMail, IconChevronLeft, IconChevronRight, IconPin,
} from './Icons'

// ── Category → icon + accent color ─────────────────────────────
const CATEGORY_META = {
  overdue:    { icon: IconClock,         color: '#f87171', label: 'Overdue' },
  due_soon:   { icon: IconCheckSquare,   color: '#fbbf24', label: 'Due soon' },
  schedule:   { icon: IconClock,         color: '#a78bfa', label: "Today" },
  reconnect:  { icon: IconMessageSquare, color: '#60a5fa', label: 'Reconnect' },
  note:       { icon: IconSparkle,       color: '#c4b5fd', label: 'Noticed' },
  music:      { icon: IconMusic,         color: '#f472b6', label: 'Suggestion' },
  movie:      { icon: IconFilm,          color: '#f472b6', label: 'Suggestion' },
  book:       { icon: IconBook,          color: '#f472b6', label: 'Suggestion' },
  encouragement: { icon: IconHeart,      color: '#fb7185', label: 'For you' },
  email:      { icon: IconMail,          color: '#38bdf8', label: 'Email' },
}
const PRIORITY_ORDER = { critical: 0, important: 1, normal: 2, silent: 3 }

function todayKey() {
  return new Date().toISOString().split('T')[0]
}
function loadDismissed() {
  try {
    const raw = localStorage.getItem(`curry_insights_dismissed_${todayKey()}`)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}
function saveDismissed(set) {
  try { localStorage.setItem(`curry_insights_dismissed_${todayKey()}`, JSON.stringify([...set])) } catch {}
}
function loadToastShown() {
  try { return localStorage.getItem(`curry_insights_toast_${todayKey()}`) === '1' } catch { return false }
}
function markToastShown() {
  try { localStorage.setItem(`curry_insights_toast_${todayKey()}`, '1') } catch {}
}

// Turns the existing daily_insight payload into a flat list of
// discrete, actionable items — this is the normalization the master
// prompt's "feedback types" list assumes but the backend doesn't
// currently emit natively.
function deriveInsightItems(brief) {
  if (!brief) return []
  const items = []
  const academic = brief.academic || {}

  ;(academic.overdue || []).forEach((t) => {
    items.push({
      id: `overdue-${t.id}`, category: 'overdue', priority: 'critical', confidence: 98,
      title: `Overdue: ${t.title}`,
      explanation: `This was due ${t.due_date}. It's still marked open.`,
      action: { label: 'Open in Tasks', kind: 'tasks' },
    })
  })
  ;(academic.dueSoon || []).forEach((t) => {
    items.push({
      id: `duesoon-${t.id}`, category: 'due_soon', priority: 'important', confidence: 90,
      title: `Due soon: ${t.title}`,
      explanation: `Due ${t.due_date}${t.estimated_effort_minutes ? ` — estimated ${Math.round(t.estimated_effort_minutes / 60 * 10) / 10}h` : ''}.`,
      action: { label: 'Open in Tasks', kind: 'tasks' },
    })
  })
  if ((academic.schedule || []).length > 0) {
    items.push({
      id: 'schedule-today', category: 'schedule', priority: 'normal', confidence: 95,
      title: `${academic.schedule.length} session${academic.schedule.length > 1 ? 's' : ''} scheduled today`,
      explanation: academic.schedule.map((s) => `${s.ai_tasks?.title || 'Session'} at ${new Date(s.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`).join(' · '),
      action: { label: 'Open in Tasks', kind: 'tasks' },
    })
  }
  ;(brief.reconnect_nudges || []).forEach((n) => {
    items.push({
      id: `reconnect-${n.conversationId}`, category: 'reconnect', priority: 'normal', confidence: 72,
      title: `You usually talk to ${n.username} more often`,
      explanation: `It's been ${n.daysSince} days — usually about ${n.usualGapDays}.`,
      action: { label: 'Open chat', kind: 'conversation', conversationId: n.conversationId },
    })
  })
  ;(brief.insights || []).forEach((ins, i) => {
    if (!ins.text) return
    items.push({
      id: `note-${i}`, category: 'note', priority: 'normal', confidence: 75,
      title: ins.text, explanation: '',
      action: ins.action ? { label: ins.action, kind: 'curry' } : null,
    })
  })
  if (brief.suggestion?.type && brief.suggestion.type !== 'none' && brief.suggestion.title) {
    items.push({
      id: 'suggestion', category: brief.suggestion.type, priority: 'silent', confidence: 60,
      title: brief.suggestion.title, explanation: brief.suggestion.reason || '',
      action: null,
    })
  }

  return items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

function InsightCard({ item, onDismiss, onAct, onRemindLater }) {
  const meta = CATEGORY_META[item.category] || CATEGORY_META.note
  const Icon = meta.icon
  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <div style={{ ...s.catBadge, background: `${meta.color}22`, borderColor: `${meta.color}55`, color: meta.color }}>
          <Icon size={12} /> {meta.label}
        </div>
        <div style={s.confidence} title="Estimated relevance">{item.confidence}%</div>
      </div>
      <div style={s.cardTitle}>{item.title}</div>
      {item.explanation && <div style={s.cardExplain}>{item.explanation}</div>}
      <div style={s.cardActions}>
        {item.action && (
          <button style={s.actionBtn} onClick={() => onAct(item)}>{item.action.label}</button>
        )}
        <button style={s.laterBtn} onClick={() => onRemindLater(item)}>Remind me later</button>
        <button style={s.dismissBtn} onClick={() => onDismiss(item)} title="Dismiss">
          <IconX size={13} />
        </button>
      </div>
    </div>
  )
}

export default function AIInsightsPanel({ session, onOpenCurry, onOpenTasks, onOpenConversation, onAskCurry }) {
  const [brief, setBrief] = useState(null)
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [docked, setDocked] = useState(false)
  const [index, setIndex] = useState(0)
  const [dismissed, setDismissed] = useState(loadDismissed)
  const [snoozed, setSnoozed] = useState(() => new Set())
  const [showCriticalToast, setShowCriticalToast] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await callCurryAI('daily_insight', {}, session)
        if (!cancelled && data.ok) setBrief(data.insight)
      } catch (e) { console.error('AIInsightsPanel: daily_insight failed', e) }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [session])

  useEffect(() => {
    if (!navigator.geolocation) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const data = await callCurryAI('weather', { lat: latitude, lon: longitude }, session)
          if (!cancelled && data.ok) setWeather(data.weather)
        } catch (e) { console.error('AIInsightsPanel: weather failed', e) }
      },
      () => {}, { timeout: 8000, maximumAge: 10 * 60000 }
    )
    return () => { cancelled = true }
  }, [session])

  const allItems = useMemo(() => deriveInsightItems(brief), [brief])
  const visibleItems = useMemo(
    () => allItems.filter((i) => !dismissed.has(i.id) && !snoozed.has(i.id)),
    [allItems, dismissed, snoozed]
  )
  const criticalCount = visibleItems.filter((i) => i.priority === 'critical').length

  // Critical items get a one-time toast — appears on its own, never
  // force-expands the full panel. Everything else waits until the
  // user opens it themselves.
  useEffect(() => {
    if (criticalCount > 0 && !loadToastShown() && !expanded) {
      setShowCriticalToast(true)
      markToastShown()
      const t = setTimeout(() => setShowCriticalToast(false), 9000)
      return () => clearTimeout(t)
    }
  }, [criticalCount, expanded])

  useEffect(() => { if (index >= visibleItems.length) setIndex(Math.max(0, visibleItems.length - 1)) }, [visibleItems, index])

  const dismissItem = useCallback((item) => {
    setDismissed((prev) => { const next = new Set(prev); next.add(item.id); saveDismissed(next); return next })
  }, [])
  const snoozeItem = useCallback((item) => {
    setSnoozed((prev) => { const next = new Set(prev); next.add(item.id); return next })
  }, [])
  const actOnItem = useCallback((item) => {
    if (item.action?.kind === 'tasks') onOpenTasks?.()
    else if (item.action?.kind === 'conversation') onOpenConversation?.(item.action.conversationId)
    else if (item.action?.kind === 'curry') onAskCurry?.(item.title)
    dismissItem(item)
  }, [onOpenTasks, onOpenConversation, onAskCurry, dismissItem])

  const now = new Date()
  const timeLabel = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const current = visibleItems[index]
  const hasUnread = visibleItems.length > 0

  return (
    <>
      <style>{PANEL_CSS}</style>

      {/* ── Critical one-time toast ── */}
      {showCriticalToast && !expanded && (
        <div style={{ ...s.toast, ...(docked ? s.toastDocked : s.toastFloating) }} onClick={() => { setExpanded(true); setShowCriticalToast(false) }}>
          <div style={s.toastGlow} />
          <IconSparkle size={14} style={{ color: '#f87171' }} />
          <span style={s.toastText}>{criticalCount} thing{criticalCount > 1 ? 's' : ''} need attention</span>
          <button style={s.toastClose} onClick={(e) => { e.stopPropagation(); setShowCriticalToast(false) }}><IconX size={12} /></button>
        </div>
      )}

      {/* ── Collapsed pill ── */}
      {!expanded && (
        <button
          style={{ ...s.pill, ...(docked ? s.pillDocked : s.pillFloating) }}
          onClick={() => setExpanded(true)}
          title="Curry Insights"
        >
          <span className="curry-pill-glow" />
          <div style={s.pillAvatar}><IconSparkle size={15} style={{ color: '#fff' }} /></div>
          {hasUnread && <span style={{ ...s.pillBadge, background: criticalCount > 0 ? '#f87171' : '#a78bfa' }}>{visibleItems.length}</span>}
        </button>
      )}

      {/* ── Full panel ── */}
      {expanded && (
        <div style={{ ...s.panel, ...(docked ? s.panelDocked : s.panelFloating) }} className="curry-panel-border">
          <div className="curry-particles">
            {Array.from({ length: 6 }).map((_, i) => <span key={i} className={`curry-particle p${i}`} />)}
          </div>

          <div style={s.header}>
            <div style={s.headerLeft}>
              <div style={s.avatarLg}><IconSparkle size={16} style={{ color: '#fff' }} /></div>
              <div>
                <div style={s.headerTitle}>Curry Insights</div>
                <div style={s.headerSub}>{timeLabel}{weather ? ` · ${weather.tempC}°C` : ''}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button style={s.iconBtn} onClick={() => setDocked((v) => !v)} title={docked ? 'Float' : 'Dock to side'}>
                {docked ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
              </button>
              <button style={s.iconBtn} onClick={() => setExpanded(false)} title="Minimize"><IconX size={14} /></button>
            </div>
          </div>

          {brief?.mood_summary && (
            <div style={s.moodLine}>{brief.mood_summary}</div>
          )}

          <div style={s.body}>
            {loading && <div style={s.emptyState}>Curry is thinking…</div>}

            {!loading && visibleItems.length === 0 && (
              <div style={s.emptyState}>
                <IconSparkle size={18} style={{ color: '#6b7280', marginBottom: 6 }} />
                Nothing needs your attention right now.
              </div>
            )}

            {!loading && current && (
              <>
                <InsightCard item={current} onDismiss={dismissItem} onAct={actOnItem} onRemindLater={snoozeItem} />
                {visibleItems.length > 1 && (
                  <div style={s.pager}>
                    <button style={s.pagerBtn} disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                      <IconChevronLeft size={13} />
                    </button>
                    <span style={s.pagerLabel}>{index + 1} / {visibleItems.length}</span>
                    <button style={s.pagerBtn} disabled={index === visibleItems.length - 1} onClick={() => setIndex((i) => Math.min(visibleItems.length - 1, i + 1))}>
                      <IconChevronRight size={13} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {brief?.question && (
            <button style={s.questionBtn} onClick={() => { onAskCurry?.(brief.question); onOpenCurry?.() }}>
              {brief.question} →
            </button>
          )}
        </div>
      )}
    </>
  )
}

const PANEL_CSS = `
@keyframes curryBorderGlow {
  0%, 100% { box-shadow: 0 0 22px rgba(167,139,250,0.35), 0 0 44px rgba(96,165,250,0.15); }
  50% { box-shadow: 0 0 32px rgba(167,139,250,0.55), 0 0 64px rgba(96,165,250,0.28); }
}
@keyframes curryPulse {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.08); }
}
@keyframes curryFloat {
  0% { transform: translateY(0) translateX(0); opacity: 0; }
  15% { opacity: 0.7; }
  85% { opacity: 0.5; }
  100% { transform: translateY(-60px) translateX(6px); opacity: 0; }
}
@keyframes curryPanelIn {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.curry-panel-border {
  animation: curryPanelIn 0.28s cubic-bezier(0.34,1.56,0.64,1), curryBorderGlow 3.5s ease-in-out infinite;
}
.curry-pill-glow {
  position: absolute; inset: -4px; border-radius: 999px;
  background: radial-gradient(circle, rgba(167,139,250,0.45), transparent 70%);
  animation: curryPulse 2.4s ease-in-out infinite;
  pointer-events: none;
}
.curry-particles { position: absolute; inset: 0; overflow: hidden; pointer-events: none; border-radius: inherit; }
.curry-particle {
  position: absolute; width: 3px; height: 3px; border-radius: 50%;
  background: rgba(167,139,250,0.6); bottom: 10%;
  animation: curryFloat 6s ease-in infinite;
}
.p0 { left: 12%; animation-delay: 0s; }
.p1 { left: 28%; animation-delay: 1.1s; background: rgba(96,165,250,0.6); }
.p2 { left: 46%; animation-delay: 2.2s; }
.p3 { left: 63%; animation-delay: 0.6s; background: rgba(96,165,250,0.6); }
.p4 { left: 79%; animation-delay: 3.1s; }
.p5 { left: 91%; animation-delay: 1.8s; background: rgba(96,165,250,0.6); }
`

const s = {
  pill: {
    position: 'fixed', zIndex: 500, width: 46, height: 46, borderRadius: '50%',
    background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(102,126,234,0.4)',
  },
  pillFloating: { bottom: 90, right: 20 },
  pillDocked: { top: 16, left: 16 },
  pillAvatar: { position: 'relative', zIndex: 1, display: 'flex' },
  pillBadge: {
    position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 999,
    color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 4px', border: '2px solid #0f0f1a',
  },

  toast: {
    position: 'fixed', zIndex: 499, display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(20,20,31,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(248,113,113,0.35)', borderRadius: 14, padding: '10px 12px',
    cursor: 'pointer', maxWidth: 260, animation: 'curryPanelIn 0.3s ease',
  },
  toastFloating: { bottom: 146, right: 20 },
  toastDocked: { top: 70, left: 16 },
  toastGlow: {
    position: 'absolute', inset: -1, borderRadius: 14, pointerEvents: 'none',
    boxShadow: '0 0 18px rgba(248,113,113,0.35)',
  },
  toastText: { fontSize: 12.5, fontWeight: 600, color: '#e5e7eb', flex: 1 },
  toastClose: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', flexShrink: 0 },

  panel: {
    position: 'fixed', zIndex: 500, width: 320, maxHeight: '70vh',
    background: 'linear-gradient(160deg, rgba(24,22,38,0.85), rgba(30,24,48,0.85))',
    backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
    border: '1px solid rgba(167,139,250,0.25)', borderRadius: 22,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  panelFloating: { bottom: 90, right: 20 },
  panelDocked: { top: 16, left: 16, bottom: 16, maxHeight: 'none' },

  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', position: 'relative', zIndex: 1 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  avatarLg: {
    width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(102,126,234,0.5)', flexShrink: 0,
  },
  headerTitle: { fontSize: 13.5, fontWeight: 800, color: '#f1f0f7' },
  headerSub: { fontSize: 11, color: '#9d97b5', marginTop: 1 },
  iconBtn: {
    width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: '#c4b5fd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  moodLine: { fontSize: 12, color: '#b9b3cf', padding: '0 16px 10px', lineHeight: 1.4, position: 'relative', zIndex: 1 },

  body: { flex: 1, overflowY: 'auto', padding: '0 14px 14px', position: 'relative', zIndex: 1 },
  emptyState: { textAlign: 'center', color: '#8b859f', fontSize: 12.5, padding: '28px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center' },

  card: {
    background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
    padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 8,
  },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  catBadge: {
    display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700,
    border: '1px solid', borderRadius: 999, padding: '3px 8px',
  },
  confidence: { fontSize: 10.5, fontWeight: 700, color: '#8b859f' },
  cardTitle: { fontSize: 13.5, fontWeight: 700, color: '#f1f0f7', lineHeight: 1.4 },
  cardExplain: { fontSize: 12, color: '#a8a2bd', lineHeight: 1.5 },
  cardActions: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  actionBtn: {
    background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 10,
    color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit',
  },
  laterBtn: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    color: '#c9c4dc', fontSize: 11.5, fontWeight: 600, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit',
  },
  dismissBtn: {
    marginLeft: 'auto', background: 'none', border: 'none', color: '#7a7490', cursor: 'pointer',
    display: 'flex', padding: 4,
  },

  pager: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  pagerBtn: {
    width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: '#c4b5fd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  pagerLabel: { fontSize: 11, color: '#8b859f', fontWeight: 600 },

  questionBtn: {
    margin: '0 14px 14px', textAlign: 'left', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)',
    borderRadius: 12, color: '#c4b5fd', fontSize: 12, fontWeight: 600, padding: '10px 12px', cursor: 'pointer',
    fontFamily: 'inherit', lineHeight: 1.4, position: 'relative', zIndex: 1,
  },
}
