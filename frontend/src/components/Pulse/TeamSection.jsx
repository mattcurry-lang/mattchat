import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFootballData } from '../../hooks/useFootballData'
import { useTeamNews } from '../../hooks/useTeamNews'
import { supabase } from '../../lib/supabase'
import NewsArticleModal from './NewsArticleModal'
import PLStandingsModal from './PLStandingsModal'
import HighlightsButton from './HighlightsButton'

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

export default function TeamSection({ userId, teamId, onChangeTeam, session, onSelectVideo }) {
  const { data, loading, error } = useFootballData(teamId)
  const [expanded, setExpanded] = useState(false)
  const [openArticle, setOpenArticle] = useState(null)
  const [showStandings, setShowStandings] = useState(false)
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

      {/* LIVE match banner */}
      {isLive && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px',
          borderRadius: 12, background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
          border: '1px solid rgba(239,68,68,0.35)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0,
            animation: 'livePulse 1.4s ease infinite',
          }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Live{data.liveMatch.minute ? ` · ${data.liveMatch.minute}'` : ''}
          </span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, ...autoContrastText, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            {data.liveMatch.homeTeam} {data.liveMatch.homeScore} - {data.liveMatch.awayScore} {data.liveMatch.awayTeam}
          </span>
        </div>
      )}

      {data.nextMatch && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, ...autoContrastText, opacity: 0.6, marginBottom: 4 }}>Next Match</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, ...autoContrastText, fontWeight: 600 }}>
            <img src={data.nextMatch.homeCrest} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
            {data.nextMatch.homeTeam} vs {data.nextMatch.awayTeam}
            <img src={data.nextMatch.awayCrest} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
          </div>
          <div style={{ fontSize: 11.5, ...autoContrastText, opacity: 0.55, marginTop: 2 }}>{formatMatchDate(data.nextMatch.utcDate)}</div>
        </div>
      )}

    {data.lastResult && (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 11, fontWeight: 700, ...autoContrastText, opacity: 0.6, marginBottom: 4 }}>Latest Result</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, ...autoContrastText, fontWeight: 600 }}>
      <img src={data.lastResult.homeCrest} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
      {data.lastResult.homeTeam} {data.lastResult.homeScore} - {data.lastResult.awayScore} {data.lastResult.awayTeam}
      <img src={data.lastResult.awayCrest} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
    </div>
    {data.lastResult.id && (
      <HighlightsButton
        session={session}
        match={{ id: data.lastResult.id, homeTeam: data.lastResult.homeTeam, awayTeam: data.lastResult.awayTeam }}
        onSelectVideo={onSelectVideo}
      />
    )}
  </div>
)}

      {!newsLoading && articles.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, ...autoContrastText, opacity: 0.6, marginBottom: 6 }}>Latest News</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
            {articles.slice(0, expanded ? 6 : 3).map((a, i) => (
              <button
                key={i}
                onClick={() => setOpenArticle(a)}
                style={{
                  flexShrink: 0, width: 160, borderRadius: 12, overflow: 'hidden', position: 'relative',
                  background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'left',
                  padding: 0, cursor: 'pointer', fontFamily: 'inherit', height: 140,
                }}
              >
                {a.image && (
                  <img src={a.image} alt="" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                {/* Solid dark scrim so caption text is always legible over any photo, in any theme */}
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0, padding: '20px 8px 8px',
                  background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.9))',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {a.title}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>{a.source}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {data.standing && (
        <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, ...autoContrastText, opacity: 0.6 }}>League Position</div>
            <div style={{ fontSize: 13, fontWeight: 700, ...autoContrastText }}>
              #{data.standing.position} · {data.standing.points} pts
            </div>
          </div>
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
