import { useState, useEffect, useCallback } from 'react'
import { IconCircleDot, IconUsers, IconSparkle, IconBriefcase, IconGraduationCap, IconHomeFamily } from './Icons'

// Smart Collections — horizontal filter tabs above the chat list.
//
// HONEST SCOPE: "All", "Unread", and "Groups" are derived live from
// real data you already have — no guessing. "AI" reuses your existing
// sharedConvoIds. "Work" / "School" / "Family" are NOT auto-classified
// by AI in this pass (that needs a backend job reading each chat and
// tagging it, which is a bigger lift) — instead each conversation can
// be manually tagged via a tag button (see TagPicker below), stored
// per-browser in localStorage under `curry_convo_tags`. This ships
// something real today; swap loadTags/saveTags for a Supabase table
// later if you want tags to sync across devices or auto-classify via AI.

const STORAGE_KEY = 'curry_convo_tags'
const CUSTOM_TAGS = [
  { id: 'work', label: 'Work', Icon: IconBriefcase },
  { id: 'school', label: 'School', Icon: IconGraduationCap },
  { id: 'family', label: 'Family', Icon: IconHomeFamily },
]

function loadTags() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}
function saveTags(tags) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tags)) } catch {}
}

export function useConvoTags() {
  const [tags, setTags] = useState({})
  useEffect(() => { setTags(loadTags()) }, [])

  const setTag = useCallback((convoId, tagId) => {
    setTags(prev => {
      const next = { ...prev }
      if (!tagId || next[convoId] === tagId) delete next[convoId]
      else next[convoId] = tagId
      saveTags(next)
      return next
    })
  }, [])

  return { tags, setTag }
}

export default function SmartCollections({ active, onChange, conversations, unreadCounts, sharedConvoIds, tags }) {
  const counts = {
    all: conversations.length,
    unread: conversations.filter(c => (unreadCounts[c.id] || 0) > 0).length,
    group: conversations.filter(c => c.is_group).length,
    ai: conversations.filter(c => sharedConvoIds.has(c.id)).length,
    work: conversations.filter(c => tags[c.id] === 'work').length,
    school: conversations.filter(c => tags[c.id] === 'school').length,
    family: conversations.filter(c => tags[c.id] === 'family').length,
  }

  const tabs = [
    { id: 'all', label: 'Chats', Icon: null },
    { id: 'unread', label: 'Unread', Icon: IconCircleDot },
    { id: 'group', label: 'Group', Icon: IconUsers },
    { id: 'ai', label: 'AI', Icon: IconSparkle },
    ...CUSTOM_TAGS.map(t => ({ id: t.id, label: t.label, Icon: t.Icon })),
  ].filter(t => t.id === 'all' || t.id === 'unread' || t.id === 'group' || t.id === 'ai' || counts[t.id] > 0)
  // custom tags only show once at least one chat has been tagged, so the row doesn't clutter up empty

  return (
    <div style={s.row}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{ ...s.tab, ...(active === tab.id ? s.tabActive : {}) }}
        >
          {tab.Icon && <tab.Icon size={12} style={{ marginRight: 4 }} />}
          {tab.label}
          {counts[tab.id] > 0 && tab.id !== 'all' && (
            <span style={{ ...s.count, ...(active === tab.id ? s.countActive : {}) }}>{counts[tab.id]}</span>
          )}
        </button>
      ))}
    </div>
  )
}

// Filters a conversation list by the active collection id. Kept as a
// plain function (not a hook) so ChatPage can call it inline alongside
// its existing search filter.
export function filterByCollection(conversations, collectionId, { unreadCounts, sharedConvoIds, tags }) {
  switch (collectionId) {
    case 'unread': return conversations.filter(c => (unreadCounts[c.id] || 0) > 0)
    case 'group':  return conversations.filter(c => c.is_group)
    case 'ai':     return conversations.filter(c => sharedConvoIds.has(c.id))
    case 'work':
    case 'school':
    case 'family': return conversations.filter(c => tags[c.id] === collectionId)
    default:       return conversations
  }
}

// Small tag picker — render next to a contact row (e.g. on hover/long
// press) to assign Work/School/Family. Tapping the same tag again clears it.
export function TagPicker({ convoId, currentTag, onSetTag, onClose }) {
  return (
    <div style={s.picker} onClick={e => e.stopPropagation()}>
      {CUSTOM_TAGS.map(t => (
        <button
          key={t.id}
          style={{ ...s.pickerItem, ...(currentTag === t.id ? s.pickerItemActive : {}), display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => { onSetTag(convoId, t.id); onClose() }}
        >
          <t.Icon size={13} /> {t.label}
        </button>
      ))}
    </div>
  )
}

const s = {
  row: { display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 16px 10px', scrollbarWidth: 'none' },
  tab: {
    display: 'flex', alignItems: 'center', flexShrink: 0,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, color: '#9ca3af', fontSize: 12.5, fontWeight: 600,
    padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  tabActive: {
    background: 'linear-gradient(135deg,#667eea,#764ba2)', border: '1px solid transparent', color: '#fff',
  },
  count: { marginLeft: 5, fontSize: 10.5, opacity: 0.7 },
  countActive: { opacity: 0.85 },
  picker: {
    position: 'absolute', zIndex: 200, background: 'rgba(24,24,38,0.98)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
    minWidth: 140, boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
  },
  pickerItem: {
    display: 'block', textAlign: 'left', background: 'none', border: 'none', color: '#e2e8f0',
    fontSize: 12.5, fontWeight: 500, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
  },
  pickerItemActive: { background: 'rgba(167,139,250,0.15)', color: '#c4b5fd' },
}
