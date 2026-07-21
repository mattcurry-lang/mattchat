import React, { useState, useEffect, useRef } from 'react'
import { signIn, signUp, resetPasswordForEmail } from '../lib/supabase'
import { IconEye, IconEyeOff } from '../components/Icons'

const RESET_COOLDOWN_SECONDS = 45

// Colorful gradient icon badges for the feature list — each one uses
// its own gradient fill so they read as distinct, "alive" glyphs
// rather than a flat monochrome icon set or raw emoji. Kept as inline
// SVG so rendering stays consistent across OS/browsers. Copy reflects
// what Curry actually does (cross-chat memory, mood radar, real email
// sending, reconnect nudges) instead of generic messaging boilerplate.
function FeatureIconMemory() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="fi-memory" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <path d="M7 3c0 4 10 3 10 8s-10 4-10 8" stroke="url(#fi-memory)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M17 3c0 4-10 3-10 8s10 4 10 8" stroke="url(#fi-memory)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="8" r="1.6" fill="#a78bfa" />
      <circle cx="16" cy="16" r="1.6" fill="#f472b6" />
    </svg>
  )
}

function FeatureIconRadar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="fi-radar" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#6c63ff" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" stroke="url(#fi-radar)" strokeWidth="1.6" opacity="0.35" fill="none" />
      <circle cx="12" cy="12" r="5.5" stroke="url(#fi-radar)" strokeWidth="1.8" opacity="0.6" fill="none" />
      <circle cx="12" cy="12" r="2.4" fill="url(#fi-radar)" />
    </svg>
  )
}

function FeatureIconMail() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="fi-mail" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="url(#fi-mail)" strokeWidth="2" fill="none" />
      <path d="M4 7.5l8 6 8-6" stroke="url(#fi-mail)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function FeatureIconPulse() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="fi-pulse" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <path d="M3 12h4l2-7 4 14 2-9 2 4h4" stroke="url(#fi-pulse)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

const FEATURES = [
  { Icon: FeatureIconMemory, bg: 'linear-gradient(135deg, rgba(167,139,250,0.22), rgba(244,114,182,0.18))', text: 'Curry never forgets a conversation' },
  { Icon: FeatureIconRadar, bg: 'linear-gradient(135deg, rgba(56,189,248,0.22), rgba(108,99,255,0.18))', text: 'Know the mood before you reply' },
  { Icon: FeatureIconMail, bg: 'linear-gradient(135deg, rgba(251,191,36,0.22), rgba(244,114,182,0.18))', text: 'Real emails, sent from the chat' },
  { Icon: FeatureIconPulse, bg: 'linear-gradient(135deg, rgba(52,211,153,0.22), rgba(56,189,248,0.18))', text: 'Nudges you before you drift apart' },
]
export default function AuthPage() {
  const [mode, setMode]               = useState('login') // 'login' | 'signup' | 'reset'
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [username, setUsername]       = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [success, setSuccess]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [cooldown, setCooldown]       = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (cooldown <= 0) return
    timerRef.current = setInterval(() => {
      setCooldown(c => (c <= 1 ? 0 : c - 1))
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [cooldown > 0])

  const handle = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else if (mode === 'signup') {
        await signUp(email, password, username)
        setSuccess('Check your email to confirm your account!')
      } else if (mode === 'reset') {
        if (cooldown > 0) { setLoading(false); return }
        await resetPasswordForEmail(email)
        setSuccess('Check your email for a password reset link.')
        setCooldown(RESET_COOLDOWN_SECONDS)
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      {/* ── LEFT PANEL ── */}
      <div className="auth-left">
        <div className="auth-left-inner">
          <div className="auth-brand">
            <img src="/logo.png" alt="Mattchat" className="auth-brand-logo" />
            <h1 className="auth-brand-name">Mattchat</h1>
            <p className="auth-brand-tagline">Your AI communication platform</p>
          </div>

          <div className="auth-features">
            {FEATURES.map(({ Icon, bg, text }) => (
              <div key={text} className="auth-feature-item">
                <span className="auth-feature-icon" style={{ background: bg }}><Icon /></span>
                <span className="auth-feature-text">{text}</span>
              </div>
            ))}
          </div>

          <div className="auth-left-footer">
            Built for students & young professionals in Africa
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right">
        <div className="auth-form-wrap">

          <div className="auth-form-header">
            <h2 className="auth-form-title">
              {mode === 'login' ? 'Welcome back'
                : mode === 'signup' ? 'Get started'
                : 'Reset your password'}
            </h2>
            <p className="auth-form-sub">
              {mode === 'login' ? 'Sign in to continue to Mattchat'
                : mode === 'signup' ? 'Create your free account today'
                : "Enter your email and we'll send you a reset link"}
            </p>
          </div>

          {mode !== 'reset' && (
            <div className="auth-tabs">
              <button
                className={mode === 'login' ? 'active' : ''}
                onClick={() => { setMode('login'); setError(''); setSuccess('') }}
              >
                Sign in
              </button>
              <button
                className={mode === 'signup' ? 'active' : ''}
                onClick={() => { setMode('signup'); setError(''); setSuccess('') }}
              >
                Create account
              </button>
            </div>
          )}

          <form onSubmit={handle} className="auth-form">
            {mode === 'signup' && (
              <div className="field">
                <label>Username</label>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="yourname"
                  required
                  autoComplete="username"
                />
              </div>
            )}

            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            {mode !== 'reset' && (
              <div className="field">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: 12, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)', padding: 0,
                      display: 'flex', alignItems: 'center',
                    }}
                    tabIndex={-1}
                  >
                    {showPassword ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <button
                type="button"
                className="auth-forgot-link"
                onClick={() => { setMode('reset'); setError(''); setSuccess('') }}
              >
                Forgot password?
              </button>
            )}

            {error   && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <button
              type="submit"
              className="auth-btn"
              disabled={loading || (mode === 'reset' && cooldown > 0)}
            >
              {loading
                ? 'Please wait…'
                : mode === 'reset' && cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : mode === 'login' ? 'Sign in'
                  : mode === 'signup' ? 'Create account'
                  : 'Send reset link'}
            </button>
          </form>

          {mode === 'reset' && (
            <button
              type="button"
              className="auth-back-link"
              onClick={() => { setMode('login'); setError(''); setSuccess('') }}
            >
              ← Back to sign in
            </button>
          )}

          {mode !== 'reset' && (
            <p className="auth-note">
              Your Mattchat address will be{' '}
              <strong>matt+{username || 'username'}@mattchat.app</strong>
              {' '}— friends can message you directly by email.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
