// src/components/Pulse/DekutKnowledgeAdmin.jsx
//
// Admin-only knowledge management for Curry (spec §28). Mount this
// behind the same admin gate used for the Room Finder pending queue —
// it is NOT a student-facing component.

import React, { useMemo, useState } from 'react'
import { DekutIcon } from './dekutIcons'
import { useDekutKnowledge } from '../../hooks/useDekutKnowledge'

const TEXT_PRIMARY = '#f5f5fa'
const TEXT_SECONDARY = 'rgba(245,245,250,0.6)'
const BORDER = 'rgba(245,245,250,0.16)'
const SURFACE = 'rgba(245,245,250,0.06)'

const CATEGORIES = ['academic', 'navigation', 'services', 'procedure', 'campus', 'general']
const STATUSES = ['active', 'draft', 'archived']

const EMPTY_FORM = { id: null, title: '', content: '', category: 'general', source: '', authority: '', status: 'active' }

function inputStyle() {
  return {
    width: '100%', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px',
    fontSize: 12.5, background: 'rgba(15,15,26,0.9)', color: TEXT_PRIMARY, fontFamily: 'inherit',
    boxSizing: 'border-box',
  }
}

function KnowledgeForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial)
  const [feedback, setFeedback] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    if (!form.title.trim() || !form.content.trim()) {
      setFeedback({ ok: false, message: 'Title and content are required.' })
      return
    }
    const result = await onSave(form)
    if (result?.ok) {
      setFeedback({ ok: true, message: 'Saved and embedded.' })
      if (!initial.id) setForm(EMPTY_FORM)
    } else {
      setFeedback({ ok: false, message: result?.error || 'Save failed — nothing was written.' })
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, background: SURFACE,
    }}>
      <input placeholder="Title (e.g. Course Registration)" value={form.title} onChange={set('title')} style={inputStyle()} />
      <textarea
        placeholder="Content — the actual, verified information Curry should say"
        value={form.content}
        onChange={set('content')}
        rows={5}
        style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'inherit' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <select value={form.category} onChange={set('category')} style={inputStyle()}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={form.status} onChange={set('status')} style={inputStyle()}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="Source (e.g. DeKUT Academic Office)" value={form.source} onChange={set('source')} style={inputStyle()} />
        <input placeholder="Authority (e.g. Academic Registrar)" value={form.authority} onChange={set('authority')} style={inputStyle()} />
      </div>

      {feedback && (
        <div style={{ fontSize: 11.5, color: feedback.ok ? '#86efac' : '#fca5a5' }}>{feedback.message}</div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{
            fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 10,
            background: 'none', border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={saving} style={{
          fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 10,
          background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', border: 'none', color: '#fff',
          cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit',
        }}>
          {saving ? 'Saving…' : initial.id ? 'Save changes' : 'Add to knowledge base'}
        </button>
      </div>
    </form>
  )
}

function KnowledgeRow({ item, onEdit, onArchive, onDelete }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>{item.title}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: TEXT_SECONDARY, border: `1px solid ${BORDER}`,
            borderRadius: 999, padding: '1px 8px',
          }}>
            {item.category}
          </span>
          {item.status !== 'active' && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>{item.status}</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, marginTop: 3, lineHeight: 1.4 }}>
          {item.content.length > 140 ? `${item.content.slice(0, 140)}…` : item.content}
        </div>
        {item.source && <div style={{ fontSize: 10.5, color: TEXT_SECONDARY, marginTop: 3 }}>Source: {item.source}</div>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={() => onEdit(item)} aria-label={`Edit ${item.title}`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <DekutIcon type="edit" size={14} color={TEXT_SECONDARY} strokeWidth={2} />
        </button>
        {item.status !== 'archived' && (
          <button onClick={() => onArchive(item.id)} aria-label={`Archive ${item.title}`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <DekutIcon type="archive" size={14} color={TEXT_SECONDARY} strokeWidth={2} />
          </button>
        )}
        <button onClick={() => onDelete(item.id)} aria-label={`Delete ${item.title}`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <DekutIcon type="x" size={14} color="#fca5a5" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

export default function DekutKnowledgeAdmin() {
  const { items, loading, saving, saveItem, archiveItem, deleteItem } = useDekutKnowledge()
  const [editing, setEditing] = useState(null) // item being edited, or null = add mode
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return items.filter((i) =>
      (categoryFilter === 'all' || i.category === categoryFilter) &&
      (!q || i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q))
    )
  }, [items, query, categoryFilter])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this knowledge item permanently?')) return
    await deleteItem(id)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 4 }}>
        Curry Knowledge Base
      </div>
      <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, marginBottom: 16 }}>
        Everything here is what Curry is allowed to say. Nothing gets embedded until you save it.
      </div>

      <div style={{ marginBottom: 20 }}>
        <KnowledgeForm
          key={editing?.id ?? 'new'}
          initial={editing ?? EMPTY_FORM}
          saving={saving}
          onSave={saveItem}
          onCancel={editing ? () => setEditing(null) : null}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Search knowledge base..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...inputStyle(), flex: 1 }}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...inputStyle(), width: 150 }}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ fontSize: 12.5, color: TEXT_SECONDARY }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 12.5, color: TEXT_SECONDARY }}>No knowledge items match.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((item) => (
            <KnowledgeRow
              key={item.id}
              item={item}
              onEdit={setEditing}
              onArchive={archiveItem}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
