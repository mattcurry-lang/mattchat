import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

export default function PollMessage({ message, currentUserId }) {
  const [poll, setPoll] = useState(null)
  const [options, setOptions] = useState([])
  const [votes, setVotes] = useState([]) // all votes for this poll
  const [myVotes, setMyVotes] = useState([]) // option ids I voted for
  const [voting, setVoting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // ── load poll data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!message.poll_id) return
    loadPoll()
 const unsubscribe = subscribeToChannel(
      `poll-votes:${message.poll_id}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'poll_votes',
        filter: `poll_id=eq.${message.poll_id}`,
      }, (payload) => emit('change', payload)),
      {
        onEvent: loadVotes,
        // If the poll failed to load earlier (or a drop caused us to
        // miss votes), a reconnect re-fetches everything from scratch
        // instead of leaving the card permanently blank.
        onResync: loadPoll,
      }
    )
    return unsubscribe
    
  }, [message.poll_id])

setError(false)
    try {
      const [{ data: pollData, error: pollErr }, { data: optData, error: optErr }] = await Promise.all([
        supabase.from('polls').select('*').eq('id', message.poll_id).single(),
        supabase.from('poll_options').select('*').eq('poll_id', message.poll_id).order('position'),
      ])
      if (pollErr) throw pollErr
      if (optErr) throw optErr
      setPoll(pollData)
      setOptions(optData || [])
      await loadVotes()
    } catch (err) {
      console.error('loadPoll failed:', err)
      setError(true)
    }
   setLoading(false)
  }

  const loadVotes = async () => {
    const { data, error: votesErr } = await supabase
      .from('poll_votes')
      .select('*')
      .eq('poll_id', message.poll_id)
    if (votesErr) { console.error('loadVotes failed:', votesErr); return }
    setVotes(data || [])
    setMyVotes((data || []).filter(v => v.user_id === currentUserId).map(v => v.option_id))
  }

  const vote = async (optionId) => {
    if (voting) return
    const isExpired = poll?.ends_at && new Date(poll.ends_at) < new Date()
    if (isExpired) return

    setVoting(true)
    try {
      const alreadyVoted = myVotes.includes(optionId)

      if (alreadyVoted) {
        // unvote
        await supabase.from('poll_votes')
          .delete()
          .eq('poll_id', message.poll_id)
          .eq('option_id', optionId)
          .eq('user_id', currentUserId)
      } else {
        if (!poll.allows_multiple) {
          // single choice: remove previous vote first
          await supabase.from('poll_votes')
            .delete()
            .eq('poll_id', message.poll_id)
            .eq('user_id', currentUserId)
        }
        // cast vote
        await supabase.from('poll_votes')
          .insert({ poll_id: message.poll_id, option_id: optionId, user_id: currentUserId })
      }
      await loadVotes()
    } catch (err) {
      console.error('Vote failed:', err)
    }
    setVoting(false)
  }

  if (loading) return <div style={s.loading}>Loading poll…</div>
if (error) {
   return (
      <div style={s.wrap}>
        <div style={s.errorText}>Couldn't load this poll.</div>
        <button style={s.retryBtn} onClick={() => { setLoading(true); loadPoll() }}>Retry</button>
      </div>
    )
  }
  if (!poll) return null

  const totalVotes = votes.length
  const isExpired = poll.ends_at && new Date(poll.ends_at) < new Date()

  return (
    <div style={s.wrap}>
      {/* question */}
      <div style={s.question}>{poll.question}</div>

      {poll.allows_multiple && (
        <div style={s.hint}>Select all that apply</div>
      )}

      {/* options */}
      {options.map(opt => {
        const optVotes = votes.filter(v => v.option_id === opt.id).length
        const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0
        const voted = myVotes.includes(opt.id)

        return (
          <button
            key={opt.id}
            style={{ ...s.option, ...(voted ? s.optionVoted : {}) }}
            onClick={() => vote(opt.id)}
            disabled={voting || isExpired}
          >
            <div style={s.optionTop}>
              <span style={s.optionText}>{opt.text}</span>
              <span style={s.optionPct}>{pct}%</span>
            </div>
            {/* progress bar */}
            <div style={s.track}>
              <div style={{ ...s.fill, width: `${pct}%`, background: voted ? 'var(--brand)' : 'rgba(255,255,255,0.2)' }} />
            </div>
            <div style={s.optionVotes}>{optVotes} {optVotes === 1 ? 'vote' : 'votes'}</div>
          </button>
        )
      })}

      {/* footer */}
      <div style={s.footer}>
        <span>{totalVotes} total vote{totalVotes !== 1 ? 's' : ''}</span>
        {isExpired && <span style={{ color: '#ef4444' }}>• Ended</span>}
        {poll.allows_multiple && !isExpired && <span>• Multiple choice</span>}
      </div>
    </div>
  )
}

const s = {
  wrap: {
   background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px',
    maxWidth: 300, minWidth: 220,
  },
 question: { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.4 },
 hint: { fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 },
  option: {
    display: 'block', width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
    padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
    textAlign: 'left', transition: 'border-color 0.15s',
  },
  optionVoted: { borderColor: 'var(--brand)', background: 'var(--brand-soft)' },
  optionTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  optionText: { fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 },
 optionPct: { fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 },
  track: { height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  fill: { height: '100%', borderRadius: 2, transition: 'width 0.3s ease' },
optionVotes: { fontSize: 11, color: 'var(--text-muted)' },
  footer: { display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)', marginTop: 4, flexWrap: 'wrap' },
  loading: { color: 'var(--text-muted)', fontSize: 13, padding: 12 },
  errorText: { color: '#f87171', fontSize: 12.5, marginBottom: 8 },
 retryBtn: { background: 'var(--brand-soft)', border: '1px solid var(--brand)', borderRadius: 8, color: 'var(--brand)', fontSize: 12.5, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' },
 }
