import React from 'react'
import { motion } from 'framer-motion'
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

function Crest({ src, name, size = 50 }) {
  const [failed, setFailed] = React.useState(false)
  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.4, fontWeight: 800, color: T.secondary,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}
      >
        {(name || '?').trim().charAt(0).toUpperCase()}
      </div>
    )
  }
  return (
    <img
      src={src} alt="" onError={() => setFailed(true)} draggable={false}
      style={{ width: size, height: size, objectFit: 'contain', filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.35))' }}
    />
  )
}

function TeamColumn({ crest, name, dim }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 0, opacity: dim ? 0.45 : 1, transition: 'opacity 0.2s' }}>
      <Crest src={crest} name={name} />
      <div style={{
        fontSize: 12.5, fontWeight: 700, color: T.primary, textAlign: 'center', lineHeight: 1.3,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: '100%',
      }}>
        {name}
      </div>
    </div>
  )
}

function Scoreboard({ left, center, right }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
      {left}
      {center}
      {right}
    </div>
  )
}

function Score({ home, away, size = 38, live }) {
  const homeAhead = home > away
  const awayAhead = away > home
  const base = { fontSize: size, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }
  return (
    <div
      role="text"
      aria-label={`${home} to ${away}`}
      aria-live={live ? 'polite' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
    >
      <span style={{ ...base, color: homeAhead || home === away ? '#fff' : 'rgba(255,255,255,0.4)' }}>{home}</span>
      <span style={{ ...base, fontSize: size * 0.55, color: 'rgba(255,255,255,0.3)' }}>–</span>
      <span style={{ ...base, color: awayAhead || home === away ? '#fff' : 'rgba(255,255,255,0.4)' }}>{away}</span>
    </div>
  )
}

function CountTile({ value, label }) {
  return (
    <div style={{
      minWidth: 54, padding: '10px 8px', borderRadius: 14, textAlign: 'center',
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(167,139,250,0.25)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {String(value).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(167,139,250,0.8)', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 }}>{label}</div>
    </div>
  )
}

const labelStyle = { fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }

export default function MatchCard({ liveMatch, nextMatch, lastResult, session, onSelectVideo }) {
  const countdown = useCountdown(!liveMatch && nextMatch ? nextMatch.utcDate : null)

  const styles = (
    <style>{`
      @keyframes mcLivePulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.95); } }
      .mc-live-dot { animation: mcLivePulse 1.5s ease infinite; }
      @keyframes mcGlowPulse { 0%,100% { box-shadow: 0 12px 35px -10px rgba(239,68,68,0.5); } 50% { box-shadow: 0 16px 45px -8px rgba(239,68,68,0.7); } }
      .mc-live-glow { animation: mcGlowPulse 3s ease infinite; }
      @media (prefers-reduced-motion: reduce) { .mc-live-dot, .mc-live-glow { animation: none; } }
    `}</style>
  )

  /* ───────── LIVE ───────── */
  if (liveMatch) {
    return (
      <motion.div 
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className="mc-live-glow"
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 22, padding: '18px 18px 20px',
          background: 'linear-gradient(150deg, rgba(239,68,68,0.25) 0%, rgba(20,16,42,0.95) 70%)',
          border: '1px solid rgba(239,68,68,0.5)', backdropFilter: 'blur(20px)',
        }}
      >
        {styles}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.06em',
            color: '#fca5a5', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 999, padding: '5px 12px', boxShadow: '0 0 12px rgba(239,68,68,0.3)'
          }}>
            <span className="mc-live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
            LIVE{liveMatch.minute ? ` · ${liveMatch.minute}'` : ''}
          </span>
          <span style={{ ...labelStyle, maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liveMatch.competition}</span>
        </div>

        <Scoreboard
          left={<TeamColumn crest={liveMatch.homeCrest} name={liveMatch.homeTeam} />}
          center={<Score home={liveMatch.homeScore} away={liveMatch.awayScore} size={42} live />}
          right={<TeamColumn crest={liveMatch.awayCrest} name={liveMatch.awayTeam} />}
        />

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11.5, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
          Tap to enter match centre ⚡
        </div>
      </motion.div>
    )
  }

  /* ───────── UPCOMING ───────── */
  if (nextMatch) {
    const { date, time } = kickoffParts(nextMatch.utcDate)
    return (
      <motion.div 
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
        style={{
          borderRadius: 22, padding: '18px 18px 20px',
          background: 'linear-gradient(150deg, rgba(108,99,255,0.18) 0%, rgba(20,16,42,0.95) 70%)',
          border: '1px solid rgba(167,139,250,0.35)', backdropFilter: 'blur(20px)',
          boxShadow: '0 14px 35px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <span style={{ ...labelStyle, background: 'rgba(167,139,250,0.12)', padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(167,139,250,0.25)', color: '#c4b5fd' }}>
            {nextMatch.competition}
          </span>
        </div>

        <Scoreboard
          left={<TeamColumn crest={nextMatch.homeCrest} name={nextMatch.homeTeam} />}
          center={
            <div style={{
              width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 900, letterSpacing: 1, color: '#fff',
              background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', border: '1px solid rgba(255,255,255,0.3)',
              boxShadow: '0 6px 16px rgba(108,99,255,0.4)'
            }}>
              VS
            </div>
          }
          right={<TeamColumn crest={nextMatch.awayCrest} name={nextMatch.awayTeam} />}
        />

        {countdown && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 18 }}>
            {countdown.started ? (
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#c4b5fd' }}>🔥 Kicking off right now…</div>
            ) : (
              <>
                {countdown.days > 0 && <CountTile value={countdown.days} label="Days" />}
                <CountTile value={countdown.hours} label="Hours" />
                <CountTile value={countdown.mins} label="Mins" />
              </>
            )}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{date} · {time}</div>
          {nextMatch.venue && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>📍 {nextMatch.venue}</div>}
        </div>
      </motion.div>
    )
  }

  /* ───────── FULL TIME ───────── */
  if (lastResult) {
    const homeLost = lastResult.homeScore < lastResult.awayScore
    const awayLost = lastResult.awayScore < lastResult.homeScore
    return (
      <motion.div 
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
        style={{
          borderRadius: 22, padding: '18px 18px 20px',
          background: 'linear-gradient(150deg, rgba(255,255,255,0.05) 0%, rgba(20,16,42,0.9) 70%)',
          border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)',
          boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <span style={{ ...labelStyle, background: 'rgba(255,255,255,0.06)', padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)' }}>
            Full Time Result
          </span>
        </div>

        <Scoreboard
          left={<TeamColumn crest={lastResult.homeCrest} name={lastResult.homeTeam} dim={homeLost} />}
          center={<Score home={lastResult.homeScore} away={lastResult.awayScore} size={38} />}
          right={<TeamColumn crest={lastResult.awayCrest} name={lastResult.awayTeam} dim={awayLost} />}
        />

        {lastResult.id && (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <HighlightsButton
              session={session}
              match={{ id: lastResult.id, homeTeam: lastResult.homeTeam, awayTeam: lastResult.awayTeam }}
              onSelectVideo={onSelectVideo}
            />
          </div>
        )}
      </motion.div>
    )
  }

  return null
}
