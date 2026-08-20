import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function NewsArticleModal({ article, onClose }) {
  const [loaded, setLoaded] = useState(false)
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    // Some publishers block being framed (X-Frame-Options/CSP) — we
    // can't detect that directly cross-origin, so a load timeout is
    // the practical signal that something's wrong and we should offer
    // the external-open fallback instead of a permanently blank pane.
    const timer = setTimeout(() => { if (!loaded) setShowFallback(true) }, 4000)
    return () => clearTimeout(timer)
  }, [loaded])

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'var(--bg-surface-1, #0f0f1a)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-surface-1, #14141f)', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {article.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{article.source}</div>
        </div>
        
        <a
          href={article.url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11.5, color: '#c4b5fd', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Open in browser ↗
        </a>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {!loaded && !showFallback && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
            Loading article…
          </div>
        )}
        {showFallback && !loaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>This site can't be shown inside Mattchat.</div>
            
            <a
              href={article.url} target="_blank" rel="noopener noreferrer"
              style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', borderRadius: 20, color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '8px 16px', textDecoration: 'none' }}
            >
              Open in browser
            </a>
          </div>
        )}
        <iframe
          src={article.url}
          title={article.title}
          onLoad={() => setLoaded(true)}
          style={{ width: '100%', height: '100%', border: 'none', background: '#fff', visibility: showFallback && !loaded ? 'hidden' : 'visible' }}
        />
      </div>
    </div>,
    document.body
  )
}
