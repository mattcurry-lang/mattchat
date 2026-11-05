import React, { useState, useEffect } from 'react'
import Avatar from './Avatar'
import { supabase } from '../lib/supabase'
import { IconX, IconMessageSquare, IconSend, IconUserPlus } from './Icons'

// 1. Interactive Pass Card rendered in Chat
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

// 2. Filtered Contact Picker (Only shows current chat partner / active conversation members)
export function PassContactSharePicker({ passDuration, currentUserId, myProfile, targetProfile, conversationId, onClose }) {
  const [sending, setSending] = useState(false)

  const handleSendToActiveChat = async () => {
    if (!targetProfile?.id && !conversationId) return
    setSending(true)

    const randomHash = Math.random().toString(36).substring(2, 8).toUpperCase()
    const hoursNum = parseInt(passDuration) || 2
    const passCode = `MATT-${passDuration.toUpperCase()}-${randomHash}`
    const expiresAt = new Date(Date.now() + hoursNum * 3600 * 1000).toISOString()

    // 1. Insert record into database
    await supabase.from('temporary_passes').insert({
      pass_code: passCode,
      creator_id: currentUserId,
      target_user_id: targetProfile?.id || currentUserId,
      duration_hours: hoursNum,
      status: 'pending',
      expires_at: expiresAt
    })

    // 2. Insert pass card payload into the active conversation
    if (conversationId) {
      const passPayload = JSON.stringify({
        type: 'temporary_pass',
        pass_code: passCode,
        duration: passDuration,
        creator_name: myProfile?.username || 'Mathew',
        expires_at: expiresAt,
        status: 'pending'
      })

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: passPayload,
        message_type: 'text'
      })
    }

    setSending(false)
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
        <div style={{ fontSize: 12.5, color: '#9d97b5', marginBottom: 18, lineHeight: 1.4 }}>
          Send this {passDuration} temporary pass directly to your active chat with <strong style={{ color: '#fff' }}>{targetProfile?.username || 'this contact'}</strong>:
        </div>

        {targetProfile ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={targetProfile.username} photoUrl={targetProfile.avatar_url} size={38} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{targetProfile.username}</div>
                <div style={{ fontSize: 11, color: '#4ade80' }}>Active Chat Partner</div>
              </div>
            </div>
            <button
              disabled={sending}
              onClick={handleSendToActiveChat}
              style={{
                padding: '8px 14px', borderRadius: 10, background: 'linear-gradient(135deg, #6c63ff, #a855f7)',
                color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(108,99,255,0.4)'
              }}
            >
              {sending ? 'Sending...' : 'Send Pass'}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center', padding: 16 }}>No active chat contact selected.</div>
        )}
      </div>
    </div>
  )
}

// 3. Stacked Session Room & Messaging Modal View
export default function StackedSessionModal({ passCode, currentUserId, onClose }) {
  const [hosts, setHosts] = useState([])
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sessionMessages, setSessionMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [inChatMode, setInChatMode] = useState(false)
  const [selectedHost, setSelectedHost] = useState(null)

  useEffect(() => {
    async function loadSession() {
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
        setHosts([
          { id: '1', username: 'Lainey', bio: 'Session Host & Administrator' },
          { id: '2', username: 'Kane', bio: 'Co-Host Participant' }
        ])
      }
      setLoading(false)
    }
    loadSession()
  }, [passCode])

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!inputMessage.trim()) return
    setSessionMessages(prev => [...prev, { id: Date.now(), sender: 'You', text: inputMessage }])
    setInputMessage('')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(4, 4, 10, 0.94)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'fadeIn 0.25s ease-out'
    }}>
      {/* Top Header Bar */}
      <div style={{
        position: 'absolute', top: 24, left: 24, right: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px', borderRadius: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px #4ade80' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.04em' }}>
            {inChatMode ? `SESSION CHAT: @${selectedHost?.username}` : 'STACKED SESSION ROOM'}
          </span>
          <span style={{ fontSize: 11, color: '#a78bfa', fontFamily: 'monospace', background: 'rgba(167,139,250,0.1)', padding: '2px 8px', borderRadius: 6 }}>
            {passCode}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {inChatMode && (
            <button onClick={() => setInChatMode(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Back to Cards
            </button>
          )}
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
            cursor: 'pointer', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <IconX size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Area: Stacked Cards OR Direct Session Chat */}
      {!inChatMode ? (
        <div style={{ position: 'relative', width: '100%', maxWidth: 380, height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 30 }}>
          {loading ? (
            <div style={{ color: '#a78bfa', fontSize: 14, fontWeight: 700 }}>Loading session hosts...</div>
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
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedHost(host)
                      setInChatMode(true)
                    }}
                    style={{
                      marginTop: 'auto', width: '100%', padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)',
                      color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      boxShadow: '0 4px 16px rgba(108,99,255,0.35)'
                    }}
                  >
                    <IconMessageSquare size={15} /> Chat with {host.username}
                  </button>
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* Active Drop-In Chat View */
        <div style={{ width: '100%', maxWidth: 440, height: 460, background: '#11101b', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 24, display: 'flex', flexDirection: 'column', marginTop: 30, overflow: 'hidden' }}>
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessionMessages.length === 0 ? (
              <div style={{ color: '#8b8b9e', fontSize: 12.5, textAlign: 'center', marginTop: 80 }}>
                Secure session established with {selectedHost?.username}. Send a message below!
              </div>
            ) : (
              sessionMessages.map(m => (
                <div key={m.id} style={{ alignSelf: m.sender === 'You' ? 'flex-end' : 'flex-start', background: m.sender === 'You' ? '#6c63ff' : 'rgba(255,255,255,0.06)', color: '#fff', padding: '10px 14px', borderRadius: 14, maxWidth: '80%', fontSize: 13 }}>
                  {m.text}
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', padding: 12, background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.06)', gap: 8 }}>
            <input 
              type="text" 
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Message ${selectedHost?.username}...`}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' }}
            />
            <button type="submit" style={{ background: '#6c63ff', border: 'none', borderRadius: 10, width: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
              <IconSend size={16} />
            </button>
          </form>
        </div>
      )}

      <div style={{ fontSize: 12, color: '#8b8b9e', marginTop: 24, textAlign: 'center' }}>
        {!inChatMode ? 'Click stacked cards to switch focus or jump into session chat.' : `Connected to secure room channel with ${selectedHost?.username}`}
      </div>
    </div>
  )
}
