import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFootballData } from '../../hooks/useFootballData'
import { useTeamNews } from '../../hooks/useTeamNews'
import { supabase } from '../../lib/supabase'

function formatMatchDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export default function TeamSection({ userId, teamId, onChangeTeam }) {
  const { data, loading, error } = useFootballData(teamId)
  const [expanded, setExpanded] = useState(false)
  const teamName = data?.team?.shortName || data?.team?.name
  const { articles, loading: newsLoading } = useTeamNews(teamId, teamName)

  const clearTeam = async () => {
    await supabase.from('profiles').update({ favorite_pl_team: null }).eq('id', userId)
    onChangeTeam(null)
  }

  if (loading && !data) {
    return (
      <div style={{ borderRadius: 18, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-muted)' }}>
        Loading your team…
      </div>
    )
  }

  if (error && !data) {
    return (
      <div style={{ borderRadius: 18, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12.5, color: '#f87171' }}>Couldn't load your team right now.</div>
        <button onClick={clearTeam} style={{ marginTop: 8, fontSize: 12, color: '#c4b5fd', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          Change team
        </button>
      </div>
    )
  }

  return (
    <motion.div layout style={{ borderRadius: 18, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={data.team.crest} alt={data.team.name} style={{ width: 30, height: 30, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Your Team</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{data.team.name}</div>
          </div>
        </div>
        <button onClick={clearTeam} title="Change team" style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Change
        </button>
      </div>

      {data.nextMatch && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Next Match</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
            <img src={data.nextMatch.homeCrest} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
            {data.nextMatch.homeTeam} vs {data.nextMatch.awayTeam}
            <img src={data.nextMatch.awayCrest} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{formatMatchDate(data.nextMatch.utcDate)}</div>
        </div>
      )}

      {data.lastResult && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Latest Result</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
            <img src={data.lastResult.homeCrest} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
            {data.lastResult.homeTeam} {data.lastResult.homeScore} - {data.lastResult.awayScore} {data.lastResult.awayTeam}
            <img src={data.lastResult.awayCrest} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
          </div>
        </div>
      )}

      {!newsLoading && articles.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Latest News</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
            {articles.slice(0, expanded ? 6 : 3).map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{
                flexShrink: 0, width: 160, borderRadius: 12, overflow: 'hidden', background: 'var(--bg-surface-1, #14141f)',
                border: '1px solid var(--border)', textDecoration: 'none', display: 'block',
              }}>
                {a.image && <img src={a.image} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />}
                <div style={{ padding: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 4 }}>{a.source}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {data.standing && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>League Position</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            #{data.standing.position} · {data.standing.points} pts
          </div>
        </div>
      )}

      <AnimatePresence>
        {expanded && data.standing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', marginTop: 8, fontSize: 11.5, color: 'var(--text-secondary)' }}>
            {data.standing.played} played · {data.standing.won}W {data.standing.draw}D {data.standing.lost}L
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={() => setExpanded(v => !v)} style={{ marginTop: 8, fontSize: 11.5, color: '#c4b5fd', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
        {expanded ? 'Show less' : 'See more'}
      </button>
    </motion.div>
  )
}
