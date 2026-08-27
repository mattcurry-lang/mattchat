import React, { useState, useEffect } from 'react'
import { fetchYouTubeOEmbed } from '../lib/youtube'
import { analyzeYouTubeVideo, askYouTubeVideo } from '../lib/supabase'
import FlashcardDeck from './FlashcardDeck'
import QuizRunner from './QuizRunner'

const CREDIBILITY_COLORS = {
  high: '#4ade80',
  moderate: '#fbbf24',
  low: '#f87171',
  unclear: 'var(--text-muted)',
}

// "MM:SS" or "H:MM:SS" -> seconds, for seeking the player
function timestampToSeconds(ts) {
  if (!ts) return 0
  const parts = ts.split(':').map(Number)
  if (parts.some(isNaN)) return 0
  return parts.reduceRight((acc, val, i, arr) => acc + val * Math.pow(60, arr.length - 1 - i), 0)
}

export default function YouTubeCard({ videoId, onPlay, onWatchTogether, session }) {
  const [meta, setMeta] = useState(null)
  const [failed, setFailed] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [asking, setAsking] = useState(false)
  const [activeDeck, setActiveDeck] = useState(null) // 'flashcards' | 'quiz' | null

  useEffect(() => {
    let cancelled = false
    fetchYouTubeOEmbed(videoId).then((data) => {
      if (cancelled) return
      if (data) setMeta(data)
      else setFailed(true)
    })
    return () => { cancelled = true }
  }, [videoId])

  const handleSummarize = async () => {
    setShowAI(true)
    if (analysis) return
    setAnalyzing(true)
    try {
      const res = await analyzeYouTubeVideo(session, videoId)
      if (res.ok) setAnalysis(res.analysis)
    } catch (e) {
      console.error('Video analysis failed:', e)
    }
    setAnalyzing(false)
  }

  const handleAsk = async () => {
    if (!question.trim()) return
    setAsking(true)
    setAnswer(null)
    try {
      const res = await askYouTubeVideo(session, videoId, question)
      setAnswer(res.ok ? res.answer : "Couldn't get an answer.")
    } catch {
      setAnswer("Couldn't get an answer.")
    }
    setAsking(false)
  }

  // Passes a start-time in seconds as a second arg. Harmless if the
  // parent's onPlay handler ignores extra args — but for the player to
  // actually seek there, YouTubePlayer needs the startSeconds prop
  // (added below) threaded through from wherever onPlay is handled.
  const jumpTo = (timestamp) => {
    onPlay(videoId, timestampToSeconds(timestamp))
  }

  if (failed) {
    return (
      <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', fontSize: 13 }}>
        youtube.com/watch?v={videoId}
      </a>
    )
  }

  if (!meta) {
    return (
      <div style={{ width: 280, height: 158, borderRadius: 12, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
        Loading preview…
      </div>
    )
  }

  const hasFlashcards = analysis?.flashcards?.length > 0
  const hasQuiz = analysis?.quiz?.length > 0
  const credColor = CREDIBILITY_COLORS[analysis?.credibility] || 'var(--text-muted)'

  return (
    <div style={{ width: 280 }}>
      <button
        onClick={() => onPlay(videoId)}
        style={{ display: 'block', width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-surface-2)', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit' }}
      >
        <div style={{ position: 'relative' }}>
          <img src={meta.thumbnailUrl} alt={meta.title} style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        </div>
        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {meta.title}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>{meta.authorName}</div>
        </div>
      </button>

      <button onClick={handleSummarize} style={{ marginTop: 6, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 10, color: '#c4b5fd', fontSize: 11.5, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
        ✨ AI Summary & Notes
      </button>

      {onWatchTogether && (
  <button onClick={() => onWatchTogether(videoId, meta.title, meta.thumbnailUrl)} style={{ marginTop: 6, background: 'rgba(102,126,234,0.15)', border: '1px solid rgba(102,126,234,0.4)', borderRadius: 10, color: '#a5b4fc', fontSize: 11.5, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
    🎬 Watch Together
  </button>
)}

      {showAI && (
        <div style={{ marginTop: 8, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {analyzing ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Watching video…</div>
          ) : analysis ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 600, flex: 1 }}>{analysis.concise_summary}</div>
                {analysis.credibility && (
                  <div
                    title={analysis.credibility_note || ''}
                    style={{ fontSize: 10, fontWeight: 800, color: credColor, border: `1px solid ${credColor}55`, borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap', textTransform: 'uppercase' }}
                  >
                    {analysis.credibility}
                  </div>
                )}
              </div>

              {analysis.key_highlights?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3 }}>Highlights</div>
                  {analysis.key_highlights.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => jumpTo(h.timestamp)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, color: 'var(--text-secondary)' }}
                    >
                      <span style={{ color: '#a78bfa', fontWeight: 700 }}>{h.timestamp}</span> — {h.note}
                    </button>
                  ))}
                </div>
              )}

              {analysis.chapters?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3 }}>Chapters</div>
                  {analysis.chapters.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => jumpTo(c.timestamp)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, color: 'var(--text-secondary)' }}
                    >
                      <span style={{ color: '#a78bfa', fontWeight: 700 }}>{c.timestamp}</span> — {c.title}
                    </button>
                  ))}
                </div>
              )}

              {analysis.extracted_links?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3 }}>Links & resources</div>
                  {analysis.extracted_links.map((link, i) => (
                    <a key={i} href={link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: 11.5, color: '#a78bfa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {link}
                    </a>
                  ))}
                </div>
              )}

              {(hasFlashcards || hasQuiz) && (
                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  {hasFlashcards && (
                    <button onClick={() => setActiveDeck('flashcards')} style={{ flex: 1, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 8, color: '#c4b5fd', fontSize: 11, fontWeight: 700, padding: '6px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      🗂 {analysis.flashcards.length} cards
                    </button>
                  )}
                  {hasQuiz && (
                    <button onClick={() => setActiveDeck('quiz')} style={{ flex: 1, background: 'rgba(240,147,251,0.1)', border: '1px solid rgba(240,147,251,0.25)', borderRadius: 8, color: '#f0abfc', fontSize: 11, fontWeight: 700, padding: '6px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✅ {analysis.quiz.length}-Q quiz
                    </button>
                  )}
                </div>
              )}

              {analysis.study_notes && (
                <details style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  <summary style={{ cursor: 'pointer', color: '#a78bfa', fontWeight: 700 }}>Study notes</summary>
                  <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{analysis.study_notes}</div>
                </details>
              )}

              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  value={question} onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                  placeholder="Ask about this video…"
                  style={{ flex: 1, background: 'var(--bg-surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit' }}
                />
                <button onClick={handleAsk} disabled={asking} style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {asking ? '…' : 'Ask'}
                </button>
              </div>
              {answer && <div style={{ fontSize: 12, color: 'var(--text-primary)', background: 'rgba(167,139,250,0.08)', borderRadius: 8, padding: 8 }}>{answer}</div>}
            </>
          ) : null}
        </div>
      )}

      {activeDeck === 'flashcards' && (
        <FlashcardDeck cards={analysis.flashcards} title={meta.title} onClose={() => setActiveDeck(null)} />
      )}
      {activeDeck === 'quiz' && (
        <QuizRunner questions={analysis.quiz} title={meta.title} onClose={() => setActiveDeck(null)} />
      )}
    </div>
  )
}
