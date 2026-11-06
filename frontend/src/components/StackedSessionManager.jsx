import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { IconKey, IconShield, IconX, IconCopy } from './Icons'

// 1. Modal for users to redeem a pass code
export function ChatCodeRedeemModal({ currentUserId, onJoinSuccess, onClose }) {
  const [passCode, setPassCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleRedeemCode = async (e) => {
    e.preventDefault()
    if (!passCode.trim()) return

    setLoading(true)
    setErrorMsg('')
    const formattedCode = passCode.trim().toUpperCase()

    const { data: passRecord, error } = await supabase
      .from('temporary_passes')
      .select('*')
      .eq('pass_code', formattedCode)
      .eq('status', 'active')
      .maybeSingle()

    if (error || !passRecord) {
      setErrorMsg('Invalid or non-existent pass code.')
      setLoading(false)
      return
    }

    if (new Date(passRecord.expires_at) < new Date()) {
      setErrorMsg('This pass code has expired.')
      setLoading(false)
      return
    }

    const { error: partError } = await supabase
      .from('conversation_participants')
      .upsert({
        conversation_id: passRecord.conversation_id,
        user_id: currentUserId
      }, { onConflict: 'conversation_id,user_id' })

    if (partError) {
      setErrorMsg('Failed to join the chat session.')
      setLoading(false)
      return
    }

    setLoading(false)
    if (typeof onJoinSuccess === 'function') {
      onJoinSuccess(passRecord.conversation_id)
    }
  }

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(5, 5, 12, 0.85)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380, background: '#100f1d', border: '1px solid rgba(167,139,250,0.3)',
          borderRadius: 20, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.8)', color: '#fff'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: '#c4b5fd' }}>
            <IconKey size={18} /> Join Chat via Pass Code
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9d97b5', cursor: 'pointer' }}>
            <IconX size={18} />
          </button>
        </div>

        <div style={{ fontSize: 12, color: '#9d97b5', marginBottom: 16, lineHeight: 1.4 }}>
          Enter the secure guest pass code provided by your chat partner to instantly access the conversation.
        </div>

        <form onSubmit={handleRedeemCode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text"
            value={passCode}
            onChange={(e) => setPassCode(e.target.value)}
            placeholder="e.g. CHAT-7X9"
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(167,139,250,0.3)',
              borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 15, fontFamily: 'monospace',
              textAlign: 'center', letterSpacing: '0.1em', outline: 'none'
            }}
          />

          {errorMsg && (
            <div style={{ fontSize: 11.5, color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: 8, textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, width: '100%', padding: '12px', borderRadius: 12,
              background: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)', color: '#fff',
              border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(108,99,255,0.4)'
            }}
          >
            {loading ? 'Verifying Code...' : 'Enter Secure Chat'}
          </button>
        </form>
      </div>
    </div>
  )
}

// 2. Modal with permanent starting code box positioned right above the consent box
export default function ChatCodeManager({ conversationId, currentUserId, onClose }) {
  const [activeCodes, setActiveCodes] = useState([])
  const [durationHours, setDurationHours] = useState('2')
  const [consentGiven, setConsentGiven] = useState(true)
  const [loading, setLoading] = useState(false)

  // Auto-fetch or generate starting code on load
  useEffect(() => {
    async function initCodes() {
      if (!conversationId || !currentUserId) return
      setLoading(true)
      const { data } = await supabase
        .from('temporary_passes')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('status', 'active')

      if (data && data.length > 0) {
        setActiveCodes(data)
      } else {
        const randomHash = Math.random().toString(36).substring(2, 7).toUpperCase()
        const passCode = `CHAT-${randomHash}`
        const expiresAt = new Date(Date.now() + 2 * 3600 * 1000).toISOString()

        const { data: newPass, err } = await supabase.from('temporary_passes').insert({
          pass_code: passCode,
          conversation_id: conversationId,
          creator_id: currentUserId,
          status: 'active',
          expires_at: expiresAt
        }).select().single()

        if (!err && newPass) {
          setActiveCodes([newPass])
        }
      }
      setLoading(false)
    }
    initCodes()
  }, [conversationId, currentUserId])

  const handleGenerateCode = async () => {
    if (!consentGiven) {
      alert('Please confirm mutual consent with your chat partner before generating an access code.')
      return
    }

    setLoading(true)
    const randomHash = Math.random().toString(36).substring(2, 7).toUpperCase()
    const passCode = `CHAT-${randomHash}`
    const hoursNum = parseInt(durationHours) || 2
    const expiresAt = new Date(Date.now() + hoursNum * 3600 * 1000).toISOString()

    const { data, error } = await supabase.from('temporary_passes').insert({
      pass_code: passCode,
      conversation_id: conversationId,
      creator_id: currentUserId,
      status: 'active',
      expires_at: expiresAt
    }).select().single()

    if (!error && data) {
      setActiveCodes(prev => [data, ...prev])
    }
    setLoading(false)
  }

  const handleRevokeCode = async (passCode) => {
    const { error } = await supabase
      .from('temporary_passes')
      .update({ status: 'revoked' })
      .eq('pass_code', passCode)

    if (!error) {
      setActiveCodes(prev => prev.filter(c => c.pass_code !== passCode))
    }
  }

  const primaryCode = activeCodes[0]

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(5, 5, 12, 0.85)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, background: '#100f1d', border: '1px solid rgba(167,139,250,0.3)',
          borderRadius: 20, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.8)', color: '#fff'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: '#c4b5fd' }}>
            <IconShield size={18} /> Manage Chat Access Codes
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9d97b5', cursor: 'pointer' }}>
            <IconX size={18} />
          </button>
        </div>

        <div style={{ fontSize: 12, color: '#9d97b5', marginBottom: 16, lineHeight: 1.4 }}>
          Active session passcode for this chat channel. Share securely with your partner.
        </div>

        {/* PERMANENT STARTING PASSCODE BOX (Placed right above consent box, styled like encryption badge) */}
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(74,222,128,0.05) 0%, rgba(255,255,255,0.02) 100%)', 
          border: '1px solid rgba(74,222,128,0.25)', borderRadius: 14, padding: 14, marginBottom: 16, textAlign: 'center' 
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Active Passcode
          </div>
          <div style={{ 
            background: 'rgba(0,0,0,0.4)', padding: '10px 14px', borderRadius: 10, 
            fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: '#4ade80', 
            letterSpacing: '0.12em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' 
          }}>
            <span>{loading && !primaryCode ? 'GENERATING...' : (primaryCode ? primaryCode.pass_code : 'NO ACTIVE CODE')}</span>
            {primaryCode && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(primaryCode.pass_code)
                  alert('Passcode copied to clipboard!')
                }}
                style={{ background: 'rgba(74,222,128,0.15)', border: 'none', color: '#4ade80', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                Copy
              </button>
            )}
          </div>
        </div>

        {/* CONSENT CHECKBOX & CONTROLS */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#d1cde6', marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#6c63ff' }}
          />
          I confirm my chat partner consents to sharing access.
        </label>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <select
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px', color: '#fff', fontSize: 12, outline: 'none' }}
          >
            <option value="1" style={{ background: '#100f1d' }}>1 Hour Timeout</option>
            <option value="2" style={{ background: '#100f1d' }}>2 Hours Timeout</option>
            <option value="6" style={{ background: '#100f1d' }}>6 Hours Timeout</option>
            <option value="24" style={{ background: '#100f1d' }}>24 Hours Timeout</option>
          </select>

          <button
            onClick={handleGenerateCode}
            disabled={loading || !consentGiven}
            style={{
              flex: 1, padding: '10px', borderRadius: 10,
              background: consentGiven ? 'linear-gradient(135deg, #6c63ff, #a855f7)' : 'rgba(255,255,255,0.08)',
              color: consentGiven ? '#fff' : '#6b6b80', border: 'none', fontWeight: 700, fontSize: 12.5,
              cursor: consentGiven ? 'pointer' : 'not-allowed'
            }}
          >
            {loading ? 'Processing...' : 'Generate New Code'}
          </button>
        </div>
      </div>
    </div>
  )
}
