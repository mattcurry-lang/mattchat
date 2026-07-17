import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { callCurryAI } from './CurryAI'
import { IconFolder, IconX } from './Icons'
// Memory Vault — two ways in to what Curry has actually learned:
// 1. Search: semantic search over everything shared with Curry, via the
//    same embedding pipeline used for in-chat recall (memory_search).
// 2. Facts: the structured curry_ai_memory row (goals, projects,
//    interests, habits, etc.), read directly via RLS — same pattern as
//    ChatPage's loadSharedConvoIds, no edge function needed for this part.
//
// Nothing here is invented — search results are real messages the person
// shared, and facts are only whatever Curry has actually extracted from
// real conversations over time.

function prettifyKey(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
function renderValue(v) {
  if (Array.isArray(v)) {
    return v.map((item) => (typeof item === 'object' ? Object.values(item).join(' — ') : String(item))).join(', ')
  }
  if (typeof v === 'object' && v !== null) return Object.values(v).join(', ')
  return String(v)
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function useMemoryFacts(userId) {
  const [facts, setFacts] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('curry_ai_memory').select('memory, updated_at').eq('user_id', userId).maybeSingle()
      if (!cancelled) {
        setFacts(data?.memory || {})
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  return { facts, loading }
}

export default function MemoryVault({ session, userId, onOpenConversation, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const { facts, loading: factsLoading } = useMemoryFacts(userId)

  const runSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    setSearchError('')
    try {
      const data = await callCurryAI('memory_search', { query: query.trim() }, session)
      if (data.ok) setResults(data.results || [])
      else setSearchError(data.error || 'Search failed')
    } catch (e) {
      setSearchError('Network error searching memories')
    }
    setSearching(false)
  }, [query, session])

  const factEntries = facts
    ? Object.entries(facts).filter(([k, v]) => k !== 'lastSeen' && v && v !== 'true' && v !== 'false')
    : []

  return (
    <div style={s.container}>
      <div style={s.header}>
      <span style={{ ...s.title, display: 'flex', alignItems: 'center', gap: 8 }}><IconFolder size={16} /> Memory Vault</span>
        <button style={s.closeBtn} onClick={onClose}><IconX size={15} /></button>
      </div>

      <div style={s.body}>
        <div style={s.section}>
          <div style={s.sectionTitle}>Search everything shared with Curry</div>
          <div style={s.searchRow}>
            <input
              style={s.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder='Try "wifi password" or "vacation ideas"...'
            />
            <button style={s.searchBtn} onClick={runSearch} disabled={searching || !query.trim()}>
              {searching ? '...' : 'Search'}
            </button>
          </div>

          {searchError && <div style={s.errorText}>{searchError}</div>}

          {results !== null && !searching && (
            results.length === 0 ? (
              <div style={s.empty}>Nothing matched that — try different words, or share more chats with Curry first.</div>
            ) : (
              <div style={s.resultsList}>
                {results.map((r, i) => (
                  <div key={i} style={s.resultCard}>
                    <div style={s.resultMeta}>
                      <span style={s.resultSender}>{r.sender}</span>
                      <span style={s.resultDate}>{formatDate(r.date)}</span>
                    </div>
                    <div style={s.resultContent}>{r.content}</div>
                    {r.conversationId && onOpenConversation && (
                      <button style={s.jumpBtn} onClick={() => { onOpenConversation(r.conversationId); onClose() }}>
                        Open in {r.conversationName} →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div style={s.section}>
          <div style={s.sectionTitle}>What Curry knows about you</div>
          {factsLoading ? (
            <div style={s.empty}>Loading…</div>
          ) : factEntries.length === 0 ? (
            <div style={s.empty}>Nothing learned yet — the more you talk with Curry directly, the more it remembers.</div>
          ) : (
            <div style={s.factsCard}>
              {factEntries.map(([key, value]) => (
                <div key={key} style={s.factRow}>
                  <span style={s.factKey}>{prettifyKey(key)}</span>
                  <span style={s.factValue}>{renderValue(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={s.footnote}>
          Search covers conversations you've explicitly shared with Curry. Facts come only from your direct conversations with Curry — nothing here is guessed.
        </div>
      </div>
    </div>
  )
}

const s = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'linear-gradient(180deg,#0d0d1a 0%,#111827 100%)', fontFamily: "'Inter',sans-serif" },
  header: { padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)' },
  title: { fontSize: 15, fontWeight: 700, color: '#f0f0f0' },
  closeBtn: { background: 'none', border: 'none', color: '#666', fontSize: 15, cursor: 'pointer' },
  body: { flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 22 },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#c4b5fd' },
  searchRow: { display: 'flex', gap: 8 },
  searchInput: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, padding: '9px 12px', outline: 'none', fontFamily: 'inherit' },
  searchBtn: { background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, padding: '9px 16px', cursor: 'pointer', fontFamily: 'inherit' },
  errorText: { fontSize: 12, color: '#f87171' },
  empty: { fontSize: 12.5, color: '#9ca3af', padding: '6px 0' },
  resultsList: { display: 'flex', flexDirection: 'column', gap: 8 },
  resultCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 },
  resultMeta: { display: 'flex', justifyContent: 'space-between', fontSize: 11 },
  resultSender: { color: '#c4b5fd', fontWeight: 700 },
  resultDate: { color: '#6b7280' },
  resultContent: { fontSize: 13, color: '#e5e7eb', lineHeight: 1.5 },
  jumpBtn: { alignSelf: 'flex-start', background: 'none', border: 'none', color: '#a5b4fc', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' },
  factsCard: { background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 },
  factRow: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 },
  factKey: { color: '#9ca3af', fontWeight: 600, flexShrink: 0 },
  factValue: { color: '#e5e7eb', textAlign: 'right' },
  footnote: { fontSize: 10.5, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },
}
