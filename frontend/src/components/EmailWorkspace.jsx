import React, { useState, useEffect, useCallback } from 'react'
import {
  listEmails, searchEmails, archiveEmail, unarchiveEmail, deleteEmail,
  markEmailRead, replyToEmail, forwardEmail,
} from '../lib/supabase'
 
import { IconX, IconReply, IconForward, IconTrash, IconFolder, IconSearch, IconInbox } from './Icons'

const CATEGORY_CHIPS = [
  { key: null, label: 'All' },
  { key: 'assignment', label: 'Assignments' },
  { key: 'exam', label: 'Exams' },
  { key: 'meeting', label: 'Meetings' },
  { key: 'event', label: 'Events' },
  { key: 'bill', label: 'Bills' },
  { key: 'invoice', label: 'Invoices' },
  { key: 'receipt', label: 'Receipts' },
  { key: 'subscription', label: 'Subscriptions' },
  { key: 'otp', label: 'OTP' },
  { key: 'travel', label: 'Travel' },
  { key: 'internship', label: 'Internship' },
  { key: 'job_interview', label: 'Interviews' },
  { key: 'scholarship', label: 'Scholarship' },
  { key: 'announcement', label: 'Announcements' },
  { key: 'personal', label: 'Personal' },
  { key: 'other', label: 'Other' },
]

const CATEGORY_DOT = {
  assignment: '#a78bfa', exam: '#f87171', meeting: '#60a5fa', event: '#60a5fa',
  bill: '#fbbf24', invoice: '#fbbf24', receipt: '#fbbf24', subscription: '#fbbf24',
  otp: '#4ade80', travel: '#38bdf8', internship: '#c084fc', job_interview: '#c084fc',
  scholarship: '#c084fc', announcement: 'var(--text-muted)', personal: 'var(--text-muted)',
  spam: '#f87171', other: 'var(--text-muted)',
}

function EmailListRow({ email, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: 3, width: '100%', textAlign: 'left',
        padding: '10px 12px', borderRadius: 12, border: '1px solid',
        borderColor: active ? 'rgba(167,139,250,0.4)' : 'var(--border)',
        background: active ? 'rgba(167,139,250,0.08)' : 'var(--bg-surface-2)',
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: CATEGORY_DOT[email.category] || 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, fontWeight: email.is_unread ? 800 : 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {email.sender}
        </span>
        {email.is_unread && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', flexShrink: 0 }} />}
      </div>
      <div style={{ fontSize: 13, fontWeight: email.is_unread ? 700 : 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {email.subject || '(no subject)'}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {email.snippet}
      </div>
    </button>
  )
}

function EmailDetail({ email, session, onClose, onChanged }) {
  const [mode, setMode] = useState(null) // 'reply' | 'forward' | null
  const [replyBody, setReplyBody] = useState(email.draft_reply || '')
  const [forwardTo, setForwardTo] = useState('')
  const [forwardNote, setForwardNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const handleArchive = async () => {
    setBusy(true)
    const res = email.is_archived ? await unarchiveEmail(session, email.id) : await archiveEmail(session, email.id)
    setBusy(false)
    if (res.ok) { flash(email.is_archived ? 'Moved to inbox' : 'Archived'); onChanged() } else flash('Action failed')
  }

  const handleDelete = async () => {
    setBusy(true)
    const res = await deleteEmail(session, email.id)
    setBusy(false)
    if (res.ok) { onChanged(); onClose() } else flash('Delete failed')
  }

  const handleSend = async (asDraft) => {
    if (!replyBody.trim()) return
    setBusy(true)
    const res = await replyToEmail(session, email.id, replyBody, asDraft)
    setBusy(false)
    if (res.ok) {
      flash(asDraft ? 'Draft saved' : 'Reply sent')
      if (!asDraft) { setMode(null); setReplyBody('') }
      onChanged()
    } else flash('Failed to send')
  }

  const handleForward = async () => {
    if (!forwardTo.trim()) return
    setBusy(true)
    const res = await forwardEmail(session, email.id, forwardTo, forwardNote)
    setBusy(false)
    if (res.ok) { flash('Forwarded'); setMode(null); setForwardTo(''); setForwardNote('') } else flash('Forward failed')
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email.subject || '(no subject)'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{email.sender}</div>
          </div>
          <button style={s.iconBtn} onClick={onClose}><IconX size={16} /></button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxHeight: 280, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
          {email.body_text || email.snippet}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={s.actionBtn} disabled={busy} onClick={() => setMode(mode === 'reply' ? null : 'reply')}>
  <IconReply size={13} /> Reply
</button>
<button style={s.actionBtn} disabled={busy} onClick={() => setMode(mode === 'forward' ? null : 'forward')}>
  <IconForward size={13} /> Forward
</button>
<button style={s.actionBtn} disabled={busy} onClick={handleArchive}>
  {email.is_archived ? <><IconInbox size={13} /> Unarchive</> : <><IconFolder size={13} /> Archive</>}
</button>
<button style={{ ...s.actionBtn, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }} disabled={busy} onClick={handleDelete}>
  <IconTrash size={13} /> Delete
</button>
        </div>

        {mode === 'reply' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              value={replyBody} onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Write your reply…" rows={4}
              style={s.textarea}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={s.secondaryBtn} disabled={busy} onClick={() => handleSend(true)}>Save draft</button>
              <button style={s.primaryBtn} disabled={busy || !replyBody.trim()} onClick={() => handleSend(false)}>Send reply</button>
            </div>
          </div>
        )}

        {mode === 'forward' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              value={forwardTo} onChange={(e) => setForwardTo(e.target.value)}
              placeholder="Forward to (email address)"
              style={s.input}
            />
            <textarea
              value={forwardNote} onChange={(e) => setForwardNote(e.target.value)}
              placeholder="Add a note (optional)" rows={3}
              style={s.textarea}
            />
            <button style={s.primaryBtn} disabled={busy || !forwardTo.trim()} onClick={handleForward}>Send forward</button>
          </div>
        )}

        {toast && <div style={s.toast}>{toast}</div>}
      </div>
    </div>
  )
}

export default function EmailWorkspace({ session }) {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState(null)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [archived, setArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = searchQuery.trim()
        ? await searchEmails(session, searchQuery.trim())
        : await listEmails(session, { category, unreadOnly, archived })
      setEmails(data)
    } catch (e) {
      console.error('Failed to load emails:', e)
    }
    setLoading(false)
  }, [session, category, unreadOnly, archived, searchQuery])

  useEffect(() => { load() }, [load])

  const openEmail = async (email) => {
    setSelected(email)
    if (email.is_unread) {
      await markEmailRead(session, email.id)
      setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, is_unread: false } : e)))
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setSearchQuery(searchInput)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search mail…"
          style={s.input}
        />
       <button type="submit" style={s.secondaryBtn}><IconSearch size={14} /></button>
        {searchQuery && (
          <button type="button" style={s.secondaryBtn} onClick={() => { setSearchQuery(''); setSearchInput('') }}>
            <IconX size={14} />
          </button>
        )}
      </form>

      {!searchQuery && (
        <>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {CATEGORY_CHIPS.map((c) => (
              <button
                key={c.label}
                onClick={() => setCategory(c.key)}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                  fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                  border: '1px solid', borderColor: category === c.key ? 'rgba(167,139,250,0.5)' : 'var(--border)',
                  background: category === c.key ? 'rgba(167,139,250,0.15)' : 'var(--bg-surface-2)',
                  color: category === c.key ? '#c4b5fd' : 'var(--text-secondary)',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              style={{ ...s.toggle, ...(unreadOnly ? s.toggleActive : {}) }}
            >
              Unread only
            </button>
            <button
              onClick={() => setArchived((v) => !v)}
              style={{ ...s.toggle, ...(archived ? s.toggleActive : {}) }}
            >
              {archived ? 'Viewing archived' : 'Show archived'}
            </button>
          </div>
        </>
      )}

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>Loading…</div>
      ) : emails.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
          {searchQuery ? 'No matching emails.' : 'Nothing here.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {emails.map((email) => (
            <EmailListRow
              key={email.id}
              email={email}
              active={selected?.id === email.id}
              onClick={() => openEmail(email)}
            />
          ))}
        </div>
      )}

      {selected && (
        <EmailDetail
          email={selected}
          session={session}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: 'var(--bg-surface-1, #14141f)', borderRadius: 20, padding: 20, width: 'min(480px, 100%)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  iconBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', flexShrink: 0 },
  actionBtn: { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit' },
  primaryBtn: { background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit' },
  secondaryBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 12.5, fontWeight: 700, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit' },
  input: { flex: 1, background: 'var(--bg-surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 12.5, fontFamily: 'inherit' },
  textarea: { background: 'var(--bg-surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical' },
  toggle: { flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 700, padding: '7px 10px', cursor: 'pointer', fontFamily: 'inherit' },
  toggleActive: { background: 'rgba(167,139,250,0.12)', borderColor: 'rgba(167,139,250,0.4)', color: '#c4b5fd' },
  toast: { position: 'absolute', bottom: -34, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: 11.5, padding: '6px 12px', borderRadius: 8, whiteSpace: 'nowrap' },
}
