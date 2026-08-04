import React, { useState, useEffect } from 'react'
import { supabase, sendAnnouncement } from '../lib/supabase'
import { IconMail, IconX, IconCheckSquare, IconClock, IconShield, IconHistory } from './Icons'

const MAX_SUBJECT = 150
const MAX_MESSAGE = 5000
const DRAFT_KEY = 'mattchat_announcement_draft'

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function renderPreviewHtml({ username, subject, message }) {
  const safeUsername = escapeHtml(username || 'there')
  const safeSubject = escapeHtml(subject || '(no subject)')
  const safeMessage = escapeHtml(message || '').replace(/\n/g, '<br>')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background:#0f0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;padding:32px 16px;">
  <tr><td align="center">
  <table role="presentation" width="100%" style="max-width:520px;background:#14141f;border-radius:20px;overflow:hidden;border:1px solid rgba(167,139,250,0.15);">
  <tr><td style="background:linear-gradient(135deg,#667eea,#764ba2);padding:32px 24px;text-align:center;">
  <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Mattchat</div></td></tr>
  <tr><td style="padding:32px 28px 8px;">
  <p style="margin:0 0 16px;font-size:15px;color:#e8e8f0;">Hello ${safeUsername},</p>
  <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#ffffff;line-height:1.3;">${safeSubject}</h1>
  <p style="margin:0 0 28px;font-size:14.5px;line-height:1.7;color:#c9c9d6;">${safeMessage}</p>
  </td></tr>
  <tr><td style="padding:0 28px 32px;text-align:center;">
  <a href="https://mattchat-nine.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 32px;border-radius:999px;">Open Mattchat</a>
  </td></tr>
  <tr><td style="padding:20px 28px 28px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
  <p style="margin:0 0 4px;font-size:11.5px;color:#7c7c8a;">Sent by Mattchat &middot; Powered by Curry AI</p>
  <p style="margin:0;font-size:11px;color:#5c5c68;">You're receiving this because you have a Mattchat account.</p>
  </td></tr>
  </table></td></tr></table></body></html>`
}

function formatLogTime(ts) {
  const d = new Date(ts)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function SentHistory() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('announcement_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Failed to load announcement_logs:', error)
        setLogs(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>Loading history…</div>
  }

  if (logs.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <IconHistory size={22} style={{ color: 'var(--text-muted)' }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>No announcements sent yet</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Sent announcements will show up here.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {logs.map(log => {
        const isOpen = expandedId === log.id
        return (
          <div key={log.id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <button
              onClick={() => setExpandedId(isOpen ? null : log.id)}
              style={{ width: '100%', textAlign: 'left', background: 'var(--bg-surface-2, #1a1a2e)', border: 'none', padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.subject}
                </span>
                {log.test_mode && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.15)', borderRadius: 6, padding: '2px 6px', flexShrink: 0 }}>TEST</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                <span>{formatLogTime(log.created_at)}</span>
                <span>by {log.sent_by_username || 'admin'}</span>
                <span style={{ color: '#4ade80' }}>{log.sent_count} sent</span>
                {log.failed_count > 0 && <span style={{ color: '#f87171' }}>{log.failed_count} failed</span>}
              </div>
            </button>

            {isOpen && (
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: log.errors?.length ? 12 : 0 }}>
                  {log.message}
                </div>
                {log.errors?.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface-2, #1a1a2e)' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 700 }}>Email</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 700 }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {log.errors.map((e, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>{e.email}</td>
                          <td style={{ padding: '6px 8px', color: '#f87171', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function AdminAnnouncements({ session, profile, onClose }) {
  const [tab, setTab] = useState('compose') // compose | sent
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [testEmail, setTestEmail] = useState(false)
  const [autoSaveDraft, setAutoSaveDraft] = useState(true)
  const [view, setView] = useState('compose') // compose | preview | confirm | sending | success
  const [totalUsers, setTotalUsers] = useState(null)
  const [report, setReport] = useState(null)
  const [showFailures, setShowFailures] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [retryingEmail, setRetryingEmail] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw)
        setSubject(draft.subject || '')
        setMessage(draft.message || '')
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!autoSaveDraft) return
    const t = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ subject, message })) } catch {}
    }, 400)
    return () => clearTimeout(t)
  }, [subject, message, autoSaveDraft])

  useEffect(() => {
    supabase.from('profiles').select('*', { count: 'exact', head: true }).then(({ count }) => {
      if (typeof count === 'number') setTotalUsers(count)
    })
  }, [])

  const canSend = subject.trim().length > 0 && subject.length <= MAX_SUBJECT
    && message.trim().length > 0 && message.length <= MAX_MESSAGE

  const doSend = async ({ testMode = false } = {}) => {
    setSendError(null)
    setView('sending')
    try {
      const data = await sendAnnouncement(session, { subject, message, testMode })
      setReport(data)
      if (!testMode) { try { localStorage.removeItem(DRAFT_KEY) } catch {} }
      setView('success')
    } catch (err) {
      setSendError(err.message || 'Failed to send announcement')
      setView('compose')
    }
  }

  const retryOne = async (email) => {
    setRetryingEmail(email)
    try {
      const data = await sendAnnouncement(session, { subject, message, testMode: false, onlyEmails: [email] })
      setReport(prev => {
        if (!prev) return prev
        const stillFailed = data.errors?.[0] || null
        return {
          ...prev,
          sent: prev.sent + (stillFailed ? 0 : 1),
          failed: prev.failed - (stillFailed ? 0 : 1),
          errors: stillFailed
            ? prev.errors.map(e => (e.email === email ? stillFailed : e))
            : prev.errors.filter(e => e.email !== email),
        }
      })
    } catch (err) {
      alert(`Retry failed: ${err.message}`)
    }
    setRetryingEmail(null)
  }

  const resetToCompose = () => {
    setView('compose'); setReport(null); setShowFailures(false)
    setSubject(''); setMessage('')
  }

  const overlay = { position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
  const card = { background: 'var(--bg-surface-1, #14141f)', borderRadius: 20, width: 'min(560px, 96vw)', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>

        <div style={{ padding: '20px 22px 0', background: 'linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.15))', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconMail size={17} style={{ color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Announcements</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {totalUsers !== null ? `${totalUsers} users on Mattchat` : 'Broadcast to every Mattchat user'}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <IconX size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            {[{ id: 'compose', label: 'Compose' }, { id: 'sent', label: 'Sent' }].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                  color: tab === t.id ? '#c4b5fd' : 'var(--text-muted)',
                  borderBottom: tab === t.id ? '2px solid #a78bfa' : '2px solid transparent',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'sent' ? (
          <SentHistory />
        ) : (
          <>
            {view === 'compose' && (
              <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {sendError && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: '#f87171' }}>
                    {sendError}
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>Subject</label>
                    <span style={{ fontSize: 11, color: subject.length > MAX_SUBJECT ? '#f87171' : 'var(--text-muted)' }}>{subject.length}/{MAX_SUBJECT}</span>
                  </div>
                  <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. New features just landed on Mattchat"
                    maxLength={MAX_SUBJECT + 20}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-surface-2, #1a1a2e)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>Message</label>
                    <span style={{ fontSize: 11, color: message.length > MAX_MESSAGE ? '#f87171' : 'var(--text-muted)' }}>{message.length}/{MAX_MESSAGE}</span>
                  </div>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="What's new?"
                    rows={6}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-surface-2, #1a1a2e)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={testEmail} onChange={e => setTestEmail(e.target.checked)} />
                    Send test email to myself only
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={autoSaveDraft} onChange={e => setAutoSaveDraft(e.target.checked)} />
                    Save draft as I type
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    onClick={() => setView('preview')}
                    disabled={!canSend}
                    style={{ flex: 1, background: 'var(--bg-surface-2, #1a1a2e)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: canSend ? 'pointer' : 'not-allowed', opacity: canSend ? 1 : 0.5, fontFamily: 'inherit' }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => (testEmail ? doSend({ testMode: true }) : setView('confirm'))}
                    disabled={!canSend}
                    style={{ flex: 1, background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 12, padding: '11px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: canSend ? 'pointer' : 'not-allowed', opacity: canSend ? 1 : 0.5, fontFamily: 'inherit' }}
                  >
                    {testEmail ? 'Send Test Email' : 'Send Announcement'}
                  </button>
                </div>
              </div>
            )}

            {view === 'preview' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '14px 22px 0', fontSize: 12, color: 'var(--text-muted)' }}>This is exactly what recipients will see.</div>
                <iframe
                  title="Email preview"
                  srcDoc={renderPreviewHtml({ username: profile?.username || 'there', subject, message })}
                  style={{ width: '100%', height: 460, border: 'none', margin: '12px 0' }}
                />
                <div style={{ display: 'flex', gap: 10, padding: '0 22px 22px' }}>
                  <button
                    onClick={() => setView('compose')}
                    style={{ flex: 1, background: 'var(--bg-surface-2, #1a1a2e)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Back to Edit
                  </button>
                  <button
                    onClick={() => (testEmail ? doSend({ testMode: true }) : setView('confirm'))}
                    style={{ flex: 1, background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 12, padding: '11px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {testEmail ? 'Send Test Email' : 'Send Announcement'}
                  </button>
                </div>
              </div>
            )}

            {view === 'confirm' && (
              <div style={{ padding: 28, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
                <IconShield size={30} style={{ color: '#a78bfa' }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Send this announcement to {totalUsers ?? 'all'} users?
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>This can't be undone once sending starts.</div>
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  <button
                    onClick={() => setView('preview')}
                    style={{ flex: 1, background: 'var(--bg-surface-2, #1a1a2e)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => doSend({ testMode: false })}
                    style={{ flex: 1, background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 12, padding: '11px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            {view === 'sending' && (
              <div style={{ padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
                <IconClock size={28} style={{ color: '#a78bfa' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Sending…</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>This can take a moment for larger user counts.</div>
                <div style={{ width: '100%', maxWidth: 280, height: 6, borderRadius: 4, background: 'var(--bg-surface-2, #1a1a2e)', overflow: 'hidden' }}>
                  <div style={{ width: '40%', height: '100%', borderRadius: 4, background: 'linear-gradient(135deg,#667eea,#764ba2)', animation: 'announcementIndeterminate 1.2s ease-in-out infinite' }} />
                </div>
                <style>{`@keyframes announcementIndeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }`}</style>
              </div>
            )}

            {view === 'success' && report && (
              <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconCheckSquare size={24} style={{ color: '#4ade80' }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {report.testMode ? 'Test Email Sent' : 'Announcement Sent'}
                </div>
                <div style={{ display: 'flex', gap: 22 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{report.totalUsers}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{report.testMode ? 'test recipient' : 'users reached'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#4ade80' }}>{report.sent}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>delivered</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: report.failed > 0 ? '#f87171' : 'var(--text-muted)' }}>{report.failed}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>failed</div>
                  </div>
                </div>

                {report.failed > 0 && !showFailures && (
                  <button onClick={() => setShowFailures(true)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 16px', color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    View Report
                  </button>
                )}

                {showFailures && report.errors?.length > 0 && (
                  <div style={{ width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-surface-2, #1a1a2e)' }}>
                          <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 700 }}>Email</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 700 }}>Reason</th>
                          <th style={{ padding: '8px 10px' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {report.errors.map(e => (
                          <tr key={e.email} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{e.email}</td>
                            <td style={{ padding: '8px 10px', color: '#f87171', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.reason}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <button
                                onClick={() => retryOne(e.email)}
                                disabled={retryingEmail === e.email}
                                style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8, padding: '4px 10px', color: '#c4b5fd', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: retryingEmail === e.email ? 0.6 : 1 }}
                              >
                                {retryingEmail === e.email ? 'Retrying…' : 'Retry'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <button
                  onClick={report.testMode ? () => setView('compose') : resetToCompose}
                  style={{ width: '100%', background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 12, padding: '11px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Done
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
