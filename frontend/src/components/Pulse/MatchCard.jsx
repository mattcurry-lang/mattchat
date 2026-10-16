import React from 'react'
import HighlightsButton from './HighlightsButton'

const T = {
  primary: 'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  muted: 'var(--text-muted)',
}

function kickoffParts(iso) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  }
}

// Returns { days, hours, mins } while counting down, { started: true } once
// kickoff time has passed, or null when there's no target.
function useCountdown(targetIso) {
  const [value, setValue] = React.useState(null)
  React.useEffect(() => {
    if (!targetIso) { setValue(null); return undefined }
    const tick = () => {
      const diff = new Date(targetIso).getTime() - Date.now()
      if (diff <= 0) { setValue({ started: true }); return }
      setValue({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
      })
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [targetIso])
  return value
}

function Crest({ src, name, size = 48 }) {
  const [failed, setFailed] = React.useState(false)
  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.4, fontWeight: 800, color: T.secondary,
          background: 'rgba(127,127,127,0.14)', border: '1px solid var(--border)',
        }}
      >
        {(name || '?').trim().charAt(0).toUpperCase()}
      </div>
    )
  }
  return (
    <img
      src={src} alt="" onError={() => setFailed(true)} draggable={false}
      style={{ width: size, height: size, objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))' }}
    />
  )
}

function TeamColumn({ crest, name, dim }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0, opacity: dim ? 0.55 : 1, transition: 'opacity 0.2s' }}>
      <Crest src={crest} name={name} />
      <div style={{
        fontSize: 12, fontWeight: 700, color: T.primary, textAlign: 'center', lineHeight: 1.25,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: '100%',
      }}>
        {name}
      </div>
    </div>
  )
}

function Scoreboard({ left, center, right }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
      {left}
      {center}
      {right}
    </div>
  )
}

function Score({ home, away, size = 34, live }) {
  const homeAhead = home > away
  const awayAhead = away > home
  const base = { fontSize: size, fontWeight: 900, letterSpacing: -1, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }
  return (
    <div
      role="text"
      aria-label={`${home} to ${away}`}
      aria-live={live ? 'polite' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
    >
      <span style={{ ...base, color: homeAhead || home === away ? T.primary : T.muted }}>{home}</span>
      <span style={{ ...base, fontSize: size * 0.6, color: T.muted }}>–</span>
      <span style={{ ...base, color: awayAhead || home === away ? T.primary : T.muted }}>{away}</span>
    </div>
  )
}

function CountTile({ value, label }) {
  return (
    <div style={{
      minWidth: 52, padding: '8px 6px', borderRadius: 12, textAlign: 'center',
      background: 'rgba(127,127,127,0.1)', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: T.primary, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {String(value).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{label}</div>
    </div>
  )
}

const label = { fontSize: 10.5, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5 }

export default function MatchCard({ liveMatch, nextMatch, lastResult, session, onSelectVideo }) {
  const countdown = useCountdown(!liveMatch && nextMatch ? nextMatch.utcDate : null)

  const styles = (
    <style>{`
      @keyframes mcLivePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      .mc-live-dot { animation: mcLivePulse 1.4s ease infinite; }
      @media (prefers-reduced-motion: reduce) { .mc-live-dot { animation: none; } }
    `}</style>
  )

  /* ───────── LIVE ───────── */
  if (liveMatch) {
    return (
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 18, padding: '14px 14px 18px',
        background: 'linear-gradient(160deg, rgba(239,68,68,0.18), rgba(239,68,68,0.04) 60%)',
        border: '1px solid rgba(239,68,68,0.35)', boxShadow: '0 8px 28px -12px rgba(239,68,68,0.45)',
      }}>
        {styles}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
            color: '#f87171', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 999, padding: '4px 10px',
          }}>
            <span className="mc-live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
            LIVE{liveMatch.minute ? ` · ${liveMatch.minute}'` : ''}
          </span>
          <span style={{ ...label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liveMatch.competition}</span>
        </div>

        <Scoreboard
          left={<TeamColumn crest={liveMatch.homeCrest} name={liveMatch.homeTeam} />}
          center={<Score home={liveMatch.homeScore} away={liveMatch.awayScore} size={38} live />}
          right={<TeamColumn crest={liveMatch.awayCrest} name={liveMatch.awayTeam} />}
        />

        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: T.muted }}>Tap for match centre</div>
      </div>
    )
  }

  /* ───────── UPCOMING ───────── */
  if (nextMatch) {
    const { date, time } = kickoffParts(nextMatch.utcDate)
    return (
      <div style={{
        borderRadius: 18, padding: '14px 14px 16px',
        background: 'linear-gradient(160deg, rgba(167,139,250,0.14), rgba(167,139,250,0.03) 60%)',
        border: '1px solid rgba(167,139,250,0.3)',
      }}>
        <div style={{ ...label, marginBottom: 14, textAlign: 'center' }}>{nextMatch.competition}</div>

        <Scoreboard
          left={<TeamColumn crest={nextMatch.homeCrest} name={nextMatch.homeTeam} />}
          center={
            <div style={{
              width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 900, letterSpacing: 0.5, color: '#c4b5fd',
              background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.3)',
            }}>
              VS
            </div>
          }
          right={<TeamColumn crest={nextMatch.awayCrest} name={nextMatch.awayTeam} />}
        />

        {countdown && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {countdown.started ? (
              <div style={{ fontSize: 13, fontWeight: 800, color: '#c4b5fd' }}>Kicking off…</div>
            ) : (
              <>
                {countdown.days > 0 && <CountTile value={countdown.days} label="Days" />}
                <CountTile value={countdown.hours} label="Hours" />
                <CountTile value={countdown.mins} label="Mins" />
              </>
            )}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.primary }}>{date} · {time}</div>
          {nextMatch.venue && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>{nextMatch.venue}</div>}
        </div>
      </div>
    )
  }

  /* ───────── FULL TIME ───────── */
  if (lastResult) {
    const homeLost = lastResult.homeScore < lastResult.awayScore
    const awayLost = lastResult.awayScore < lastResult.homeScore
    return (
      <div style={{
        borderRadius: 18, padding: '14px 14px 16px',
        background: 'rgba(127,127,127,0.07)', border: '1px solid var(--border)',
      }}>
        <div style={{ ...label, marginBottom: 14, textAlign: 'center' }}>Full time</div>

        <Scoreboard
          left={<TeamColumn crest={lastResult.homeCrest} name={lastResult.homeTeam} dim={homeLost} />}
          center={<Score home={lastResult.homeScore} away={lastResult.awayScore} size={34} />}
          right={<TeamColumn crest={lastResult.awayCrest} name={lastResult.awayTeam} dim={awayLost} />}
        />

        {lastResult.id && (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <HighlightsButton
              session={session}
              match={{ id: lastResult.id, homeTeam: lastResult.homeTeam, awayTeam: lastResult.awayTeam }}
              onSelectVideo={onSelectVideo}
            />
          </div>
        )}
      </div>
    )
  }

  return null
}
