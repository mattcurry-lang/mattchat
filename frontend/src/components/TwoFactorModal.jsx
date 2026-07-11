import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Two-factor authentication setup, built on Supabase Auth's native MFA
// support (TOTP — Google Authenticator / Authy / 1Password etc). No
// custom OTP backend needed: supabase.auth.mfa handles enroll →
// challenge → verify, and once a factor is verified the user's session
// is elevated to AAL2. Sign-in-time enforcement lives in App.js
// (MfaChallengePage), which gates entry into the app until AAL2 is met
// for accounts with a verified factor.
export default function TwoFactorModal({ onClose }) {
  const [loading, setLoading]         = useState(true)
  const [factor, setFactor]           = useState(null)   // verified TOTP factor, if any
  const [enrolling, setEnrolling]     = useState(false)
  const [enrollData, setEnrollData]   = useState(null)    // { factorId, qrCode, secret }
  const [code, setCode]               = useState('')
  const [busy, setBusy]               = useState(false)
  const [error, setError]             = useState('')
  const [justEnabled, setJustEnabled] = useState(false)

  const loadFactors = async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (!error) {
      const verified = (data?.totp || []).find(f => f.status === 'verified')
      setFactor(verified || null)
    }
    setLoading(false)
  }

  useEffect(() => { loadFactors() }, [])

  const startEnroll = async () => {
    setError(''); setBusy(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Mattchat ${new Date().toISOString().slice(0, 10)}`,
      })
      if (error) throw error
      setEnrollData({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
      setEnrolling(true)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  const cancelEnroll = async () => {
    // Enroll() creates an unverified factor right away — clean it up if
    // the user backs out instead of leaving an orphaned pending factor.
    if (enrollData?.factorId) {
      try { await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId }) } catch {}
    }
    setEnrollData(null)
    setEnrolling(false)
    setCode('')
    setError('')
  }

  const confirmEnroll = async (e) => {
    e.preventDefault()
    if (!enrollData || code.trim().length < 6) return
    setError(''); setBusy(true)
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId })
      if (chErr) throw chErr
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      })
      if (vErr) throw vErr

      setEnrolling(false)
      setEnrollData(null)
      setCode('')
      setJustEnabled(true)
      await loadFactors()
    } catch (err) {
      setError(err.message || 'Invalid code — check your authenticator app and try again.')
    }
    setBusy(false)
  }

  const disable2FA = async () => {
    if (!factor) return
    if (!window.confirm('Turn off two-factor authentication? Your account will only be protected by your password.')) return
    setBusy(true); setError('')
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (error) throw error
      setJustEnabled(false)
      await loadFactors()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <div style={s.title}>🔐 Two-factor authentication</div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={s.muted}>Checking your security settings…</div>
        ) : enrolling ? (
          <form onSubmit={confirmEnroll} style={s.body}>
            <div style={s.step}>1. Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password…)</div>
            <div style={s.qrWrap}>
              <img src={enrollData.qrCode} alt="2FA QR code" style={s.qrImg} />
            </div>
            <div style={s.step}>Can't scan it? Enter this key manually:</div>
            <div style={s.secretBox}>{enrollData.secret}</div>
            <div style={s.step}>2. Enter the 6-digit code your app shows:</div>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoFocus
              style={s.codeInput}
            />
            {error && <div style={s.error}>{error}</div>}
            <div style={s.btnRow}>
              <button type="button" style={s.secondaryBtn} onClick={cancelEnroll} disabled={busy}>Cancel</button>
              <button type="submit" style={s.primaryBtn} disabled={busy || code.length < 6}>
                {busy ? 'Verifying…' : 'Verify & enable'}
              </button>
            </div>
          </form>
        ) : factor ? (
          <div style={s.body}>
            <div style={s.statusRow}>
              <span style={s.statusDot} />
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>2FA is enabled</div>
                <div style={s.muted}>Your account requires an authenticator code at sign-in.</div>
              </div>
            </div>
            {error && <div style={s.error}>{error}</div>}
            <button style={s.dangerBtn} onClick={disable2FA} disabled={busy}>
              {busy ? 'Turning off…' : 'Turn off 2FA'}
            </button>
          </div>
        ) : (
          <div style={s.body}>
            {justEnabled === false && (
              <div style={s.muted}>
                Add an extra layer of security — after entering your password, you'll also need a code from an authenticator app to sign in.
              </div>
            )}
            {error && <div style={s.error}>{error}</div>}
            <button style={s.primaryBtn} onClick={startEnroll} disabled={busy}>
              {busy ? 'Starting…' : 'Enable 2FA'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modal: {
    width: '100%', maxWidth: 380, background: '#1c1830', borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
    padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '85vh', overflowY: 'auto',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: 700, color: '#fff' },
  closeBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer' },
  body: { display: 'flex', flexDirection: 'column', gap: 12 },
  muted: { fontSize: 13, color: '#9ca3af', lineHeight: 1.5 },
  step: { fontSize: 13, color: '#d8dae8', fontWeight: 600 },
  qrWrap: { display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 12, padding: 12 },
  qrImg: { width: 180, height: 180 },
  secretBox: {
    fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.05em', color: '#e9d5ff',
    background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)',
    borderRadius: 10, padding: '8px 12px', textAlign: 'center', wordBreak: 'break-all',
  },
  codeInput: {
    fontSize: 20, letterSpacing: '0.3em', textAlign: 'center', padding: '10px 12px',
    borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
    color: '#fff', fontFamily: 'monospace',
  },
  btnRow: { display: 'flex', gap: 10 },
  primaryBtn: {
    flex: 1, background: 'var(--brand-grad, linear-gradient(135deg,#6c63ff,#a78bfa))', border: 'none',
    borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13.5, padding: '10px 14px', cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10, color: '#d8dae8', fontWeight: 600, fontSize: 13.5, padding: '10px 14px', cursor: 'pointer',
  },
  dangerBtn: {
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 10, color: '#fca5a5', fontWeight: 700, fontSize: 13.5, padding: '10px 14px', cursor: 'pointer',
  },
  statusRow: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  statusDot: { width: 10, height: 10, borderRadius: '50%', background: '#22c55e', marginTop: 4, flexShrink: 0, boxShadow: '0 0 8px rgba(34,197,94,0.6)' },
  error: { fontSize: 12.5, color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 10px' },
}
