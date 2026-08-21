import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { acceptTrustedInvite } from '../lib/cycleTrust'

export default function TrustedInvitePage({ session }) {
  const { token } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | needsAuth | accepting | done | error
  const [error, setError] = useState('')

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setStatus('needsAuth'); return }
    accept()
  }, [session])

  const accept = async () => {
    setStatus('accepting')
    try {
      await acceptTrustedInvite(token)
      setStatus('done')
      setTimeout(() => navigate('/'), 1800)
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🌸</div>
        {status === 'loading' && <p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p>}
        {status === 'needsAuth' && (
          <>
            <h2 style={{ color: '#fff', fontFamily: 'var(--font-display)', marginBottom: 10 }}>Sign in to accept</h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, marginBottom: 20 }}>
              Someone invited you to be part of their Trusted Circle on Mattchat. Sign in or create an account to continue.
            </p>
            <button className="btn-primary" onClick={() => navigate('/auth')}>Sign in →</button>
          </>
        )}
        {status === 'accepting' && <p style={{ color: 'rgba(255,255,255,0.6)' }}>Accepting invite…</p>}
        {status === 'done' && (
          <>
            <h2 style={{ color: '#fff', fontFamily: 'var(--font-display)', marginBottom: 8 }}>You're connected</h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5 }}>Taking you back to Mattchat…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h2 style={{ color: '#fff', fontFamily: 'var(--font-display)', marginBottom: 8 }}>Couldn't accept invite</h2>
            <p style={{ color: '#fca5a5', fontSize: 13.5, marginBottom: 20 }}>{error}</p>
            <button className="btn-ghost" onClick={() => navigate('/')}>Go home</button>
          </>
        )}
      </div>
    </div>
  )
}
