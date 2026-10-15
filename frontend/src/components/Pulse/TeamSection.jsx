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
import { getMatchdayPhase } from '../../lib/matchday'
import MatchdayBanner from './MatchdayBanner'
import PreMatchLineups from './PreMatchLineups'
import TeamSectionSkeleton from './TeamSectionSkeleton'
import FanPoll from './FanPoll'
import NotificationPrefsSheet from './NotificationPrefsSheet'

const T = {
  primary: 'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  muted: 'var(--text-muted)',
}

function Block({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      {title && (
        <div style={{ fontSize: 10.5, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

function Stat({ label, value, accent, size = 20 }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: size, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.1, color: accent || T.primary }}>{value}</div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>{label}</div>
    </div>
  )
}

function Divider() {
  return <div aria-hidden="true" style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />
}

function LivePill() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
      color: '#f87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 999, padding: '3px 8px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'livePulse 1.2s ease infinite' }} />
      LIVE
    </span>
  )
}

const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
  color: T.primary, background: 'rgba(127,127,127,0.08)', border: '1px solid var(--border)',
  borderRadius: 999, padding: '7px 14px', cursor: 'pointer',
}

export default function TeamSection({ userId, teamId, onChangeTeam, session, onSelectVideo }) {
  const { data, loading, error } = useFootballData(teamId)
  // null = "no choice yet" → auto-open only while the team is playing live
  const [expanded, setExpanded] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)
  const [showStandings, setShowStandings] = useState(false)
  const [showMatchCentre, setShowMatchCentre] = useState(null)
  const [showNotifPrefs, setShowNotifPrefs] = useState(false)
  const teamName = data?.team?.shortName || data?.team?.name
  const { articles, loading: newsLoading } = useTeamNews(teamId, teamName)

  const clearTeam = async () => {
    await supabase.from('profiles').update({ favorite_pl_team: null }).eq('id', userId)
    onChangeTeam(null)
  }

  if (loading && !data) return <TeamSectionSkeleton />

  if (error && !data) {
    return (
      <div style={{ borderRadius: 18, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12.5, color: error === 'rate_limited' ? '#fbbf24' : '#f87171' }}>
          {error === 'rate_limited'
            ? 'Football data is briefly rate-limited — retrying automatically…'
            : "Couldn't load your team right now."}
        </div>
        {error !== 'rate_limited' && (
          <button onClick={clearTeam} style={{ marginTop: 8, fontSize: 12, color: T.primary, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Change team
          </button>
        )}
      </div>
    )
  }

  const isLive = data.liveMatch != null
  const matchdayPhase = getMatchdayPhase(data)
  const isOpen = expanded ?? (matchdayPhase === 'live')
  const shortName = data.team.shortName || data.team.name

  const matchTappable = !!(data.liveMatch || (!data.nextMatch && data.lastResult))
  const openMatchCentre = () => {
    if (data.liveMatch) {
      setShowMatchCentre({
        match: { id: data.liveMatch.id || data.lastResult?.id, teamId, teamName: shortName, utcDate: new Date().toISOString(), isFinal: false },
        homeTeam: data.liveMatch.homeTeam, awayTeam: data.liveMatch.awayTeam,
        homeScore: data.liveMatch.homeScore, awayScore: data.liveMatch.awayScore,
      })
    } else if (!data.nextMatch && data.lastResult) {
      setShowMatchCentre({
        match: { id: data.lastResult.id, teamId, teamName: shortName, utcDate: data.lastResult.utcDate, isFinal: true },
        homeTeam: data.lastResult.homeTeam, awayTeam: data.lastResult.awayTeam,
        homeScore: data.lastResult.homeScore, awayScore: data.lastResult.awayScore,
      })
    }
  }

  const gd = data.standing?.goalDifference
  const s = data.standing

  return (
    <div
      style={{
        position: 'relative', borderRadius: 20, padding: 16, overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(167,139,250,0.10), transparent 45%), var(--bg-surface-2)',
        border: '1px solid var(--border)',
      }}
    >
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
            <div aria-hidden="true" style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.35), transparent 70%)' }} />
            <img src={data.team.crest} alt={data.team.name} style={{ position: 'relative', width: 44, height: 44, objectFit: 'contain' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Your Team</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.primary, letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.team.name}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isLive && <LivePill />}
          <button
            onClick={() => setShowNotifPrefs(true)}
            aria-label="Notification settings"
            title="Notification settings"
            style={{ fontSize: 12, background: 'none', border: '1px solid var(--border)', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            🔔
          </button>
          <button
            onClick={clearTeam}
            title="Change team"
            style={{ fontSize: 11, fontWeight: 700, color: T.secondary, background: 'none', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Change
          </button>
        </div>
      </div>

      {/* ── STATS BAR ── */}
      {s && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, padding: '12px 8px',
          borderRadius: 16, background: 'rgba(127,127,127,0.08)', border: '1px solid var(--border)',
        }}>
          <Stat label="Position" value={`#${s.position}`} accent="#c4b5fd" />
          <Divider />
          <Stat label="Points" value={s.points} />
          {gd != null && (
            <>
              <Divider />
              <Stat
                label="GD"
                value={(gd > 0 ? '+' : '') + gd}
                accent={gd > 0 ? '#4ade80' : gd < 0 ? '#f87171' : undefined}
              />
            </>
          )}
        </div>
      )}

      {/* ── FORM ── */}
      {data.recentFixtures?.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Form</span>
          <FormStrip form={computeForm(data.recentFixtures, data.team.shortName)} />
        </div>
      )}

      {/* ── MATCH HERO ── */}
      <div
        onClick={matchTappable ? openMatchCentre : undefined}
        style={{ marginTop: 14, cursor: matchTappable ? 'pointer' : 'default' }}
      >
        <MatchdayBanner phase={matchdayPhase} />
        <MatchCard
          liveMatch={data.liveMatch}
          nextMatch={!data.liveMatch ? data.nextMatch : null}
          lastResult={!data.liveMatch && !data.nextMatch ? data.lastResult : null}
          session={session}
          onSelectVideo={onSelectVideo}
        />
      </div>

      {!data.liveMatch && !data.nextMatch && !data.lastResult && (
        <div style={{ borderRadius: 14, padding: '16px 12px', textAlign: 'center', marginTop: 12, background: 'rgba(127,127,127,0.05)', border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: 12, color: T.muted }}>No fixtures scheduled right now.</div>
        </div>
      )}

      {/* ── EXPANDABLE DETAILS ── */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="more"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            {(matchdayPhase === 'pre' || matchdayPhase === 'live') && data.nextMatch != null && (
              <Block title="Fan poll">
                <FanPoll
                  matchId={data.liveMatch?.id || data.nextMatch.id}
                  pollType="winner"
                  question="Who will win?"
                  options={[
                    { key: 'home', label: (data.liveMatch || data.nextMatch).homeTeam },
                    { key: 'draw', label: 'Draw' },
                    { key: 'away', label: (data.liveMatch || data.nextMatch).awayTeam },
                  ]}
                  userId={session?.user?.id}
                />
              </Block>
            )}

            {matchdayPhase === 'pre' && data.nextMatch && (
              <Block>
                <PreMatchLineups
                  match={{ id: data.nextMatch.id, teamId, teamName: shortName, utcDate: data.nextMatch.utcDate }}
                />
              </Block>
            )}

            {(data.liveMatch || data.nextMatch) && data.lastResult?.id && (
              <Block title="Last match">
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  borderRadius: 14, padding: '10px 12px', background: 'rgba(127,127,127,0.08)', border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, minWidth: 0 }}>
                    {data.lastResult.homeTeam} {data.lastResult.homeScore}-{data.lastResult.awayScore} {data.lastResult.awayTeam}
                  </div>
                  <HighlightsButton
                    session={session}
                    match={{ id: data.lastResult.id, homeTeam: data.lastResult.homeTeam, awayTeam: data.lastResult.awayTeam }}
                    onSelectVideo={onSelectVideo}
                  />
                </div>
              </Block>
            )}

            {s?.played != null && (
              <Block title="Season record">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 8px', borderRadius: 14, background: 'rgba(127,127,127,0.08)', border: '1px solid var(--border)' }}>
                  <Stat size={16} label="Played" value={s.played} />
                  <Stat size={16} label="Won" value={s.won} accent="#4ade80" />
                  <Stat size={16} label="Drawn" value={s.draw} />
                  <Stat size={16} label="Lost" value={s.lost} accent="#f87171" />
                </div>
              </Block>
            )}

            {(data.recentFixtures?.length > 0 || data.upcomingFixtures?.length > 0) && (
              <Block title="Fixtures">
                <FixtureTimeline past={data.recentFixtures} upcoming={data.upcomingFixtures} onSelectMatch={() => {}} />
              </Block>
            )}

            <Block>
              <PlayerSpotlight />
            </Block>

            {!newsLoading && articles.length > 0 && (
              <Block>
                <NewsTabs articles={articles} teamName={teamName} onOpenArticle={setOpenArticle} />
              </Block>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FOOTER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        {s ? (
          <button onClick={() => setShowStandings(true)} style={ghostBtn}>📊 Full table</button>
        ) : <span />}
        <button onClick={() => setExpanded(!isOpen)} aria-expanded={isOpen} style={{ ...ghostBtn, color: '#c4b5fd', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)' }}>
          {isOpen ? 'Show less' : 'See more'}
          <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'inline-block', lineHeight: 1 }}>⌄</motion.span>
        </button>
      </div>

      {/* ── MODALS (outside the collapsing area so they never get clipped) ── */}
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
      {openArticle && <NewsArticleModal article={openArticle} onClose={() => setOpenArticle(null)} />}
      {showStandings && <PLStandingsModal highlightTeamId={teamId} onClose={() => setShowStandings(false)} />}

      {showNotifPrefs && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowNotifPrefs(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
            <NotificationPrefsSheet userId={session?.user?.id} onClose={() => setShowNotifPrefs(false)} />
          </div>
        </div>
      )}

      <style>{`@keyframes livePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  )
}
