// src/components/Pulse/SuggestLocationForm.jsx
//
// "Suggest a location" — the crowdsourcing half of the Room Finder
// (spec §4). Any student can submit one; it's invisible to everyone but
// them and admins until an admin approves it (see dekut_locations RLS).

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { DekutIcon } from './dekutIcons'

const CATEGORIES = [
  { id: 'lecture', label: 'Lecture Room' },
  { id: 'office', label: 'Office' },
  { id: 'facility', label: 'Facility' },
  { id: 'hostel', label: 'Hostel' },
  { id: 'dining', label: 'Dining' },
  { id: 'other', label: 'Other' },
]

const inputStyle = {
  width: '100%', border: '1px solid var(--border)', borderRadius: 10,
  padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)',
  background: 'var(--bg-surface-1, rgba(0,0,0,0.03))', fontFamily: 'inherit',
}
const labelStyle = { fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5, display: 'block' }

export default function SuggestLocationForm({ onSubmit, onClose }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('lecture')
  const [building, setBuilding] = useState('')
  const [floor, setFloor] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [landmark, setLandmark] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        category,
        building: building.trim() || null,
        floor: floor.trim() || null,
        room_number: roomNumber.trim() || null,
        landmark: landmark.trim() || null,
        keywords: [name.trim().toLowerCase()],
      })
      setDone(true)
    } catch (err) {
      console.error('submitLocation failed:', err)
      setError('Could not submit — please try again.')
    }
    setSubmitting(false)
  }

  return createPortal(
    <div
      role="dialog" aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200, display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, background: 'var(--bg-surface-2)',
          border: '1px solid var(--border)', borderRadius: 20, padding: 20,
          maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>📍 Suggest a Location</div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <DekutIcon type="x" size={16} color="var(--text-primary)" strokeWidth={2.2} />
          </button>
        </div>

        {done ? (
          <div style={{ padding: '18px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Thanks!</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              This will show up in Room Finder once it's reviewed and approved.
            </div>
            <button
              onClick={onClose}
              style={{
                marginTop: 14, background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', border: 'none',
                borderRadius: 999, color: '#fff', fontWeight: 700, fontSize: 12.5, padding: '9px 18px',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Help other students find this place — only submit locations you're sure about.
            </div>

            <div>
              <label style={labelStyle}>Name *</label>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. RC22" required autoFocus />
            </div>

            <div>
              <label style={labelStyle}>Category</label>
              <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Building</label>
                <input style={inputStyle} value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="e.g. RC Block" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Floor</label>
                <input style={inputStyle} value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="e.g. Ground Floor" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Room number</label>
              <input style={inputStyle} value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="Optional" />
            </div>

            <div>
              <label style={labelStyle}>How to find it</label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Opposite the library, first door on the left"
              />
            </div>

            {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}

            <button
              type="submit"
              disabled={submitting || !name.trim()}
              style={{
                background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', border: 'none', borderRadius: 999,
                color: '#fff', fontWeight: 700, fontSize: 13, padding: '11px 18px', cursor: submitting ? 'default' : 'pointer',
                fontFamily: 'inherit', opacity: submitting || !name.trim() ? 0.6 : 1, marginTop: 4,
              }}
            >
              {submitting ? 'Submitting…' : 'Submit for review'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}
