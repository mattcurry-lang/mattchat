import React, { useState, useMemo, useEffect } from 'react'
import { IconX, IconSearch } from '../Icons'
import Avatar from '../Avatar'
import { searchProfilesByUsername } from '../../lib/cycleTrust'

// conversations: the same `conversations` array ChatPage already holds
// (each with conversation_members[].profiles). getConvoName/getOtherUserId
// are passed in so we don't duplicate that logic.
export default function TrustedPersonPicker({ userId, conversations = [], getConvoName, getOtherUserId, onPick, onClose }) {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const contactCandidates = useMemo(() => {
    const seen = new Set()
    return (conversations || [])
      .filter(c => !c.is_group)
      .map(c => {
        const otherId = getOtherUserId(c, userId)
        const other = c.conversation_members?.find(m => m.user_id !== userId)
        return otherId ? { id: otherId, username: other?.profiles?.username, avatar_url: other?.profiles?.avatar_url } : null
      })
      .filter(p => {
        if (!p || seen.has(p.id)) return false
        seen.add(p.id)
        return true
      })
  }, [conversations, userId, getOtherUserId])

  useEffect(() => {
    if (query.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try { setSearchResults(await searchProfilesByUsername(query, userId)) }
      catch (e) { console.error('search failed:', e) }
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query, userId])

  const filteredContacts = contactCandidates.filter(p =>
    (p.username || '').toLowerCase().includes(query.toLowerCase())
  )

  // Merge: contacts matching the query first, then search results not
  // already shown as a contact.
  const contactIds = new Set(filteredContacts.map(p => p.id))
  const extraResults = searchResults.filter(p => !contactIds.has(p.id))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>
          Add a trusted person
        </h2>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer' }}><IconX size={15} /></button>
      </div>

      <div style={{ padding: '0 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '10px 14px' }}>
          <IconSearch size={15} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search Mattchat by username"
            style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14, fontFamily: 'inherit', flex: 1 }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 24px' }}>
        {filteredContacts.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '8px 0' }}>
              Your conversations
            </div>
            {filteredContacts.map(p => (
              <PersonRow key={p.id} person={p} onClick={() => onPick(p)} />
            ))}
          </>
        )}

        {query.trim().length >= 2 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '14px 0 8px' }}>
              On Mattchat
            </div>
            {searching && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '8px 4px' }}>Searching…</div>}
            {!searching && extraResults.length === 0 && filteredContacts.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '8px 4px' }}>No one found with that username.</div>
            )}
            {extraResults.map(p => (
              <PersonRow key={p.id} person={p} onClick={() => onPick(p)} />
            ))}
          </>
        )}

        {query.trim().length < 2 && filteredContacts.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '20px 4px', textAlign: 'center' }}>
            Search for anyone on Mattchat to add them to your Trusted Circle.
          </div>
        )}
      </div>
    </div>
  )
}

function PersonRow({ person, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 8px',
        background: 'none', border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
        textAlign: 'left',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <Avatar name={person.username || 'Unknown'} size={40} photoUrl={person.avatar_url} />
      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{person.username || 'Unknown'}</div>
    </button>
  )
}
