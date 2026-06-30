import React, { useState } from 'react'
import { signIn, signUp } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode]               = useState('login')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [username, setUsername]       = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [success, setSuccess]         = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        await signUp(email, password, username)
        setSuccess('Check your email to confirm your account!')
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
            {[
              { icon: '✨', text: 'AI-powered conversations' },
              { icon: '📞', text: 'Voice & video calls' },
              { icon: '🎙️', text: 'Voice notes with transcription' },
              { icon: '🔒', text: 'Private & secure messaging' },
            ].map(({ icon, text }) => (
              <div key={text} className="auth-feature-item">
                <span className="auth-feature-icon">{icon}</span>
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
              {mode === 'login' ? 'Welcome back' : 'Get started'}
            </h2>
            <p className="auth-form-sub">
              {mode === 'login'
                ? 'Sign in to continue to Mattchat'
                : 'Create your free account today'}
            </p>
          </div>

          {/* Tabs */}
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
                  style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 16,
                    color: 'var(--text-muted)', padding: 0,
                    display: 'flex', alignItems: 'center',
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error   && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <button
              type="submit"
              className="auth-btn"
              disabled={loading}
            >
              {loading
                ? 'Please wait…'
                : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="auth-note">
            Your Mattchat address will be{' '}
            <strong>matt+{username || 'username'}@mattchat.app</strong>
            {' '}— friends can message you directly by email.
          </p>
        </div>
      </div>
    </div>
  )
}
