import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { searchInstagramProfile } from '../../lib/instagram'
import { openInstagramProfile } from '../../lib/openInstagram'
import Avatar from '../Avatar'

function formatCount(n) {
  if (n == null) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export default function InstagramSearch({ session, onAction }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    const username = query.trim()
    if (!username) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await searchInstagramProfile(session, username)
      if (data.ok) setResult(data.profile)
      else setError(data.reason === 'not_found_or_private' ? "Couldn't find that profile — it may be private or not a business/creator account." : 'Search failed. Please try again.')
    } catch (e2) {
      setError('Search failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Instagram username"
          style={{
            flex: 1, background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '10px 12px', color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          style={{
            background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 12,
            color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '0 16px', cursor: 'pointer',
            fontFamily: 'inherit', opacity: loading || !query.trim() ? 0.6 : 1,
          }}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Search works for public Instagram business and creator accounts, per Instagram's API rules.
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 12px' }}>
          {error}
        </div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ borderRadius: 16, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Avatar name={result.username} size={52} photoUrl={result.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)' }}>{result.displayName || result.username}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>@{result.username}</div>
              </div>
            </div>

            {result.bio && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.4 }}>{result.bio}</div>}

            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12.5, color: 'var(--text-secondary)' }}>
              {result.followerCount != null && <span><strong style={{ color: 'var(--text-primary)' }}>{formatCount(result.followerCount)}</strong> followers</span>}
              {result.mediaCount != null && <span><strong style={{ color: 'var(--text-primary)' }}>{formatCount(result.mediaCount)}</strong> posts</span>}
            </div>

            <button
              onClick={() => { onAction?.('Opening Instagram to complete this action.'); openInstagramProfile(result.username) }}
              style={{
                marginTop: 12, width: '100%', background: 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af,#515bd4)',
                border: 'none', borderRadius: 12, color: '#fff', fontSize: 12.5, fontWeight: 700,
                padding: '9px 0', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              View full profile on Instagram
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
