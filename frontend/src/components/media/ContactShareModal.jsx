// ContactShareModal.jsx
// Section 1 — "Contact" attachment option. Searches Mattchat's own
// profiles table (not the device Contact Picker API — that's Android
// Chrome-only and would make this invisible to most users) and lets the
// sender pick one to share as a rich contact card. Sharing your own
// profile is a legitimate case ("here's my Mattchat"), so it isn't
// excluded from results.
//
// FIX: listStyle is a flex child (flex:1) with overflowY:'auto' inside a
// height-capped flex column (sheetStyle: height 70vh, maxHeight 520). A
// flex item's default min-height is 'auto' — i.e. sized to its content —
// so without an explicit minHeight:0 the list refused to shrink and just
// grew past the sheet's actual box instead of scrolling inside it. Rows
// still rendered (so the search/list "worked" visually) but landed
// outside the sheet's real clickable area once results overflowed the
// visible bottom-anchored sheet, which is why taps did nothing.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Avatar from '../Avatar'
import { IconX, IconSearch } from '../Icons'

export default function ContactShareModal({ isOpen, onClose, onConfirm, currentUserId }) {
  const [query, setQuery] = useState('')
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) { setQuery(''); setContacts([]); return }
    loadContacts()
  }, [isOpen])

  const loadContacts = async () => {
    setLoading(true)
    const { data: memberRows } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', currentUserId)

    const convoIds = (memberRows || []).map(r => r.conversation_id)
    if (!convoIds.length) { setContacts([]); setLoading(false); return }

    const { data: otherMembers } = await supabase
      .from('conversation_members')
      .select('user_id, profiles(id, username, avatar_url)')
      .in('conversation_id', convoIds)
      .neq('user_id', currentUserId)

    // De-dupe — a group chat can surface the same person more than once
    const seen = new Map()
    for (const row of otherMembers || []) {
      if (row.profiles && !seen.has(row.profiles.id)) seen.set(row.profiles.id, row.profiles)
    }
    setContacts([...seen.values()].sort((a, b) => (a.username || '').localeCompare(b.username || '')))
    setLoading(false)
  }

  if (!isOpen) return null

  const filtered = query.trim()
    ? contacts.filter(c => (c.username || '').toLowerCase().includes(query.trim().toLowerCase()))
    : contacts

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Share Contact</span>
          <button onClick={onClose} style={closeBtnStyle}><IconX size={16} /></button>
        </div>

        <div style={searchWrapStyle}>
          <IconSearch size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your contacts"
            style={inputStyle}
          />
        </div>

        <div style={listStyle}>
          {loading && <div style={emptyStyle}>Loading…</div>}
          {!loading && contacts.length === 0 && <div style={emptyStyle}>You haven't messaged anyone yet.</div>}
          {!loading && contacts.length > 0 && filtered.length === 0 && <div style={emptyStyle}>No matches.</div>}
          {filtered.map(p => (
            <button key={p.id} onClick={() => onConfirm(p)} style={rowStyle}>
              <Avatar name={p.username} photoUrl={p.avatar_url} size={40} />
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <div style={rowNameStyle}>{p.username || 'Unnamed'}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
const sheetStyle = { width: '100%', maxWidth: 420, height: '70vh', maxHeight: 520, background: 'var(--bg-surface-1, #14141f)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }
const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const closeBtnStyle = { background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const searchWrapStyle = { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 12, padding: '9px 12px' }
const inputStyle = { flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 13.5, fontFamily: 'inherit' }
const listStyle = { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }
const emptyStyle = { fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }
const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, fontFamily: 'inherit', textAlign: 'left', width: '100%' }
const rowNameStyle = { fontSize: 13.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
