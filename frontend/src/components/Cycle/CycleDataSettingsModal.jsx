import React, { useState } from 'react'
import { IconX, IconTrash } from '../Icons'
import { updateLastPeriodStart, updateCycleLengths, clearCycleHistory } from '../../lib/cycle'

export default function CycleDataSettingsModal({ userId, settings, onSaved, onCleared, onClose }) {
  const [lastPeriodStart, setLastPeriodStart] = useState(settings?.last_period_start || '')
  const [cycleLength, setCycleLength] = useState(settings?.average_cycle_length || 28)
  const [periodLength, setPeriodLength] = useState(settings?.average_period_length || 5)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      if (lastPeriodStart) await updateLastPeriodStart(userId, lastPeriodStart)
      await updateCycleLengths(userId, { averageCycleLength: cycleLength, averagePeriodLength: periodLength })
      onSaved()
      onClose()
    } catch (e) {
      console.error('save cycle data failed:', e)
      alert('Could not save changes — please try again.')
    }
    setSaving(false)
  }

  const clearAll = async () => {
    if (!window.confirm("Delete all your recorded periods and daily check-ins? This can't be undone.")) return
    setClearing(true)
    try {
      await clearCycleHistory(userId)
      onCleared()
      onClose()
    } catch (e) {
      console.error('clearCycleHistory failed:', e)
      alert('Could not clear your data — please try again.')
    }
    setClearing(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, background: '#1b1730', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '20px 22px calc(24px + env(safe-area-inset-bottom,0px))', border: '1px solid rgba(167,139,250,0.25)', borderBottom: 'none',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Edit your cycle info</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', cursor: 'pointer' }}><IconX size={14} /></button>
        </div>

        <div>
          <label style={labelStyle}>Last period start</label>
          <input
            type="date"
            value={lastPeriodStart}
            onChange={e => setLastPeriodStart(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Cycle length (days)</label>
            <input type="number" min={21} max={45} value={cycleLength} onChange={e => setCycleLength(Number(e.target.value))} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Period length (days)</label>
            <input type="number" min={1} max={14} value={periodLength} onChange={e => setPeriodLength(Number(e.target.value))} style={inputStyle} />
          </div>
        </div>

        <button className="btn-primary" style={{ padding: 13, fontSize: 14 }} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
            This permanently deletes your recorded periods and daily check-ins, and takes you back to the setup screen. Reminders and Trusted Circle settings are kept.
          </div>
          <button
            onClick={clearAll}
            disabled={clearing}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 14,
              padding: '11px 14px', color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <IconTrash size={14} /> {clearing ? 'Deleting…' : 'Delete my cycle history'}
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }
const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px', color: '#fff', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }
