// src/components/YouTubeCard.jsx
// The YouTube card shown inside a chat bubble.
//
// Same props and behaviour as before (play, watch together, AI summary and notes,
// chapters that jump to a time, flashcards, quiz, ask-about-this-video). New:
//   * the picture appears instantly (no waiting for YouTube's details), then sharpens
//   * a soft glow taken from the picture, a glass play button, one consistent icon set
//   * readable text on your dark chat (the old card used a dark-grey text colour)
//   * a summary that can fail without leaving an empty box, and safe links only

import React, { useEffect, useRef, useState } from 'react'
import { fetchYouTubeOEmbed } from '../lib/youtube'
import { analyzeYouTubeVideo, askYouTubeVideo } from '../lib/supabase'
import FlashcardDeck from './FlashcardDeck'
import QuizRunner from './QuizRunner'
import { useYouTubeThumb } from '../hooks/useYouTubeThumb'
import { timestampToSeconds, safeHttpUrl, watchUrl, avatarGradient, initialOf } from '../lib/youtubeThumb'
import { ensureYouTubeStyles } from './youtube/youtubeStyles'
import { PlayIcon, SparkIcon, UsersIcon, ExternalIcon } from './youtube/ytIcons'

ensureYouTubeStyles()

const CREDIBILITY_COLORS = { high: '#4ade80', moderate: '#fbbf24', low: '#fb7185', unclear: '#9a94bd' }

function linkLabel(href) {
  try { const u = new URL(href); return u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname : '') } catch { return href }
}

export default function YouTubeCard({ videoId, onPlay, onWatchTogether, session }) {
  const { src } = useYouTubeThumb(videoId)
  const [meta, setMeta] = useState(null)
  const [failed, setFailed] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [asking, setAsking] = useState(false)
  const [activeDeck, setActiveDeck] = useState(null) // 'flashcards' | 'quiz' | null
  const alive = useRef(true)

  useEffect(() => () => { alive.current = false }, [])

  useEffect(() => {
    let cancelled = false
    setMeta(null)
    setFailed(false)
    fetchYouTubeOEmbed(videoId).then((data) => {
      if (cancelled) return
      if (data) setMeta(data)
      else setFailed(true)
    })
    return () => { cancelled = true }
  }, [videoId])

  const runAnalysis = async () => {
    setAnalyzing(true)
    setAnalysisError(false)
    try {
      const res = await analyzeYouTubeVideo(session, videoId)
      if (!alive.current) return
      if (res && res.ok) setAnalysis(res.analysis)
      else setAnalysisError(true)
    } catch (e) {
      console.error('Video analysis failed:', e)
      if (alive.current) setAnalysisError(true)
    }
    if (alive.current) setAnalyzing(false)
  }

  const handleSummarize = () => {
    if (showAI) { setShowAI(false); return }
    setShowAI(true)
    if (analysis || analyzing) return
    runAnalysis()
  }

  const handleAsk = async () => {
    if (!question.trim()) return
    setAsking(true)
    setAnswer(null)
    try {
      const res = await askYouTubeVideo(session, videoId, question)
      if (alive.current) setAnswer(res.ok ? res.answer : "Couldn't get an answer.")
    } catch {
      if (alive.current) setAnswer("Couldn't get an answer.")
    }
    if (alive.current) setAsking(false)
  }

  const play = () => onPlay?.(videoId)
  // Passes a start time in seconds as the second argument (YouTubePlayer's startSeconds).
  const jumpTo = (timestamp) => onPlay?.(videoId, timestampToSeconds(timestamp))

  const title = meta?.title || ''
  const hasFlashcards = analysis?.flashcards?.length > 0
  const hasQuiz = analysis?.quiz?.length > 0
  const credColor = CREDIBILITY_COLORS[analysis?.credibility] || CREDIBILITY_COLORS.unclear
  const links = (analysis?.extracted_links || []).map(safeHttpUrl).filter(Boolean)

  return (
    <div className="mc-yt mc-ytc" style={{ width: 'min(300px, 100%)' }}>
      <div className="mc-ytc-glow" aria-hidden="true" style={{ backgroundImage: src ? `url(${src})` : 'none' }} />
      <div className="mc-ytc-card">
        <button type="button" className="mc-ytc-media" onClick={play} aria-label={title ? `Play video: ${title}` : 'Play video'}>
          {src && <img className="mc-yt-img" src={src} alt="" loading="lazy" decoding="async" />}
          <span className="mc-yt-scrim" />
          <span className="mc-yt-chip">YouTube</span>
          <span className="mc-yt-play"><PlayIcon size={22} /></span>
        </button>

        <div className="mc-ytc-body">
          {meta ? (
            <>
              <button type="button" className="mc-ytc-title" onClick={play}>{meta.title}</button>
              <div className="mc-ytc-channel">
                <span className="mc-yt-avatar" style={{ background: avatarGradient(meta.authorName) }} aria-hidden="true">{initialOf(meta.authorName)}</span>
                <span>{meta.authorName}</span>
              </div>
            </>
          ) : failed ? (
            <>
              <div className="mc-ytc-title" style={{ cursor: 'default' }}>YouTube video</div>
              <div className="mc-ytc-channel">Details aren’t available for this video.</div>
            </>
          ) : (
            <div aria-busy="true" aria-label="Loading video details">
              <div className="mc-yt-skel" style={{ height: 13, width: '92%' }} />
              <div className="mc-yt-skel" style={{ height: 13, width: '64%', marginTop: 7 }} />
              <div className="mc-yt-skel" style={{ height: 11, width: '38%', marginTop: 10 }} />
            </div>
          )}
        </div>

        <div className="mc-ytc-actions">
          <button type="button" className="mc-yt-btn mc-yt-btn--primary" onClick={play}>
            <PlayIcon size={13} /> Play
          </button>
          <button type="button" className="mc-yt-btn mc-yt-btn--violet" onClick={handleSummarize} aria-expanded={showAI}>
            <SparkIcon /> {showAI ? 'Hide summary' : 'AI summary'}
          </button>
          {onWatchTogether && (
            <button type="button" className="mc-yt-btn" onClick={() => onWatchTogether(videoId, meta?.title || 'YouTube video', meta?.thumbnailUrl || src)}>
              <UsersIcon /> Watch together
            </button>
          )}
          <a className="mc-yt-link" href={watchUrl(videoId)} target="_blank" rel="noopener noreferrer">
            Open on YouTube <ExternalIcon />
          </a>
        </div>

        <div className="mc-ytc-panel" data-open={showAI ? 'true' : 'false'}>
          <div>
            <div className="mc-ytc-panel-in" aria-live="polite">
              {analyzing && (
                <div aria-busy="true">
                  <div className="mc-yt-note">Watching the video…</div>
                  <div className="mc-yt-skel" style={{ height: 12, width: '90%', marginTop: 10 }} />
                  <div className="mc-yt-skel" style={{ height: 12, width: '76%', marginTop: 7 }} />
                  <div className="mc-yt-skel" style={{ height: 12, width: '58%', marginTop: 7 }} />
                </div>
              )}

              {!analyzing && analysisError && (
                <div>
                  <div className="mc-yt-err">Couldn’t analyze this video right now.</div>
                  <button type="button" className="mc-yt-btn" style={{ marginTop: 8 }} onClick={runAnalysis}>Try again</button>
                </div>
              )}

              {!analyzing && analysis && (
                <>
                  <div className="mc-yt-top">
                    <div className="mc-yt-sum">{analysis.concise_summary}</div>
                    {analysis.credibility && (
                      <span className="mc-yt-badge" style={{ color: credColor }} title={analysis.credibility_note || ''}>
                        {analysis.credibility}
                      </span>
                    )}
                  </div>

                  {analysis.key_highlights?.length > 0 && (
                    <div>
                      <div className="mc-yt-h">Highlights</div>
                      {analysis.key_highlights.map((h, i) => (
                        <button key={i} type="button" className="mc-yt-row" onClick={() => jumpTo(h.timestamp)}>
                          <span className="mc-yt-ts">{h.timestamp}</span><span>{h.note}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {analysis.chapters?.length > 0 && (
                    <div>
                      <div className="mc-yt-h">Chapters</div>
                      {analysis.chapters.map((c, i) => (
                        <button key={i} type="button" className="mc-yt-row" onClick={() => jumpTo(c.timestamp)}>
                          <span className="mc-yt-ts">{c.timestamp}</span><span>{c.title}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {links.length > 0 && (
                    <div>
                      <div className="mc-yt-h">Links & resources</div>
                      {links.map((href, i) => (
                        <a key={i} className="mc-yt-a" href={href} target="_blank" rel="noopener noreferrer">{linkLabel(href)}</a>
                      ))}
                    </div>
                  )}

                  {(hasFlashcards || hasQuiz) && (
                    <div className="mc-yt-decks">
                      {hasFlashcards && <button type="button" className="mc-yt-btn mc-yt-btn--violet" onClick={() => setActiveDeck('flashcards')}>{analysis.flashcards.length} flashcards</button>}
                      {hasQuiz && <button type="button" className="mc-yt-btn mc-yt-btn--violet" onClick={() => setActiveDeck('quiz')}>{analysis.quiz.length}-question quiz</button>}
                    </div>
                  )}

                  {analysis.study_notes && (
                    <details className="mc-yt-notes">
                      <summary>Study notes</summary>
                      <div>{analysis.study_notes}</div>
                    </details>
                  )}

                  <div className="mc-yt-ask">
                    <input
                      className="mc-yt-input" value={question} aria-label="Ask about this video"
                      onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                      placeholder="Ask about this video…"
                    />
                    <button type="button" className="mc-yt-btn mc-yt-btn--primary" onClick={handleAsk} disabled={asking}>{asking ? '…' : 'Ask'}</button>
                  </div>
                  {answer && <div className="mc-yt-answer">{answer}</div>}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeDeck === 'flashcards' && analysis && <FlashcardDeck cards={analysis.flashcards} title={title} onClose={() => setActiveDeck(null)} />}
      {activeDeck === 'quiz' && analysis && <QuizRunner questions={analysis.quiz} title={title} onClose={() => setActiveDeck(null)} />}
    </div>
  )
}
