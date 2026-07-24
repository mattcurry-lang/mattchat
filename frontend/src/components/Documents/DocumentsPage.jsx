import React, { useState, useEffect } from 'react'
import { listDocumentAnalyses, askDocument } from '../../lib/supabase'

function DocumentCard({ doc, session }) {
  const [expanded, setExpanded] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [asking, setAsking] = useState(false)

  const handleAsk = async () => {
    if (!question.trim()) return
    setAsking(true)
    setAnswer(null)
    try {
      const res = await askDocument(session, doc.id, question)
      setAnswer(res.ok ? res.answer : "Couldn't get an answer right now.")
    } catch {
      setAnswer("Couldn't get an answer right now.")
    }
    setAsking(false)
  }

  return (
    <div style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{doc.file_name}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>from {doc.emails?.sender}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{doc.concise_summary}</div>

      {doc.important_dates?.length > 0 && (
        <div style={{ fontSize: 11.5, color: '#fbbf24' }}>
          📅 {doc.important_dates.map(d => `${d.label}${d.date ? `: ${d.date}` : ''}`).join(' · ')}
        </div>
      )}

      <button onClick={() => setExpanded(v => !v)} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
        {expanded ? 'Hide details' : 'Show details & ask a question →'}
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{doc.detailed_summary}</div>
          {doc.deliverables?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Deliverables</div>
              <ul style={{ margin: '2px 0 0', paddingLeft: 18, fontSize: 12 }}>
                {doc.deliverables.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}
          {doc.submission_instructions && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong>Submission:</strong> {doc.submission_instructions}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              placeholder="Ask about this document…"
              style={{ flex: 1, background: 'var(--bg-surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 12.5, fontFamily: 'inherit' }}
            />
            <button onClick={handleAsk} disabled={asking} style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {asking ? '…' : 'Ask'}
            </button>
          </div>
          {answer && (
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: 'var(--text-primary)' }}>
              {answer}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DocumentsPage({ userId, session }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listDocumentAnalyses(userId).then(setDocs).catch(console.error).finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading documents…</div>
  if (docs.length === 0) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No analyzed documents yet.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, maxWidth: 640, margin: '0 auto' }}>
      {docs.map(doc => <DocumentCard key={doc.id} doc={doc} session={session} />)}
    </div>
  )
}
