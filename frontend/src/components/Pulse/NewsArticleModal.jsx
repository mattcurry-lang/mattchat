import React from 'react'
import { createPortal } from 'react-dom'

function formatPublished(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function NewsArticleModal({ article, onClose }) {
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'var(--bg-surface-1, #0f0f1a)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-surface-1, #14141f)', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 }}>←</button>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Article</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 20px 60px' }}>
          {article.image && (
            <img
              src={article.image}
              alt=""
              style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 16, marginBottom: 18, display: 'block' }}
            />
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            {article.source} {article.publishedAt && `· ${formatPublished(article.publishedAt)}`}
          </div>

          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.35, margin: '0 0 16px' }}>
            {article.title}
          </h1>

          {article.summary ? (
            <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 24px' }}>
              {article.summary}
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 24px' }}>
              No summary available for this article.
            </p>
          )}

          
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg,#667eea,#764ba2)', borderRadius: 20,
              color: '#fff', fontSize: 13, fontWeight: 700, padding: '10px 18px', textDecoration: 'none',
            }}
          >
            Read full article on {article.source} ↗
          </a>
        </div>
      </div>
    </div>,
    document.body
  )
}
