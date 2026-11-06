import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { IconKey, IconShield, IconX, IconCopy } from './Icons'

// 1. Modal for users to redeem a pass code in their profile
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

    // Fetch the active pass code from Supabase
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

    // Check if the code has timed out / expired
    if (new Date(passRecord.expires_at) < new Date()) {
      setErrorMsg('This pass code has expired.')
      setLoading(false)
      return
    }

    // Add current user as a participant to the invited conversation
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(5, 5, 12, 0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 380, background: '#100f1d', border: '1px solid rgba(167,139,250,0.3)',
        borderRadius: 20, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.8)', color: '#fff'
      }}>
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

// 2. Modal for managing, generating, and revoking chat pass codes with mutual consent
export default function ChatCodeManager({ conversationId, currentUserId, onClose }) {
  const [activeCodes, setActiveCodes] = useState([])
  const [durationHours, setDurationHours] = useState('2')
  const [consentGiven, setConsentGiven] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadCodes() {
      const { data } = await supabase
        .from('temporary_passes')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('status', 'active')
      if (data) setActiveCodes(data)
    }
    loadCodes()
  }, [conversationId])

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
      setConsentGiven(false)
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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(5, 5, 12, 0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: '#100f1d', border: '1px solid rgba(167,139,250,0.3)',
        borderRadius: 20, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.8)', color: '#fff'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: '#c4b5fd' }}>
            <IconShield size={18} /> Manage Chat Access Codes
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9d97b5', cursor: 'pointer' }}>
            <IconX size={18} />
          </button>
        </div>

        <div style={{ fontSize: 12, color: '#9d97b5', marginBottom: 16, lineHeight: 1.4 }}>
          Generate a time-limited passcode for this chat. Make sure you have mutual consent with your chat partner before sharing.
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#d1cde6', marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#6c63ff' }}
          />
          I confirm my chat partner consents to sharing access.
        </label>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
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
            {loading ? 'Generating...' : 'Generate New Code'}
          </button>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Active Codes for this Chat:</div>
        {activeCodes.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8b8b9e', textAlign: 'center', padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
            No active codes generated.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
            {activeCodes.map(c => (
              <div key={c.pass_code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: '#4ade80' }}>{c.pass_code}</div>
                  <div style={{ fontSize: 10.5, color: '#9d97b5' }}>Expires: {new Date(c.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(c.pass_code)
                      alert('Pass code copied to clipboard!')
                    }}
                    style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <IconCopy size={12} /> Copy
                  </button>
                  <button
                    onClick={() => handleRevokeCode(c.pass_code)}
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
