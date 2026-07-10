import { useState, useEffect } from 'react'
import { callCurryAI } from './CurryAI'

// Promoted version of the Daily Brief — meant to sit at the TOP of the
// home screen (above the story rail), not buried inside the Curry
// chat panel. Same data source (daily_insight), bigger presence
//
// Collapses to a slim one-liner once dismissed for the session so it
// doesn't nag every time the user reopens the app tab.
const MOOD_EMOJI = {
  positive: '😊', excited: '🤩', neutral: '🙂',
  stressed: '😮\u200d💨', anxious: '😟', sad: '😔', negative: '😕',
}
const SUGGESTION_EMOJI = { music: '🎵', movie: '🎬', book: '📖', encouragement: '💜', none: '' }

// Weather is intentionally kept separate from the cached daily insight —
// weather changes hour to hour, but the brief itself is cached once per
// day server-side. This is its own lightweight, always-fresh call.
function weatherEmoji(description = '') {
  const d = description.toLowerCase()
  if (d.includes('thunder')) return '⛈️'
  if (d.includes('snow')) return '❄️'
  if (d.includes('drizzle') || d.includes('rain') || d.includes('shower')) return '🌧️'
  if (d.includes('fog')) return '🌫️'
  if (d.includes('overcast')) return '☁️'
  if (d.includes('partly') || d.includes('mainly clear')) return '⛅'
  if (d.includes('clear')) return '☀️'
  return '🌡️'
}

export default function PromotedDailyBrief({ session, onAskQuestion, onOpenCurry }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [weather, setWeather] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await callCurryAI('daily_insight', {}, session)
        if (!cancelled && data.ok) setBrief(data.insight)
      } catch (e) { console.error('Daily brief failed:', e) }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Fires once per mount. If the user denies/has no geolocation, the
  // whole thing just no-ops and the badge never appears — no error UI.
  useEffect(() => {
    if (!navigator.geolocation) return
    let cancelled = false

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const data = await callCurryAI('weather', { lat: latitude, lon: longitude }, session)
          if (!cancelled && data.ok) setWeather(data.weather)
        } catch (e) { console.error('Weather fetch failed:', e) }
      },
      (err) => { console.warn('Geolocation unavailable/denied:', err.message) },
      { timeout: 8000, maximumAge: 10 * 60000 }
    )

    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div style={s.card}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={s.avatar}>✨</div>
          <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>Curry is thinking about your day…</span>
        </div>
      </div>
    )
  }
  if (!brief) return null

  const moodEmoji = MOOD_EMOJI[brief.mood] || '🙂'
  const suggestion = brief.suggestion
  const insights = Array.isArray(brief.insights) ? brief.insights : []

  if (collapsed) {
    return (
      <button style={s.collapsedBar} onClick={() => setCollapsed(false)}>
        <span>{moodEmoji}</span>
        <span style={s.collapsedText}>{brief.greeting}</span>
        {weather && (
          <span style={s.collapsedWeather}>{weatherEmoji(weather.description)} {weather.tempC}°C</span>
        )}
        <span style={s.collapsedExpand}>▾</span>
      </button>
    )
  }

  return (
    <div style={s.card}>
      <button style={s.collapseBtn} onClick={() => setCollapsed(true)} title="Minimize">︿</button>

      <div style={s.headerRow}>
        <div style={s.avatar}>✨</div>
        <div style={{ flex: 1 }}>
          <div style={s.greetingRow}>
            <div style={s.greeting}>{moodEmoji} {brief.greeting}</div>
            {weather && (
              <div style={s.weatherBadge} title={weather.description}>
                {weatherEmoji(weather.description)} {weather.tempC}°C
              </div>
            )}
          </div>
          {brief.mood_summary && <div style={s.moodSummary}>{brief.mood_summary}</div>}
          {weather?.rainAlert && (
            <div style={s.rainAlert}>🌂 {weather.rainAlert}</div>
          )}
        </div>
      </div>

      {insights.length > 0 && (
        <div style={s.insights}>
          {insights.map((ins, i) => (
            <div key={i} style={s.insightRow}>
              <span style={{ color: '#a78bfa' }}>•</span> {ins.text}
            </div>
          ))}
        </div>
      )}

      {suggestion && suggestion.type && suggestion.type !== 'none' && suggestion.title && (
        <div style={s.suggestion}>
          <span style={{ fontSize: 16 }}>{SUGGESTION_EMOJI[suggestion.type] || '✨'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{suggestion.title}</div>
            <div style={{ fontSize: 12, color: '#a0aec0' }}>{suggestion.reason}</div>
          </div>
        </div>
      )}

      <div style={s.actionRow}>
        {brief.question && (
          <button style={s.questionBtn} onClick={() => { onAskQuestion(brief.question); onOpenCurry() }}>
            {brief.question} →
          </button>
        )}
        <button style={s.chatBtn} onClick={onOpenCurry}>Open Curry</button>
      </div>
    </div>
  )
}

const s = {
card: {
  position: 'relative',
  background: 'linear-gradient(135deg, rgba(102,126,234,0.16), rgba(118,75,162,0.16), rgba(240,147,251,0.08))',
  border: '1px solid rgba(167,139,250,0.3)', borderRadius: 18,
  padding: '16px 18px', margin: '10px 16px 4px',
  display: 'flex', flexDirection: 'column', gap: 10,
  boxShadow: '0 4px 20px rgba(102,126,234,0.12)',
  maxHeight: '38vh',
  overflowY: 'auto',
},
  collapseBtn: {
    position: 'absolute', top: 10, right: 12, background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer', padding: 4,
  },
  headerRow: { display: 'flex', gap: 12, alignItems: 'flex-start', paddingRight: 20 },
  avatar: {
    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg,#667eea,#764ba2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
    boxShadow: '0 0 14px rgba(102,126,234,0.4)',
  },
  greetingRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  greeting: { fontSize: 15.5, fontWeight: 700, color: '#fff', lineHeight: 1.35 },
  weatherBadge: {
    display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700,
    color: '#e9d5ff', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
    borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap',
  },
  rainAlert: { fontSize: 12, color: '#93c5fd', marginTop: 4, fontWeight: 600 },
  moodSummary: { fontSize: 13, color: '#c9cbe0', lineHeight: 1.5, marginTop: 3 },
  insights: { display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 46 },
  insightRow: { fontSize: 13, color: '#d8dae8', lineHeight: 1.5, display: 'flex', gap: 6 },
  suggestion: { display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '9px 12px', marginLeft: 46 },
  actionRow: { display: 'flex', gap: 8, marginLeft: 46, flexWrap: 'wrap' },
  questionBtn: {
    textAlign: 'left', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
    borderRadius: 10, color: '#e9d5ff', fontSize: 12.5, fontWeight: 600, padding: '8px 12px',
    cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4, flex: 1,
  },
  chatBtn: {
    background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 10,
    color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
  },
  collapsedBar: {
    display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% - 32px)', margin: '10px 16px 4px',
    background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 12,
    padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
  },
  collapsedText: { flex: 1, textAlign: 'left', fontSize: 12.5, color: '#c9cbe0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  collapsedWeather: { fontSize: 11.5, color: '#a78bfa', fontWeight: 700, whiteSpace: 'nowrap' },
  collapsedExpand: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
}
