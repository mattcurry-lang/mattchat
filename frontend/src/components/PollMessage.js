import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PollMessage({ message, currentUserId }) {
  const [poll, setPoll] = useState(null)
  const [options, setOptions] = useState([])
  const [votes, setVotes] = useState([]) // all votes for this poll
  const [myVotes, setMyVotes] = useState([]) // option ids I voted for
  const [voting, setVoting] = useState(false)
  const [loading, setLoading] = useState(true)

  // ── load poll data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!message.poll_id) return
    loadPoll()

    // realtime: update votes live
    const channel = supabase
      .channel(`poll:${message.poll_id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'poll_votes',
        filter: `poll_id=eq.${message.poll_id}`
      }, () => loadVotes())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [message.poll_id])

  const loadPoll = async () => {
    const [{ data: pollData }, { data: optData }] = await Promise.all([
      supabase.from('polls').select('*').eq('id', message.poll_id).single(),
      supabase.from('poll_options').select('*').eq('poll_id', message.poll_id).order('position'),
    ])
    setPoll(pollData)
    setOptions(optData || [])
    await loadVotes()
    setLoading(false)
  }

  const loadVotes = async () => {
    const { data } = await supabase
      .from('poll_votes')
      .select('*')
      .eq('poll_id', message.poll_id)
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
              <div style={{ ...s.fill, width: `${pct}%`, background: voted ? '#7C6FF7' : 'rgba(255,255,255,0.2)' }} />
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
    background: '#1e1b4b', borderRadius: 16, padding: '14px 16px',
    maxWidth: 300, minWidth: 220,
  },
  question: { fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4, lineHeight: 1.4 },
  hint: { fontSize: 11, color: '#888', marginBottom: 10 },
  option: {
    display: 'block', width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
    padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
    textAlign: 'left', transition: 'border-color 0.15s',
  },
  optionVoted: { borderColor: '#7C6FF7', background: 'rgba(124,111,247,0.12)' },
  optionTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  optionText: { fontSize: 13, color: '#fff', fontWeight: 500 },
  optionPct: { fontSize: 12, color: '#aaa', flexShrink: 0 },
  track: { height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  fill: { height: '100%', borderRadius: 2, transition: 'width 0.3s ease' },
  optionVotes: { fontSize: 11, color: '#666' },
  footer: { display: 'flex', gap: 8, fontSize: 11, color: '#666', marginTop: 4, flexWrap: 'wrap' },
  loading: { color: '#666', fontSize: 13, padding: 12 },
}
