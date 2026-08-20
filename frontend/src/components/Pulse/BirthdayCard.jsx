import React, { useState } from 'react'
import { motion } from 'framer-motion'

export default function BirthdayCard({ onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!value) return
    setSaving(true)
    try {
      await onSave(value)
    } catch (e) {
      console.error('saveBirthday failed:', e)
    }
    setSaving(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: 18, padding: 16,
        background: 'linear-gradient(135deg, rgba(167,139,250,0.10), rgba(102,126,234,0.10))',
        border: '1px solid rgba(167,139,250,0.22)',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
        Make Pulse a little more personal
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
        Add your birthday so Mattchat can celebrate you.
      </div>

      {editing ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            style={{
              flex: 1, background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
            }}
          />
          <button
            onClick={submit}
            disabled={!value || saving}
            style={{
              background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 10,
              color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '8px 14px',
              cursor: value && !saving ? 'pointer' : 'default', opacity: value && !saving ? 1 : 0.6, fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{
            marginTop: 12, background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.3)',
            borderRadius: 20, color: '#c4b5fd', fontSize: 12.5, fontWeight: 700, padding: '7px 14px',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Add your birthday
        </button>
      )}
    </motion.div>
  )
}
