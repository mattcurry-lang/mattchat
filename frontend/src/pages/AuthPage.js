import React, { useState } from 'react'
import { signIn, signUp } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')
  const [success, setSuccess] = useState('')
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
      <div className="auth-card">
       <img src="/logo.png" alt="Mattchat" className="auth-logo-img" />
        <p className="auth-tagline">Chat with anyone, anywhere — via email or the app</p>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button>
        </div>

        <form onSubmit={handle}>
          {mode === 'signup' && (
            <div className="field">
              <label>Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="yourname" required />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="field">
            <label>Password</label>
          <div style={{ position: 'relative' }}>
  <input
    type={showPassword ? 'text' : 'password'}
    placeholder="Password"
    style={{ paddingRight: '40px', width: '100%' }}
    onChange={e => setPassword(e.target.value)}
    value={password}
  />
  <span
    onClick={() => setShowPassword(!showPassword)}
    style={{
      position: 'absolute', right: '12px', top: '50%',
      transform: 'translateY(-50%)', cursor: 'pointer',
      fontSize: '16px', color: '#6b8aa3', userSelect: 'none'
    }}
  >
    {showPassword ? '🙈' : '👁️'}
  </span>
</div>
          </div>
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="auth-note">
          Your Mattchat email address will be <strong>matt+username@yourdomain.com</strong> — friends can message you directly by email.
        </p>
      </div>
    </div>
  )
}
