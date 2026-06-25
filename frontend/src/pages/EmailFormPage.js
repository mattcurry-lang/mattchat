import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EmailFormPage() {
  // Extract username from URL: /email/mathew
  const username = window.location.pathname.split('/email/')[1]?.toLowerCase() || ''

  const [senderName, setSenderName] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | success | error
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit() {
    if (!senderName.trim() || !senderEmail.trim() || !message.trim()) {
      setErrorMsg('Please fill in all fields.')
      return
    }

    setStatus('sending')
    setErrorMsg('')

    try {
      const res = await fetch(
        `https://bqerkvywgxoioocbkxif.supabase.co/functions/v1/email-form`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, senderName, senderEmail, message }),
        }
      )

      const data = await res.json()

      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'Something went wrong. Try again.')
        setStatus('error')
      } else {
        setStatus('success')
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  if (!username) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>💬</div>
          <h2 style={styles.title}>Invalid Link</h2>
          <p style={styles.sub}>This contact link is not valid.</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✅</div>
          <h2 style={styles.title}>Message Sent!</h2>
          <p style={styles.sub}>
            Your message was delivered to <strong>@{username}</strong> on Mattchat.
            If they reply, you'll get an email at <strong>{senderEmail}</strong>.
          </p>
          <button style={styles.btn} onClick={() => setStatus('idle')}>
            Send another message
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <img src="/logo.png" alt="Mattchat" style={styles.logoImg} />
          <div>
            <h2 style={styles.title}>Message @{username}</h2>
            <p style={styles.sub}>Send a message via Mattchat. Replies go to your email.</p>
          </div>
        </div>

        {/* Form */}
        <div style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Your Name</label>
            <input
              style={styles.input}
              placeholder="John Kamau"
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Your Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="john@example.com"
              value={senderEmail}
              onChange={e => setSenderEmail(e.target.value)}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Message</label>
            <textarea
              style={{ ...styles.input, ...styles.textarea }}
              placeholder="Write your message here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
            />
          </div>

          {errorMsg && <div style={styles.error}>{errorMsg}</div>}

          <button
            style={{ ...styles.btn, opacity: status === 'sending' ? 0.6 : 1 }}
            onClick={handleSubmit}
            disabled={status === 'sending'}
          >
            {status === 'sending' ? 'Sending...' : 'Send Message →'}
          </button>
        </div>

        <p style={styles.footer}>
          Powered by <a href="https://mattchat-nine.vercel.app" style={styles.link}>Mattchat</a>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    background: '#1e1e2e', borderRadius: 20, padding: '32px',
    width: '100%', maxWidth: 460,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    display: 'flex', flexDirection: 'column', gap: 24,
  },
  header: { display: 'flex', alignItems: 'center', gap: 14 },
  logoImg: { width: 48, height: 48, borderRadius: 12 },
  logo: { fontSize: 40, textAlign: 'center' },
  successIcon: { fontSize: 48, textAlign: 'center' },
  title: { fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 },
  sub: { fontSize: 14, color: '#a0aec0', margin: '4px 0 0' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase' },
  input: {
    background: '#2a2a3e', border: '1px solid #3a3a4e', borderRadius: 10,
    color: '#fff', fontSize: 15, padding: '10px 14px',
    outline: 'none', fontFamily: 'inherit', width: '100%',
    boxSizing: 'border-box',
  },
  textarea: { resize: 'vertical', minHeight: 100 },
  error: { fontSize: 13, color: '#fc8181' },
  btn: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', border: 'none', borderRadius: 10,
    padding: '13px', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', transition: 'opacity 0.2s',
  },
  footer: { fontSize: 12, color: '#555', textAlign: 'center', margin: 0 },
  link: { color: '#667eea', textDecoration: 'none' },
}
