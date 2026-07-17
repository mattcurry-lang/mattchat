import { useState, useEffect } from 'react'
import { callCurryAI } from './CurryAI'
import {
  IconX, IconChevronUp, IconChevronDown, IconMusic, IconFilm, IconBook, IconHeart, IconSparkle,
  IconUmbrella, IconSun, IconCloud, IconCloudSun, IconCloudRain, IconCloudSnow, IconCloudLightning,
  IconCloudFog, IconThermometer,
} from './Icons'

// Promoted version of the Daily Brief — meant to sit at the TOP of the
// home screen (above the story rail), not buried inside the Curry
// chat panel. Same data source (daily_insight), bigger presence
//
// Collapses to a slim one-liner once dismissed for the session so it
// doesn't nag every time the user reopens the app tab.

// Mood is a small colored status dot rather than an emoji face —
// matches the pattern used in CurryAI.jsx and RelationshipInsights.jsx.
const MOOD_COLOR = {
  positive: '#4ade80', excited: '#f472b6', neutral: '#9ca3af',
  stressed: '#fb923c', anxious: '#facc15', sad: '#60a5fa', negative: '#f87171',
}
function MoodDot({ mood, size = 11 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: MOOD_COLOR[mood] || '#9ca3af', flexShrink: 0, boxShadow: `0 0 8px ${MOOD_COLOR[mood] || '#9ca3af'}66` }} />
}
const SUGGESTION_ICON = { music: IconMusic, movie: IconFilm, book: IconBook, encouragement: IconHeart, none: null }

// Weather is intentionally kept separate from the cached daily insight —
// weather changes hour to hour, but the brief itself is cached once per
// day server-side. This is its own lightweight, always-fresh call.
function weatherIcon(description = '') {
  const d = description.toLowerCase()
  if (d.includes('thunder')) return IconCloudLightning
  if (d.includes('snow')) return IconCloudSnow
  if (d.includes('drizzle') || d.includes('rain') || d.includes('shower')) return IconCloudRain
  if (d.includes('fog')) return IconCloudFog
  if (d.includes('overcast')) return IconCloud
  if (d.includes('partly') || d.includes('mainly clear')) return IconCloudSun
  if (d.includes('clear')) return IconSun
  return IconThermometer
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
          <div style={s.avatar}><IconSparkle size={16} style={{ color: '#fff' }} /></div>
          <span style={{ fontSize: 13, color: 'var(--dark-text-2)', fontWeight: 500 }}>Curry is thinking about your day…</span>
        </div>
      </div>
    )
  }
  if (!brief) return null

  const suggestion = brief.suggestion
  const insights = Array.isArray(brief.insights) ? brief.insights : []
  const WeatherIcon = weather ? weatherIcon(weather.description) : null

  if (collapsed) {
    return (
      <button style={s.collapsedBar} onClick={() => setCollapsed(false)}>
        <MoodDot mood={brief.mood} />
        <span style={s.collapsedText}>{brief.greeting}</span>
        {weather && (
          <span style={s.collapsedWeather}><WeatherIcon size={12} /> {weather.tempC}°C</span>
        )}
        <span style={s.collapsedExpand}><IconChevronDown size={13} /></span>
      </button>
    )
  }

  return (
    <div style={s.card}>
      <button style={s.collapseBtn} onClick={() => setCollapsed(true)} title="Minimize"><IconChevronUp size={14} /></button>

      <div style={s.headerRow}>
        <div style={s.avatar}><IconSparkle size={16} style={{ color: '#fff' }} /></div>
        <div style={{ flex: 1 }}>
          <div style={s.greetingRow}>
            <div style={s.greeting}><MoodDot mood={brief.mood} /> {brief.greeting}</div>
            {weather && (
              <div style={s.weatherBadge} title={weather.description}>
                <WeatherIcon size={13} /> {weather.tempC}°C
              </div>
            )}
          </div>
          {brief.mood_summary && <div style={s.moodSummary}>{brief.mood_summary}</div>}
          {weather?.rainAlert && (
            <div style={s.rainAlert}><IconUmbrella size={13} /> {weather.rainAlert}</div>
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
          <span style={{ color: '#a78bfa', flexShrink: 0, marginTop: 1 }}>
            {(() => { const Icon = SUGGESTION_ICON[suggestion.type] || IconSparkle; return <Icon size={16} /> })()}
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--dark-text)' }}>{suggestion.title}</div>
            <div style={{ fontSize: 12, color: 'var(--dark-text-2)' }}>{suggestion.reason}</div>
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
    color: 'var(--dark-text-3)', cursor: 'pointer', padding: 4, display: 'flex',
  },
  headerRow: { display: 'flex', gap: 12, alignItems: 'flex-start', paddingRight: 20 },
  avatar: {
    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg,#667eea,#764ba2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
    boxShadow: '0 0 14px rgba(102,126,234,0.4)',
  },
  greetingRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  greeting: { fontSize: 15.5, fontWeight: 700, color: 'var(--dark-text)', lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: 8 },
  weatherBadge: {
    display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
    color: '#e9d5ff', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
    borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap',
  },
  rainAlert: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#93c5fd', marginTop: 4, fontWeight: 600 },
  moodSummary: { fontSize: 13, color: 'var(--dark-text-2)', lineHeight: 1.5, marginTop: 3 },
  insights: { display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 46 },
  insightRow: { fontSize: 13, color: 'var(--dark-text-2)', lineHeight: 1.5, display: 'flex', gap: 6 },
  suggestion: { display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(127,127,127,0.08)', borderRadius: 10, padding: '9px 12px', marginLeft: 46 },
  actionRow: { display: 'flex', gap: 8, marginLeft: 46, flexWrap: 'wrap' },
  questionBtn: {
    textAlign: 'left', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
    borderRadius: 10, color: '#7c3aed', fontSize: 12.5, fontWeight: 600, padding: '8px 12px',
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
  collapsedText: { flex: 1, textAlign: 'left', fontSize: 12.5, color: 'var(--dark-text-2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  collapsedWeather: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#a78bfa', fontWeight: 700, whiteSpace: 'nowrap' },
  collapsedExpand: { color: 'var(--dark-text-3)', display: 'flex' },
}
