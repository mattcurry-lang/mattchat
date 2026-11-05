import React, { useState, useEffect } from 'react'
import Avatar from './Avatar'
import { supabase } from '../lib/supabase'
import { IconShield, IconX, IconMessageSquare, IconSparkle } from './Icons'

// 1. The Interactive Pass Card rendered inside the message thread
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
      if (newStatus === 'accepted' && onJoinSession) {
        onJoinSession(passData)
      }
    }
    setLoading(false)
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(108,99,255,0.15) 0%, rgba(167,139,250,0.06) 100%)',
      border: '1px solid rgba(167,139,250,0.35)',
      borderRadius: 18,
      padding: 16,
      maxWidth: 320,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
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

      <div style={{ fontSize: 11, color: '#9d97b5', fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: 8 }}>
        Pass Code: {passData.pass_code}
      </div>

      {status === 'pending' && (
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
      )}

      {status === 'accepted' && (
        <button
          onClick={() => onJoinSession?.(passData)}
          style={{
            width: '100%', padding: '10px', borderRadius: 12, background: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)', color: '#fff',
            border: 'none', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: '0 4px 16px rgba(108,99,255,0.4)'
          }}
        >
          <IconMessageSquare size={15} /> Enter Stacked Session Room
        </button>
      )}

      {status === 'declined' && (
        <div style={{ padding: '8px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
          ✕ Pass Declined
        </div>
      )}
    </div>
  )
}

// 2. The Fully Functional Stacked Profile Cards Modal View
export default function StackedSessionModal({ passCode, currentUserId, onClose }) {
  const [hosts, setHosts] = useState([])
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSessionHosts() {
      if (!passCode) return
      // Query pass details from backend
      const { data: passData } = await supabase
        .from('temporary_passes')
        .select('creator_id, target_user_id')
        .eq('pass_code', passCode)
        .maybeSingle()

      if (passData) {
        const userIds = [passData.creator_id, passData.target_user_id].filter(Boolean)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds)

        if (profiles) {
          setHosts(profiles)
        }
      }
      setLoading(false)
    }
    fetchSessionHosts()
  }, [passCode])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(4, 4, 10, 0.9)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'fadeIn 0.3s ease'
    }}>
      {/* Top Header Bar */}
      <div style={{
        position: 'absolute', top: 24, left: 24, right: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px', borderRadius: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px #4ade80' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.04em' }}>
            ACTIVE TEMPORARY DROP-IN SESSION
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

      {/* Stacked Cards Container */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 380, height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 30 }}>
        {loading ? (
          <div style={{ color: '#a78bfa', fontSize: 14, fontWeight: 700 }}>Loading session hosts...</div>
        ) : hosts.length === 0 ? (
          <div style={{ color: '#9d97b5', fontSize: 14 }}>No active hosts found for this pass code.</div>
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
                  border: '1px solid rgba(167, 139, 250, 0.3)',
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
                  @{host.username?.toLowerCase() || 'host'} • Drop-In Co-Host
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, width: '100%', marginBottom: 16, fontSize: 12.5, color: '#d1cde6', lineHeight: 1.4, maxHeight: 80, overflowY: 'auto' }}>
                  {host.bio || 'Participating in this secure temporary drop-in session.'}
                </div>

                <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 'auto' }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      onClose()
                    }}
                    style={{
                      flex: 1, padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)',
                      color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      boxShadow: '0 4px 16px rgba(108,99,255,0.35)'
                    }}
                  >
                    <IconMessageSquare size={15} /> Direct Chat with {host.username}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div style={{ fontSize: 12, color: '#8b8b9e', marginTop: 24, textAlign: 'center' }}>
        Click stacked cards to switch focus between session co-hosts.
      </div>
    </div>
  )
}
