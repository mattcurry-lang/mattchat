import React, { useState } from 'react'
import { signIn, signUp, resetPasswordForEmail } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode]               = useState('login') // 'login' | 'signup' | 'reset'
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
      } else if (mode === 'signup') {
        await signUp(email, password, username)
        setSuccess('Check your email to confirm your account!')
      } else if (mode === 'reset') {
        await resetPasswordForEmail(email)
        setSuccess('Check your email for a password reset link.')
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      {/* ── LEFT PANEL (unchanged) ── */}
      <div className="auth-left">
        {/* ...unchanged... */}
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

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading
                ? 'Please wait…'
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
