import React, { useState, useEffect } from 'react'
import Avatar from './Avatar'
import { supabase } from '../lib/supabase'
import { IconX, IconMessageSquare, IconSend, IconUserPlus } from './Icons'

// 1. Interactive Pass Card in Chat
export function TemporaryPassCard({ passData, currentUserId, onJoinSession }) {
  const [status, setStatus] = useState(passData.status || 'pending')
  const [loading, setLoading] = useState(false)

  const handleAction = async (newStatus) => {
    setLoading(true)
    const { error } = await supabase
      .from('temporary_passes')
      .update({ status: newStatus })
      .eq('pass_code', passData.pass_code)

    if (!error) {
      setStatus(newStatus)
      if (newStatus === 'accepted') {
        onJoinSession?.(passData)
      }
    }
    setLoading(false)
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(108,99,255,0.18) 0%, rgba(167,139,250,0.08) 100%)',
      border: '1px solid rgba(167,139,250,0.35)',
      borderRadius: 18,
      padding: 16,
      maxWidth: 320,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px #4ade80' }} />
        <span style={{ fontSize: 11.5, fontWeight: 800, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Temporary Chat Pass
        </span>
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', lineHeight: 1.4 }}>
        {passData.creator_name} invited you to join an active secure session for {passData.duration}.
      </div>

      <div style={{ fontSize: 11, color: '#9d97b5', fontFamily: 'monospace', background: 'rgba(0,0,0,0.25)', padding: '6px 10px', borderRadius: 8 }}>
        Pass Code: {passData.pass_code}
      </div>

      {status === 'pending' ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <button
            disabled={loading}
            onClick={() => handleAction('accepted')}
            style={{
              flex: 1, padding: '10px', borderRadius: 12, background: 'linear-gradient(135deg, #4ade80, #22c55e)', color: '#090911',
              border: 'none', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', boxShadow: '0 4px 14px rgba(74,222,128,0.3)'
            }}
          >
            {loading ? 'Joining…' : 'Join Chat'}
          </button>
          <button
            disabled={loading}
            onClick={() => handleAction('declined')}
            style={{
              flex: 1, padding: '10px', borderRadius: 12, background: 'rgba(239,68,68,0.15)', color: '#f87171',
              border: '1px solid rgba(239,68,68,0.3)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer'
            }}
          >
            Decline
          </button>
        </div>
      ) : (
        <button
          onClick={() => onJoinSession?.(passData)}
          style={{
            width: '100%', padding: '11px', borderRadius: 12, background: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)', color: '#fff',
            border: 'none', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 16px rgba(108,99,255,0.45)'
          }}
        >
          <IconMessageSquare size={16} /> Enter Stacked Session Room
        </button>
      )}
    </div>
  )
}

// 2. Contact Share Picker Modal (Generates & Sends Pass to Selected Contact)
export function PassContactSharePicker({ passDuration, currentUserId, myProfile, targetProfile, onClose }) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState(null)

  useEffect(() => {
    async function loadContacts() {
      const { data } = await supabase.from('profiles').select('id, username, avatar_url').neq('id', currentUserId)
      if (data) setContacts(data)
      setLoading(false)
    }
    loadContacts()
  }, [currentUserId])

  const handleSendToUser = async (contact) => {
    setSendingId(contact.id)
    const randomHash = Math.random().toString(36).substring(2, 8).toUpperCase()
    const hoursNum = parseInt(passDuration) || 2
    const passCode = `MATT-${passDuration.toUpperCase()}-${randomHash}`
    const expiresAt = new Date(Date.now() + hoursNum * 3600 * 1000).toISOString()

    // Save pass backend record
    await supabase.from('temporary_passes').insert({
      pass_code: passCode,
      creator_id: currentUserId,
      target_user_id: contact.id,
      duration_hours: hoursNum,
      status: 'pending',
      expires_at: expiresAt
    })

    // Find conversation with target contact or create new message
    const { data: convos } = await supabase.from('conversations').select('id').limit(1)
    const convoId = convos?.[0]?.id

    if (convoId) {
      const passPayload = JSON.stringify({
        type: 'temporary_pass',
        pass_code: passCode,
        duration: passDuration,
        creator_name: myProfile?.username || 'Mathew',
        expires_at: expiresAt,
        status: 'pending'
      })

      await supabase.from('messages').insert({
        conversation_id: convoId,
        sender_id: currentUserId,
        content: passPayload,
        message_type: 'text'
      })
    }

    setSendingId(null)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 12000,
      background: 'rgba(5, 5, 12, 0.85)', backdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 360, background: '#100f1d', border: '1px solid rgba(167,139,250,0.3)',
        borderRadius: 20, padding: 20, boxShadow: '0 20px 50px rgba(0,0,0,0.8)', color: '#fff'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#c4b5fd' }}>Share Access Pass</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9d97b5', cursor: 'pointer' }}>
            <IconX size={18} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#9d97b5', marginBottom: 14 }}>
          Select a contact to invite them into this session for {passDuration}:
        </div>
        {loading ? (
          <div style={{ fontSize: 12, color: '#a78bfa', textAlign: 'center', padding: 20 }}>Loading contacts...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
            {contacts.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={c.username} photoUrl={c.avatar_url} size={34} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{c.username}</span>
                </div>
                <button
                  disabled={sendingId === c.id}
                  onClick={() => handleSendToUser(c)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, background: 'linear-gradient(135deg, #6c63ff, #a855f7)',
                    color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer'
                  }}
                >
                  {sendingId === c.id ? 'Sending...' : 'Send Pass'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// 3. Stacked Profile Room Modal View
export default function StackedSessionModal({ passCode, onClose }) {
  const [hosts, setHosts] = useState([])
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadHosts() {
      if (!passCode) return
      const { data: passData } = await supabase
        .from('temporary_passes')
        .select('creator_id, target_user_id')
        .eq('pass_code', passCode)
        .maybeSingle()

      if (passData) {
        const ids = [passData.creator_id, passData.target_user_id].filter(Boolean)
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids)
        if (profiles) setHosts(profiles)
      } else {
        // Fallback demo stack if pass is local state
        setHosts([
          { id: '1', username: 'Lainey', bio: 'Session Host & Administrator' },
          { id: '2', username: 'Kane', bio: 'Co-Host Drop-in Participant' }
        ])
      }
      setLoading(false)
    }
    loadHosts()
  }, [passCode])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(4, 4, 10, 0.92)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'fadeIn 0.25s ease-out'
    }}>
      <div style={{
        position: 'absolute', top: 24, left: 24, right: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px', borderRadius: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px #4ade80' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.04em' }}>
            STACKED SESSION ROOM
          </span>
          <span style={{ fontSize: 11, color: '#a78bfa', fontFamily: 'monospace', background: 'rgba(167,139,250,0.1)', padding: '2px 8px', borderRadius: 6 }}>
            {passCode}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
          cursor: 'pointer', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <IconX size={16} />
        </button>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 380, height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 30 }}>
        {loading ? (
          <div style={{ color: '#a78bfa', fontSize: 14, fontWeight: 700 }}>Loading stacked profiles...</div>
        ) : (
          hosts.map((host, idx) => {
            const isTop = idx === activeCardIndex
            return (
              <div
                key={host.id || idx}
                onClick={() => setActiveCardIndex(idx)}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: 440,
                  background: 'linear-gradient(180deg, #131324 0%, #0a0a14 100%)',
                  border: '1px solid rgba(167, 139, 250, 0.35)',
                  borderRadius: 24,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  boxShadow: isTop ? '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(108,99,255,0.25)' : '0 10px 20px rgba(0,0,0,0.5)',
                  transform: isTop ? 'translateY(0) scale(1)' : 'translateY(-28px) scale(0.92)',
                  zIndex: isTop ? 10 : 5 - idx,
                  transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: 'pointer',
                  opacity: isTop ? 1 : 0.6
                }}
              >
                <div style={{ borderRadius: '50%', padding: 4, background: 'linear-gradient(135deg, #6c63ff, #a855f7)', boxShadow: '0 10px 30px rgba(108,99,255,0.4)', marginBottom: 16 }}>
                  <Avatar name={host.username} photoUrl={host.avatar_url} size={90} />
                </div>

                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                  {host.username || 'Host'}
                </div>
                <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600, marginBottom: 14 }}>
                  @{host.username?.toLowerCase() || 'host'} • Co-Host
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, width: '100%', marginBottom: 16, fontSize: 12.5, color: '#d1cde6', lineHeight: 1.4 }}>
                  {host.bio || 'Participating in this secure temporary drop-in session.'}
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  style={{
                    marginTop: 'auto', width: '100%', padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)',
                    color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  <IconMessageSquare size={15} /> Chat with {host.username}
                </button>
              </div>
            )
          })
        )}
      </div>

      <div style={{ fontSize: 12, color: '#8b8b9e', marginTop: 24, textAlign: 'center' }}>
        Click stacked cards to switch focus between session hosts.
      </div>
    </div>
  )
}
