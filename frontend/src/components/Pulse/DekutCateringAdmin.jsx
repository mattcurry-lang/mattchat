// src/components/Pulse/DekutCateringAdmin.jsx
//
// Admin-only. This is where real catering data actually enters Curry's
// world — mount this behind the same admin gate as RoomFinder's pending
// queue / DekutKnowledgeAdmin.

import React, { useState } from 'react'
import { DekutIcon } from './dekutIcons'
import { useDekutCatering } from '../../hooks/useDekutCatering'

const TEXT_PRIMARY = '#f5f5fa'
const TEXT_SECONDARY = 'rgba(245,245,250,0.6)'
const BORDER = 'rgba(245,245,250,0.16)'
const SURFACE = 'rgba(245,245,250,0.06)'

function inputStyle() {
  return {
    border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px',
    fontSize: 12.5, background: 'rgba(15,15,26,0.9)', color: TEXT_PRIMARY, fontFamily: 'inherit',
    boxSizing: 'border-box',
  }
}

function MessRow({ mess, onToggleOpen, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>{mess.name}</div>
        {mess.notes && <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 }}>{mess.notes}</div>}
      </div>
      <button onClick={() => onToggleOpen(mess)} style={{
        fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${mess.is_open ? 'rgba(52,211,153,0.4)' : BORDER}`,
        background: mess.is_open ? 'rgba(52,211,153,0.12)' : 'transparent',
        color: mess.is_open ? '#6ee7b7' : TEXT_SECONDARY,
      }}>
        {mess.is_open ? 'Open' : 'Closed'}
      </button>
      <button onClick={() => onDelete(mess.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
        <DekutIcon type="x" size={14} color="#fca5a5" strokeWidth={2} />
      </button>
    </div>
  )
}

function ItemForm({ messes, onSave, saving }) {
  const [form, setForm] = useState({ mess_id: messes[0]?.id ?? '', name: '', unit_price: '', category: '', is_available: true })
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.mess_id || !form.name.trim() || form.unit_price === '') return
    await onSave({ ...form, unit_price: Number(form.unit_price) })
    setForm((f) => ({ ...f, name: '', unit_price: '' }))
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
      <select value={form.mess_id} onChange={set('mess_id')} style={inputStyle()}>
        {messes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <input placeholder="Item name" value={form.name} onChange={set('name')} style={inputStyle()} />
      <input placeholder="Price (KSh)" type="number" min="0" value={form.unit_price} onChange={set('unit_price')} style={inputStyle()} />
      <button type="submit" disabled={saving} style={{
        fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 10,
        background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        Add
      </button>
    </form>
  )
}

function ItemRow({ item, onToggleAvailable, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: TEXT_PRIMARY }}>{item.name}</span>
        {item.category && <span style={{ fontSize: 10.5, color: TEXT_SECONDARY, marginLeft: 8 }}>{item.category}</span>}
      </div>
      <div style={{ fontSize: 12.5, color: TEXT_PRIMARY, fontWeight: 700 }}>KSh {item.unit_price}</div>
      <button onClick={() => onToggleAvailable(item)} style={{
        fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${item.is_available ? 'rgba(52,211,153,0.4)' : BORDER}`,
        background: item.is_available ? 'rgba(52,211,153,0.12)' : 'transparent',
        color: item.is_available ? '#6ee7b7' : TEXT_SECONDARY,
      }}>
        {item.is_available ? 'Available' : 'Sold out'}
      </button>
      <button onClick={() => onDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
        <DekutIcon type="x" size={13} color="#fca5a5" strokeWidth={2} />
      </button>
    </div>
  )
}

export default function DekutCateringAdmin() {
  const { messes, items, loading, saveMess, deleteMess, saveItem, deleteItem } = useDekutCatering()
  const [newMessName, setNewMessName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAddMess = async (e) => {
    e.preventDefault()
    if (!newMessName.trim()) return
    setSaving(true)
    try {
      await saveMess({ name: newMessName.trim() })
      setNewMessName('')
    } finally {
      setSaving(false)
    }
  }

  const handleAddItem = async (payload) => {
    setSaving(true)
    try { await saveItem(payload) } finally { setSaving(false) }
  }

  if (loading) return <div style={{ fontSize: 12.5, color: TEXT_SECONDARY }}>Loading…</div>

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 4 }}>Catering Menu</div>
        <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, marginBottom: 14 }}>
          This is the real menu Curry orders from — nothing here is invented, so keep it current.
        </div>

        <form onSubmit={handleAddMess} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input placeholder="New mess name (e.g. Mess A)" value={newMessName} onChange={(e) => setNewMessName(e.target.value)} style={{ ...inputStyle(), flex: 1 }} />
          <button type="submit" disabled={saving} style={{
            fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 10,
            background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Add Mess
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messes.map((m) => (
            <MessRow key={m.id} mess={m} onToggleOpen={(mess) => saveMess({ id: mess.id, is_open: !mess.is_open })} onDelete={deleteMess} />
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 10 }}>Add a menu item</div>
        {messes.length === 0 ? (
          <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>Add a mess first.</div>
        ) : (
          <ItemForm messes={messes} onSave={handleAddItem} saving={saving} />
        )}
      </div>

      {messes.map((mess) => {
        const messItems = items.filter((i) => i.mess_id === mess.id)
        if (messItems.length === 0) return null
        return (
          <div key={mess.id}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 6 }}>{mess.name}</div>
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '4px 10px' }}>
              {messItems.map((item) => (
                <ItemRow key={item.id} item={item} onToggleAvailable={(i) => saveItem({ id: i.id, is_available: !i.is_available })} onDelete={deleteItem} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
