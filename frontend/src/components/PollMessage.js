import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'
import './ChatCards.css'

const Check = () => (
  <svg className="cc-tick" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8.5l3.2 3.2L13 4.5" />
  </svg>
)

export default function PollMessage({ message, currentUserId }) {
  const [poll, setPoll] = useState(null)
  const [options, setOptions] = useState([])
  const [votes, setVotes] = useState([]) // all votes for this poll
  const [myVotes, setMyVotes] = useState([]) // option ids I voted for
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const voting = useRef(false)

  const loadVotes = useCallback(async () => {
    if (!message.poll_id) return
    const { data, error: votesErr } = await supabase
      .from('poll_votes')
      .select('*')
      .eq('poll_id', message.poll_id)

    if (votesErr) {
      console.error('loadVotes failed:', votesErr)
      return
    }
    setVotes(data || [])
    setMyVotes((data || []).filter((v) => v.user_id === currentUserId).map((v) => v.option_id))
  }, [message.poll_id, currentUserId])

  const loadPoll = useCallback(async () => {
    if (!message.poll_id) return
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
  }, [message.poll_id, loadVotes])

  // ── load poll data & subscribe ─────────────────────────────────────────────
  useEffect(() => {
    if (!message.poll_id) return
    loadPoll()

    const unsubscribe = subscribeToChannel(
      `poll-votes:${message.poll_id}`,
      (channel, emit) =>
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'poll_votes',
            filter: `poll_id=eq.${message.poll_id}`,
          },
          (payload) => emit('change', payload)
        ),
      {
        onEvent: loadVotes,
        onResync: loadPoll,
      }
    )
    return () => unsubscribe?.()
  }, [message.poll_id, loadPoll, loadVotes])

  // optimistic: the vote shows instantly, then we sync with the server
  const vote = async (optionId) => {
    if (voting.current || !poll) return
    if (poll.ends_at && new Date(poll.ends_at) < new Date()) return

    voting.current = true
    const mine = (v) => v.user_id === currentUserId
    const alreadyVoted = myVotes.includes(optionId)

    let next
    if (alreadyVoted) {
      next = votes.filter((v) => !(mine(v) && v.option_id === optionId))
    } else {
      const base = poll.allows_multiple ? votes : votes.filter((v) => !mine(v))
      next = [...base, { id: `tmp-${optionId}`, poll_id: message.poll_id, option_id: optionId, user_id: currentUserId }]
    }
    setVotes(next)
    setMyVotes(next.filter(mine).map((v) => v.option_id))

    try {
      if (alreadyVoted) {
        // unvote
        const { error: delErr } = await supabase
          .from('poll_votes')
          .delete()
          .eq('poll_id', message.poll_id)
          .eq('option_id', optionId)
          .eq('user_id', currentUserId)
        if (delErr) throw delErr
      } else {
        if (!poll.allows_multiple) {
          // single choice: remove previous vote first
          const { error: clearErr } = await supabase
            .from('poll_votes')
            .delete()
            .eq('poll_id', message.poll_id)
            .eq('user_id', currentUserId)
          if (clearErr) throw clearErr
        }
        // cast vote
        const { error: insErr } = await supabase
          .from('poll_votes')
          .insert({ poll_id: message.poll_id, option_id: optionId, user_id: currentUserId })
        if (insErr) throw insErr
      }
    } catch (err) {
      console.error('Vote failed:', err)
    }
    await loadVotes() // reconciles with the server, and reverts the optimistic vote on failure
    voting.current = false
  }

  if (loading) {
    return (
      <div className="cc cc-card" aria-busy="true">
        <div className="cc-skel" style={{ width: '70%', marginBottom: 14 }} />
        <div className="cc-skel" style={{ height: 44, borderRadius: 12, marginBottom: 8 }} />
        <div className="cc-skel" style={{ height: 44, borderRadius: 12 }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="cc cc-card">
        <div className="cc-errtext">Couldn't load this poll.</div>
        <button type="button" className="cc-retry" onClick={() => { setLoading(true); loadPoll() }}>
          Try again
        </button>
      </div>
    )
  }

  if (!poll) return null

  const isExpired = !!(poll.ends_at && new Date(poll.ends_at) < new Date())
  // percentages are out of people who voted, so multi-choice polls read naturally
  const voters = new Set(votes.map((v) => v.user_id)).size
  const hint = isExpired ? 'Voting closed' : poll.allows_multiple ? 'Choose one or more' : 'Choose one'

  return (
    <div className="cc cc-card">
      <div className="pl-q">{poll.question}</div>
      <div className="pl-hint">{hint}</div>

      <div className="pl-opts">
        {options.map((opt) => {
          const optVotes = votes.filter((v) => v.option_id === opt.id).length
          const pct = voters > 0 ? Math.round((optVotes / voters) * 100) : 0
          const voted = myVotes.includes(opt.id)

          return (
            <button
              key={opt.id}
              type="button"
              className={`pl-opt${voted ? ' is-voted' : ''}`}
              onClick={() => vote(opt.id)}
              disabled={isExpired}
              aria-pressed={voted}
              title={`${optVotes} ${optVotes === 1 ? 'vote' : 'votes'}`}
            >
              <span className="pl-fill" style={{ width: `${pct}%` }} />
              <span className="pl-inner">
                <span className={`pl-mark${poll.allows_multiple ? ' is-multi' : ''}`}><Check /></span>
                <span className="pl-label">{opt.text}</span>
                {voters > 0 && <span className="pl-pct">{pct}%</span>}
              </span>
            </button>
          )
        })}
      </div>

      <div className="pl-foot">
        {voters === 0 ? 'Be the first to vote' : `${voters} ${voters === 1 ? 'person' : 'people'} voted`}
      </div>
    </div>
  )
}
