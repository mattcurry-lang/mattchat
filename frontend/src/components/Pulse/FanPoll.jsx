import React from 'react'
import { usePoll } from '../../hooks/usePoll'

// Same trick used in TeamSection.jsx/MatchCard.jsx — text auto-inverts
// against whatever is behind it, so it's legible on both light and
// dark themes without needing to know which is active.
const autoContrastText = {
  color: '#ffffff',
  mixBlendMode: 'difference',
}

export default function FanPoll({ matchId, pollType, question, options, userId }) {
  const { results, myVote, totalVotes, loading, submitting, vote } = usePoll(matchId, pollType, options, userId)

  if (loading) return null

  const hasVoted = myVote != null

  return (
    <div style={{
      borderRadius: 16, padding: '14px 14px', background: 'rgba(127,127,127,0.08)',
      border: '1px solid rgba(167,139,250,0.3)',
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, ...autoContrastText, marginBottom: 10 }}>{question}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((opt) => {
          const count = results[opt.key] || 0
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const isMine = myVote === opt.key

          if (!hasVoted) {
            return (
              <button
                key={opt.key}
                onClick={() => vote(opt.key)}
                disabled={submitting || !userId}
                style={{
                  textAlign: 'left', padding: '9px 12px', borderRadius: 10,
                  background: 'rgba(127,127,127,0.08)', border: '1px solid var(--border)',
                  ...autoContrastText, fontSize: 12, fontWeight: 600, cursor: userId ? 'pointer' : 'default',
                  fontFamily: 'inherit', opacity: submitting ? 0.6 : 1,
                }}
              >
                {opt.label}
              </button>
            )
          }

          return (
            <div key={opt.key} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: isMine ? '1px solid #a78bfa' : '1px solid var(--border)' }}>
              <div style={{
                position: 'absolute', inset: 0, width: `${pct}%`,
                background: isMine ? 'linear-gradient(90deg, rgba(167,139,250,0.45), rgba(167,139,250,0.25))' : 'rgba(127,127,127,0.15)',
                transition: 'width 0.4s ease',
              }} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '9px 12px' }}>
                <span style={{ fontSize: 12, fontWeight: isMine ? 800 : 600, ...autoContrastText }}>
                  {opt.label} {isMine && '✓'}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, ...autoContrastText, opacity: 0.65 }}>{pct}%</span>
              </div>
            </div>
          )
        })}
      </div>

      {hasVoted && (
        <div style={{ fontSize: 10, ...autoContrastText, opacity: 0.45, marginTop: 8 }}>
          {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
