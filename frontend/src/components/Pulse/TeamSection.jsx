import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFootballData } from '../../hooks/useFootballData'
import { useTeamNews } from '../../hooks/useTeamNews'
import { supabase } from '../../lib/supabase'
import NewsArticleModal from './NewsArticleModal'
import PLStandingsModal from './PLStandingsModal'
import HighlightsButton from './HighlightsButton'
import { computeForm } from '../../lib/footballForm'
import FormStrip from './FormStrip'
import FixtureTimeline from './FixtureTimeline'
import NewsTabs from './NewsTabs'
import MatchCard from './MatchCard'
import MatchCentreModal from './MatchCentreModal'
import PlayerSpotlight from './PlayerSpotlight'

function formatMatchDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

// Text that auto-inverts against whatever is behind it (light card,
// dark card, or a photo) — guarantees legibility without depending on
// theme variables at all.
const autoContrastText = {
  color: '#ffffff',
  mixBlendMode: 'difference',
}

function StatPill({ label, value }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      borderRadius: 12, padding: '6px 12px', background: 'rgba(127,127,127,0.08)', border: '1px solid var(--border)',
      minWidth: 56,
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, ...autoContrastText }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 700, ...autoContrastText, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
    </div>
  )
}

export default function TeamSection({ userId, teamId, onChangeTeam, session, onSelectVideo }) {
  const { data, loading, error } = useFootballData(teamId)
  const [expanded, setExpanded] = useState(false)
  const [openArticle, setOpenArticle] = useState(null)
  const [showStandings, setShowStandings] = useState(false)
  const [showMatchCentre, setShowMatchCentre] = useState(null)
  const teamName = data?.team?.shortName || data?.team?.name
  const { articles, loading: newsLoading } = useTeamNews(teamId, teamName)

  const clearTeam = async () => {
    await supabase.from('profiles').update({ favorite_pl_team: null }).eq('id', userId)
    onChangeTeam(null)
  }

  if (loading && !data) {
    return (
      <div style={{ borderRadius: 18, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', fontSize: 12.5, ...autoContrastText }}>
        Loading your team…
      </div>
    )
  }

  if (error && !data) {
    return (
      <div style={{ borderRadius: 18, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12.5, color: '#f87171' }}>Couldn't load your team right now.</div>
        <button onClick={clearTeam} style={{ marginTop: 8, fontSize: 12, ...autoContrastText, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          Change team
        </button>
      </div>
    )
  }

  const isLive = data.liveMatch != null

  return (
    <motion.div layout style={{ borderRadius: 18, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <img src={data.team.crest} alt={data.team.name} style={{ width: 30, height: 30, objectFit: 'contain' }} />
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, ...autoContrastText, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Your Team</div>
      <div style={{ fontSize: 15, fontWeight: 800, ...autoContrastText }}>{data.team.name}</div>
    </div>
  </div>
  <button onClick={clearTeam} title="Change team" style={{ fontSize: 11, ...autoContrastText, opacity: 0.6, background: 'none', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
    Change
  </button>
</div>

{data.standing && (
  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
    <StatPill label="Position" value={`#${data.standing.position}`} />
    <StatPill label="Points" value={data.standing.points} />
    {data.standing.goalDifference != null && (
      <StatPill label="GD" value={(data.standing.goalDifference > 0 ? '+' : '') + data.standing.goalDifference} />
    )}
  </div>
)}

{data.recentFixtures?.length > 0 && (
  <div style={{ marginBottom: 10 }}>
    <FormStrip form={computeForm(data.recentFixtures, data.team.shortName)} />
  </div>
)}

<div style={{ marginBottom: 10 }} onClick={() => {
  if (data.liveMatch) {
    setShowMatchCentre({
      match: { id: data.liveMatch.id || data.lastResult?.id, teamId, teamName: data.team.shortName || data.team.name, utcDate: new Date().toISOString(), isFinal: false },
      homeTeam: data.liveMatch.homeTeam, awayTeam: data.liveMatch.awayTeam,
      homeScore: data.liveMatch.homeScore, awayScore: data.liveMatch.awayScore,
    })
  } else if (!data.nextMatch && data.lastResult) {
    setShowMatchCentre({
      match: { id: data.lastResult.id, teamId, teamName: data.team.shortName || data.team.name, utcDate: data.lastResult.utcDate, isFinal: true },
      homeTeam: data.lastResult.homeTeam, awayTeam: data.lastResult.awayTeam,
      homeScore: data.lastResult.homeScore, awayScore: data.lastResult.awayScore,
    })
  }
}} style={{ cursor: (data.liveMatch || (!data.nextMatch && data.lastResult)) ? 'pointer' : 'default' }}>
  <MatchCard
    liveMatch={data.liveMatch}
    nextMatch={!data.liveMatch ? data.nextMatch : null}
    lastResult={!data.liveMatch && !data.nextMatch ? data.lastResult : null}
    session={session}
    onSelectVideo={onSelectVideo}
  />
</div>

{(data.liveMatch || data.nextMatch) && data.lastResult?.id && (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 11, fontWeight: 700, ...autoContrastText, opacity: 0.6, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
      Last Match
    </div>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      borderRadius: 14, padding: '10px 12px', background: 'rgba(127,127,127,0.08)', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, ...autoContrastText, minWidth: 0 }}>
        {data.lastResult.homeTeam} {data.lastResult.homeScore}-{data.lastResult.awayScore} {data.lastResult.awayTeam}
      </div>
      <HighlightsButton
        session={session}
        match={{ id: data.lastResult.id, homeTeam: data.lastResult.homeTeam, awayTeam: data.lastResult.awayTeam }}
        onSelectVideo={onSelectVideo}
      />
    </div>
  </div>
)}

{(data.recentFixtures?.length > 0 || data.upcomingFixtures?.length > 0) && (
  <div style={{ marginBottom: 10 }}>
    <FixtureTimeline past={data.recentFixtures} upcoming={data.upcomingFixtures} onSelectMatch={() => {}} />
  </div>
)}
      <div style={{ marginBottom: 10 }}>
  <PlayerSpotlight />
</div>
      {!newsLoading && articles.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <NewsTabs articles={articles} teamName={teamName} onOpenArticle={setOpenArticle} />
        </div>
      )}
{showMatchCentre && (
  <MatchCentreModal
    match={showMatchCentre.match}
    homeTeam={showMatchCentre.homeTeam}
    awayTeam={showMatchCentre.awayTeam}
    homeScore={showMatchCentre.homeScore}
    awayScore={showMatchCentre.awayScore}
    onClose={() => setShowMatchCentre(null)}
  />
)}
      {data.standing && (
        <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setShowStandings(true)}
            style={{
              width: '100%', background: 'linear-gradient(135deg,#6c63ff,#a78bfa)', border: 'none',
              borderRadius: 12, padding: '8px 10px', color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            View full table
          </button>
        </div>
      )}

      <AnimatePresence>
        {expanded && data.standing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', marginTop: 8, fontSize: 11.5, ...autoContrastText, opacity: 0.7 }}>
            {data.standing.played} played · {data.standing.won}W {data.standing.draw}D {data.standing.lost}L
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={() => setExpanded(v => !v)} style={{ marginTop: 8, fontSize: 11.5, color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
        {expanded ? 'Show less' : 'See more'}
      </button>

      {openArticle && <NewsArticleModal article={openArticle} onClose={() => setOpenArticle(null)} />}
      {showStandings && <PLStandingsModal highlightTeamId={teamId} onClose={() => setShowStandings(false)} />}

      <style>{`@keyframes livePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </motion.div>
  )
}
