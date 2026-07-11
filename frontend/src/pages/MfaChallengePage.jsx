import React, { useState, useEffect } from 'react'
import { supabase, signOut } from '../lib/supabase'

// Shown by App.js right after password sign-in when the account has a
// verified TOTP factor but the current session hasn't been elevated to
// AAL2 yet. Blocks entry into the app until a valid authenticator code
// is provided — this is the actual sign-in-time enforcement of 2FA.
export default function MfaChallengePage({ onVerified }) {
  const [factorId, setFactorId] = useState(null)
  const [code, setCode]         = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      const verified = (data?.totp || []).find(f => f.status === 'verified')
      if (verified) setFactorId(verified.id)
      else setError('No verified authenticator found for this account.')
      setLoading(false)
    })
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!factorId || code.trim().length < 6) return
    setBusy(true); setError('')
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
      if (chErr) throw chErr
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId, challengeId: challenge.id, code: code.trim(),
      })
      if (vErr) throw vErr
      onVerified()
    } catch (err) {
      setError('Incorrect code — check your authenticator app and try again.')
      setCode('')
    }
    setBusy(false)
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.icon}>🔐</div>
        <div style={s.title}>Two-factor authentication</div>
        <div style={s.sub}>Enter the 6-digit code from your authenticator app to finish signing in.</div>

        {loading ? (
          <div style={s.sub}>Loading…</div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoFocus
              disabled={!factorId}
              style={s.input}
            />
            {error && <div style={s.error}>{error}</div>}
            <button type="submit" style={s.btn} disabled={busy || !factorId || code.length < 6}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        )}

        <button style={s.linkBtn} onClick={signOut}>← Sign in with a different account</button>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0f0e17', padding: 20,
  },
  card: {
    width: '100%', maxWidth: 360, background: '#1c1830', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20, padding: '32px 26px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 8, textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
  },
  icon: { fontSize: 32, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: 800, color: '#fff' },
  sub: { fontSize: 13, color: '#9ca3af', lineHeight: 1.5, marginBottom: 10 },
  input: {
    fontSize: 22, letterSpacing: '0.3em', textAlign: 'center', padding: '12px 14px',
    borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
    color: '#fff', fontFamily: 'monospace', width: '100%', boxSizing: 'border-box',
  },
  btn: {
    background: 'var(--brand-grad, linear-gradient(135deg,#6c63ff,#a78bfa))', border: 'none',
    borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, padding: '11px 14px', cursor: 'pointer',
  },
  error: { fontSize: 12.5, color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 10px' },
  linkBtn: { marginTop: 14, background: 'none', border: 'none', color: '#a78bfa', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' },
}
