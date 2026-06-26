import { useState } from 'react'
import { useParams } from 'react-router-dom'

export default function EmailFormPage() {
  const { username } = useParams()

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
  'https://bqerkvywgxoioocbkxif.supabase.co/functions/v1/email-form',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sb_publishable_xnW_tXlnKxxsv0cei2vc0Q_MYDFjiao',
    },
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

  if (status === 'success') {
    return (
      <div className="email-form-page">
        <div className="email-form-card">
          <div className="email-form-success-icon">✅</div>
          <h2 className="email-form-title" style={{ textAlign: 'center' }}>Message Sent!</h2>
          <p className="email-form-sub" style={{ textAlign: 'center' }}>
            Your message was delivered to <strong>@{username}</strong> on Mattchat.
            If they reply, you'll get an email at <strong>{senderEmail}</strong>.
          </p>
          <button className="email-form-btn" onClick={() => setStatus('idle')}>
            Send another message
          </button>
          <p className="email-form-footer">
            Powered by <a href="https://mattchat-nine.vercel.app">Mattchat</a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="email-form-page">
      <div className="email-form-card">
        <div className="email-form-header">
          <img src="/logo.png" alt="Mattchat" className="email-form-logo-img" />
          <div>
            <h2 className="email-form-title">Message @{username}</h2>
            <p className="email-form-sub">Send a message via Mattchat. Replies go to your email.</p>
          </div>
        </div>

        <div className="email-form-body">
          <div className="email-form-field">
            <label className="email-form-label">Your Name</label>
            <input
              className="email-form-input"
              placeholder="John Kamau"
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
            />
          </div>

          <div className="email-form-field">
            <label className="email-form-label">Your Email</label>
            <input
              className="email-form-input"
              type="email"
              placeholder="john@example.com"
              value={senderEmail}
              onChange={e => setSenderEmail(e.target.value)}
            />
          </div>

          <div className="email-form-field">
            <label className="email-form-label">Message</label>
            <textarea
              className="email-form-input email-form-textarea"
              placeholder="Write your message here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
            />
          </div>

          {errorMsg && <div className="email-form-error">{errorMsg}</div>}

          <button
            className="email-form-btn"
            onClick={handleSubmit}
            disabled={status === 'sending'}
          >
            {status === 'sending' ? 'Sending...' : 'Send Message →'}
          </button>
        </div>

        <p className="email-form-footer">
          Powered by <a href="https://mattchat-nine.vercel.app">Mattchat</a>
        </p>
      </div>
    </div>
  )
}
