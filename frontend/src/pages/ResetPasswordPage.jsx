import React, { useState } from 'react'
import { updatePassword } from '../lib/supabase'

export default function ResetPasswordPage({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const [loading, setLoading]   = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError("Passwords don't match"); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      await updatePassword(password)
      setSuccess('Password updated! You can now sign in.')
      setTimeout(() => {
        onDone?.()
        window.location.href = '/'
      }, 1800)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-right" style={{ width: '100%' }}>
        <div className="auth-form-wrap">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Set a new password</h2>
            <p className="auth-form-sub">Choose something you'll remember this time 🙂</p>
          </div>
          <form onSubmit={handle} className="auth-form">
            <div className="field">
              <label>New password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            {error   && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
