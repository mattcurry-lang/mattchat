import React, { useState, useMemo } from 'react'

const TABS = ['For You', 'My Team', 'Premier League', 'Transfers', 'Trending']

function categorize(article, teamName) {
  const title = (article.title || '').toLowerCase()
  const teamFirstWord = (teamName || '').toLowerCase().split(' ')[0]
  const categories = ['Premier League'] // default bucket, every article qualifies
  if (teamFirstWord && title.includes(teamFirstWord)) categories.push('My Team')
  if (title.includes('transfer') || title.includes('signing') || title.includes('signs') || title.includes('deal') || title.includes('move to') || title.includes('loan')) {
    categories.push('Transfers')
  }
  return categories
}

function relativeTime(iso) {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diffMs)) return null
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${Math.max(mins, 1)}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NewsTabs({ articles, teamName, onOpenArticle }) {
  const [tab, setTab] = useState('For You')

  const filtered = useMemo(() => {
    if (!articles) return []
    if (tab === 'For You') return articles
    if (tab === 'Trending') return articles.slice(0, 6) // already most-recent-first from source
    return articles.filter((a) => categorize(a, teamName).includes(tab))
  }, [articles, tab, teamName])

  if (!articles || articles.length === 0) return null

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(127,127,127,0.9)', marginBottom: 6 }}>Latest News</div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 6, marginBottom: 4 }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 20,
              border: tab === t ? 'none' : '1px solid var(--border)',
              background: tab === t ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : 'none',
              color: tab === t ? '#fff' : 'inherit',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.5, padding: '10px 0' }}>No {tab.toLowerCase()} stories right now.</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
          {filtered.slice(0, 6).map((a, i) => {
            const time = relativeTime(a.publishedAt || a.date || a.pubDate)
            return (
              <button
                key={i}
                onClick={() => onOpenArticle(a)}
                style={{
                  flexShrink: 0, width: 160, borderRadius: 12, overflow: 'hidden', position: 'relative',
                  background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'left',
                  padding: 0, cursor: 'pointer', fontFamily: 'inherit', height: 140,
                }}
              >
                {a.image && (
                  <img src={a.image} alt="" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0, padding: '20px 8px 8px',
                  background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.9))',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {a.title}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.65)', marginTop: 4, display: 'flex', gap: 6 }}>
                    <span>{a.source}</span>
                    {time && <span>· {time}</span>}
                    {a.readingTime && <span>· {a.readingTime} min read</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
