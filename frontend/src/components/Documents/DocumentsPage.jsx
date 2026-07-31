import React, { useState, useEffect } from 'react'
import { listDocumentAnalyses, askDocument } from '../../lib/supabase'
import FlashcardDeck from '../FlashcardDeck'
import QuizRunner from '../QuizRunner'
import { IconClock, IconChart, IconPin, IconUser } from '../Icons'

const DIFFICULTY_COLORS = {
  easy: '#4ade80',
  moderate: '#fbbf24',
  challenging: '#fb923c',
  advanced: '#f87171',
}

function DocumentCard({ doc, session }) {
  const [expanded, setExpanded] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [asking, setAsking] = useState(false)
  const [activeDeck, setActiveDeck] = useState(null) // 'flashcards' | 'quiz' | null

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

  const hasFlashcards = doc.flashcards?.length > 0
  const hasQuiz = doc.quiz?.length > 0
  const diffColor = DIFFICULTY_COLORS[doc.difficulty] || 'var(--text-muted)'

  return (
    <div style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{doc.file_name}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>from {doc.emails?.sender}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{doc.concise_summary}</div>

      {/* Metadata row: reading time / difficulty */}
      {(doc.reading_time_minutes || doc.difficulty) && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {doc.reading_time_minutes && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-muted)' }}>
              <IconClock size={13} />
              {doc.reading_time_minutes} min read
            </div>
          )}
          {doc.difficulty && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: diffColor, textTransform: 'capitalize' }}>
              <IconChart size={13} />
              {doc.difficulty}
            </div>
          )}
        </div>
      )}

      {doc.important_dates?.length > 0 && (
        <div style={{ fontSize: 11.5, color: '#fbbf24' }}>
          📅 {doc.important_dates.map(d => `${d.label}${d.date ? `: ${d.date}` : ''}`).join(' · ')}
        </div>
      )}

      {/* Flashcards / Quiz launchers */}
      {(hasFlashcards || hasQuiz) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {hasFlashcards && (
            <button
              onClick={() => setActiveDeck('flashcards')}
              style={{ flex: 1, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 10, color: '#c4b5fd', fontSize: 11.5, fontWeight: 700, padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              🗂 {doc.flashcards.length} flashcards
            </button>
          )}
          {hasQuiz && (
            <button
              onClick={() => setActiveDeck('quiz')}
              style={{ flex: 1, background: 'rgba(240,147,251,0.1)', border: '1px solid rgba(240,147,251,0.25)', borderRadius: 10, color: '#f0abfc', fontSize: 11.5, fontWeight: 700, padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ✅ {doc.quiz.length}-question quiz
            </button>
          )}
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

          {doc.next_steps?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Next steps</div>
              <ul style={{ margin: '2px 0 0', paddingLeft: 18, fontSize: 12 }}>
                {doc.next_steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {(doc.key_names?.length > 0 || doc.key_locations?.length > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {doc.key_names?.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  <IconUser size={13} /> {doc.key_names.join(', ')}
                </div>
              )}
              {doc.key_locations?.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  <IconPin size={13} /> {doc.key_locations.join(', ')}
                </div>
              )}
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

      {activeDeck === 'flashcards' && (
        <FlashcardDeck cards={doc.flashcards} title={doc.file_name} onClose={() => setActiveDeck(null)} />
      )}
      {activeDeck === 'quiz' && (
        <QuizRunner questions={doc.quiz} title={doc.file_name} onClose={() => setActiveDeck(null)} />
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
