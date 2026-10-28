import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { callCurryAI } from './CurryAI'
import { IconFolder, IconX } from './Icons'

// Memory Vault — what Curry has actually learned, and control over it.
// 1. Facts: the structured curry_ai_memory row (goals, projects,
//    interests, habits…). Each one can be removed individually, or all
//    at once. Nothing here is invented.
// 2. Search: semantic search over chats the person explicitly shared
//    with Curry (memory_search).

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
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

function useMemoryFacts(userId) {
  const [facts, setFacts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.from('curry_ai_memory').select('memory').eq('user_id', userId).maybeSingle()
      if (cancelled) return
      if (error) setLoadError(true)
      setFacts(data?.memory || {})
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  return { facts, setFacts, loading, loadError }
}

const isVisibleFact = ([k, v]) => k !== 'lastSeen' && v && v !== 'true' && v !== 'false'

export default function MemoryVault({ session, userId, onOpenConversation, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [busyKey, setBusyKey] = useState(null)
  const [actionError, setActionError] = useState('')
  const { facts, setFacts, loading: factsLoading, loadError } = useMemoryFacts(userId)

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

  // Re-reads the latest row before writing so a fact Curry learned a
  // moment ago isn't overwritten by a stale copy. `.select()` matters:
  // if row-level security blocks the update, Supabase returns no error
  // but also zero rows — we treat that as a failure instead of
  // pretending it worked.
  async function writeMemory(mutate) {
    const { data: row, error: readError } = await supabase
      .from('curry_ai_memory').select('memory').eq('user_id', userId).maybeSingle()
    if (readError || !row) throw new Error('read failed')
    const next = mutate({ ...(row.memory || {}) })
    const { data: updated, error: writeError } = await supabase
      .from('curry_ai_memory').update({ memory: next }).eq('user_id', userId).select('user_id')
    if (writeError || !updated || updated.length === 0) throw new Error('write blocked')
    return next
  }

  async function removeFact(key) {
    setBusyKey(key)
    setActionError('')
    try {
      const next = await writeMemory((m) => { delete m[key]; return m })
      setFacts(next)
    } catch (e) {
      console.error('removeFact failed:', e)
      setActionError("Couldn't remove that right now. Please try again.")
    }
    setBusyKey(null)
  }

  async function forgetAll() {
    if (!window.confirm("Forget everything Curry has learned about you? This can't be undone.")) return
    setBusyKey('*')
    setActionError('')
    try {
      const next = await writeMemory((m) => (m.lastSeen !== undefined ? { lastSeen: m.lastSeen } : {}))
      setFacts(next)
    } catch (e) {
      console.error('forgetAll failed:', e)
      setActionError("Couldn't clear your memories right now. Please try again.")
    }
    setBusyKey(null)
  }

  const factEntries = facts ? Object.entries(facts).filter(isVisibleFact) : []

  return (
    <div className="cy-root">
      <div className="cy-header">
        <button className="cy-iconbtn" onClick={onClose} aria-label="Back"><BackIcon /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cy-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <IconFolder size={15} /> Memory Vault
          </div>
          <div className="cy-sub">What Curry remembers about you</div>
        </div>
      </div>

      <div className="mv-body">
        <div className="mv-col">
          <p className="mv-intro">
            Everything Curry remembers is listed here, and you decide what stays.
          </p>

          {/* ── Facts ── */}
          <section>
            <h3 className="mv-h">What Curry knows about you</h3>

            {factsLoading ? (
              <div className="mv-empty">Loading…</div>
            ) : loadError ? (
              <div className="mv-error">Couldn't load your memories right now.</div>
            ) : factEntries.length === 0 ? (
              <div className="mv-empty">
                Nothing learned yet. The more you talk with Curry directly, the more it can remember.
              </div>
            ) : (
              <>
                <div className="mv-list">
                  {factEntries.map(([key, value]) => (
                    <div key={key} className="mv-card">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="mv-key">{prettifyKey(key)}</div>
                        <div className="mv-val">{renderValue(value)}</div>
                      </div>
                      <button
                        className="mv-x"
                        onClick={() => removeFact(key)}
                        disabled={busyKey !== null}
                        aria-label={`Remove ${prettifyKey(key)}`}
                        title="Remove"
                      >
                        {busyKey === key ? '…' : <IconX size={13} />}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mv-note">Removed items can come back if you mention them to Curry again.</div>
                <button className="mv-danger" onClick={forgetAll} disabled={busyKey !== null}>
                  {busyKey === '*' ? 'Clearing…' : 'Forget everything'}
                </button>
              </>
            )}

            {actionError && <div className="mv-error" style={{ marginTop: 10 }}>{actionError}</div>}
          </section>

          {/* ── Search ── */}
          <section>
            <h3 className="mv-h">Search chats you've shared</h3>
            <div className="mv-search">
              <input
                className="mv-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder='Try "wifi password" or "vacation ideas"'
                aria-label="Search shared chats"
              />
              <button className="mv-btn" onClick={runSearch} disabled={searching || !query.trim()}>
                {searching ? '…' : 'Search'}
              </button>
            </div>

            {searchError && <div className="mv-error" style={{ marginTop: 10 }}>{searchError}</div>}

            {results !== null && !searching && (
              results.length === 0 ? (
                <div className="mv-empty" style={{ marginTop: 10 }}>
                  Nothing matched. Try different words, or share more chats with Curry first.
                </div>
              ) : (
                <div className="mv-list" style={{ marginTop: 12 }}>
                  {results.map((r, i) => (
                    <div key={i} className="mv-card" style={{ flexDirection: 'column', gap: 6 }}>
                      <div className="mv-meta">
                        <span className="mv-key" style={{ margin: 0 }}>{r.sender}</span>
                        <span>{formatDate(r.date)}</span>
                      </div>
                      <div className="mv-val">{r.content}</div>
                      {r.conversationId && onOpenConversation && (
                        <button className="mv-link" onClick={() => { onOpenConversation(r.conversationId); onClose() }}>
                          Open in {r.conversationName} →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </section>

          <div className="mv-foot">
            Search covers only chats you've explicitly shared with Curry. Facts come from your direct conversations with Curry.
          </div>
        </div>
      </div>
    </div>
  )
}

// Memory Vault styles (reuses .cy-root / .cy-header from CurryAI.jsx)
const mvStyleEl = document.createElement('style')
mvStyleEl.id = 'memory-vault-styles'
mvStyleEl.textContent = `
  .mv-body { flex:1; min-height:0; overflow-y:auto; padding:18px 16px max(28px, env(safe-area-inset-bottom)); }
  .mv-col { max-width:720px; margin:0 auto; display:flex; flex-direction:column; gap:26px; }
  .mv-intro { margin:0; font-size:13.5px; line-height:1.6; color:#9a9cbc; }
  .mv-h { margin:0 0 10px; font-size:11.5px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:#8d8fb0; }
  .mv-list { display:flex; flex-direction:column; gap:8px; }
  .mv-card { display:flex; align-items:flex-start; gap:10px; padding:12px 14px; border-radius:14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); }
  .mv-key { font-size:11px; font-weight:700; color:#c4b5fd; margin-bottom:3px; }
  .mv-val { font-size:13.5px; line-height:1.55; color:#e6e5f2; word-break:break-word; }
  .mv-meta { display:flex; justify-content:space-between; width:100%; font-size:11px; color:#6f7190; }
  .mv-x { width:28px; height:28px; border:none; border-radius:50%; background:transparent; color:#7d7f9c; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:background .15s, color .15s; }
  .mv-x:hover:not(:disabled) { background:rgba(248,113,113,.14); color:#f87171; }
  .mv-x:disabled { opacity:.4; cursor:default; }
  .mv-note { margin-top:10px; font-size:11.5px; color:#7d7f9c; }
  .mv-danger { margin-top:12px; padding:8px 14px; border-radius:999px; border:1px solid rgba(248,113,113,.35); background:rgba(248,113,113,.08); color:#f87171; font:inherit; font-size:12.5px; font-weight:700; cursor:pointer; }
  .mv-danger:disabled { opacity:.5; cursor:default; }
  .mv-search { display:flex; gap:8px; }
  .mv-input { flex:1; min-width:0; padding:10px 14px; border-radius:999px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#f2f1fa; font:inherit; font-size:13.5px; outline:none; transition:border-color .15s, box-shadow .15s; }
  .mv-input:focus { border-color:rgba(167,139,250,.55); box-shadow:0 0 0 4px rgba(167,139,250,.1); }
  .mv-input::placeholder { color:#7d7f9c; }
  .mv-btn { padding:0 18px; border-radius:999px; border:none; background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; font:inherit; font-size:13px; font-weight:700; cursor:pointer; }
  .mv-btn:disabled { opacity:.35; cursor:default; }
  .mv-link { align-self:flex-start; padding:0; background:none; border:none; color:#a5b4fc; font:inherit; font-size:12px; font-weight:700; cursor:pointer; }
  .mv-empty { font-size:13px; color:#8d8fb0; line-height:1.55; }
  .mv-error { font-size:12.5px; color:#fca5a5; background:rgba(248,113,113,.08); border:1px solid rgba(248,113,113,.25); border-radius:10px; padding:8px 12px; }
  .mv-foot { font-size:11px; line-height:1.5; color:#6f7190; text-align:center; }
  .mv-x:focus-visible, .mv-danger:focus-visible, .mv-btn:focus-visible, .mv-link:focus-visible { outline:2px solid #a78bfa; outline-offset:2px; }
`
if (!document.getElementById('memory-vault-styles')) document.head.appendChild(mvStyleEl)
