import React from 'react'
import HighlightsButton from './HighlightsButton'

function formatMatchDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

function useCountdown(targetIso) {
  const [label, setLabel] = React.useState('')
  React.useEffect(() => {
    if (!targetIso) return
    const tick = () => {
      const diff = new Date(targetIso).getTime() - Date.now()
      if (diff <= 0) { setLabel('Kicking off…'); return }
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      setLabel(days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`)
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [targetIso])
  return label
}

export default function MatchCard({ liveMatch, nextMatch, lastResult, session, onSelectVideo }) {
  const countdown = useCountdown(!liveMatch && nextMatch ? nextMatch.utcDate : null)

  if (liveMatch) {
    return (
      <div style={{
        borderRadius: 16, padding: '14px 16px', background: 'linear-gradient(135deg, rgba(239,68,68,0.14), rgba(239,68,68,0.04))',
        border: '1px solid rgba(239,68,68,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'livePulse 1.4s ease infinite' }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Live{liveMatch.minute ? ` · ${liveMatch.minute}'` : ''}
          </span>
          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>{liveMatch.competition}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <TeamColumn crest={liveMatch.homeCrest} name={liveMatch.homeTeam} />
          <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{liveMatch.homeScore} - {liveMatch.awayScore}</div>
          <TeamColumn crest={liveMatch.awayCrest} name={liveMatch.awayTeam} />
        </div>
        <style>{`@keyframes livePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>
    )
  }

  if (nextMatch) {
    return (
      <div style={{ borderRadius: 16, padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,139,250,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{nextMatch.competition}</span>
          {countdown && (
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#c4b5fd' }}>⏱ {countdown}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <TeamColumn crest={nextMatch.homeCrest} name={nextMatch.homeTeam} />
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>vs</div>
          <TeamColumn crest={nextMatch.awayCrest} name={nextMatch.awayTeam} />
        </div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 10 }}>
          {formatMatchDate(nextMatch.utcDate)}
          {nextMatch.venue && ` · ${nextMatch.venue}`}
        </div>
      </div>
    )
  }

  if (lastResult) {
    return (
      <div style={{ borderRadius: 16, padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>Full Time</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <TeamColumn crest={lastResult.homeCrest} name={lastResult.homeTeam} />
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{lastResult.homeScore} - {lastResult.awayScore}</div>
          <TeamColumn crest={lastResult.awayCrest} name={lastResult.awayTeam} />
        </div>
        {lastResult.id && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
            <HighlightsButton session={session} match={{ id: lastResult.id, homeTeam: lastResult.homeTeam, awayTeam: lastResult.awayTeam }} onSelectVideo={onSelectVideo} />
          </div>
        )}
      </div>
    )
  }

  return null
}

function TeamColumn({ crest, name }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 80 }}>
      <img src={crest} alt={name} style={{ width: 32, height: 32, objectFit: 'contain' }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>{name}</div>
    </div>
  )
}
