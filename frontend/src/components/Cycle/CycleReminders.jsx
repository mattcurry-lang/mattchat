import React, { useState } from 'react'
import { IconX, IconBell } from '../Icons'
import { upsertCycleSettings } from '../../lib/cycle'

const DAY_OPTIONS = [1, 2, 3, 5, 7]

export default function CycleReminders({ userId, settings, onSaved, onClose }) {
  const initial = settings?.reminders || {}
  const [daysBefore, setDaysBefore] = useState(initial.daysBefore || [2])
  const [periodStart, setPeriodStart] = useState(initial.periodStart ?? true)
  const [dailyCheckin, setDailyCheckin] = useState(initial.dailyCheckin ?? false)
  const [customText, setCustomText] = useState(initial.customText || '')
  const [saving, setSaving] = useState(false)
  const [reminderHour, setReminderHour] = useState(initial.reminderHour ?? settings?.reminder_hour ?? 9)

  const toggleDay = (d) => {
    setDaysBefore(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b))
  }
<div>
  <SectionLabel>Send reminders around</SectionLabel>
  <select
    value={reminderHour}
    onChange={e => setReminderHour(Number(e.target.value))}
    style={{
      width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12, padding: '10px 12px', color: '#fff', fontSize: 13.5, fontFamily: 'inherit',
    }}
  >
    {Array.from({ length: 24 }, (_, h) => (
      <option key={h} value={h} style={{ color: '#000' }}>
        {h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`}
      </option>
    ))}
  </select>
  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
    Based on your device's timezone, detected automatically.
  </div>
</div>
  const save = async () => {
    setSaving(true)
    try {
      await upsertCycleSettings(userId, {
        reminder_hour: reminderHour,
        reminders: { daysBefore, periodStart, dailyCheckin, customText: customText.trim() || null },
      })
      onSaved?.()
      onClose()
    } catch (e) {
      console.error('save reminders failed:', e)
      alert('Could not save reminder settings.')
    }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconBell size={16} /> Reminders
        </h2>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer' }}><IconX size={15} /></button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 18px 100px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        <div>
          <SectionLabel>Remind me before my period</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DAY_OPTIONS.map(d => (
              <Chip key={d} active={daysBefore.includes(d)} onClick={() => toggleDay(d)}>
                {d} day{d > 1 ? 's' : ''} before
              </Chip>
            ))}
          </div>
        </div>

        <ToggleRow label="Period-start reminder" value={periodStart} onChange={setPeriodStart} />
        <ToggleRow label="Daily check-in reminder" value={dailyCheckin} onChange={setDailyCheckin} />

        <div>
          <SectionLabel>Notification wording</SectionLabel>
          <input
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder="🌸 A private reminder from Mattchat"
            style={{
              width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: '10px 12px', color: '#fff', fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
            }}
          />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6, lineHeight: 1.5 }}>
            Notifications stay discreet by default — no cycle details shown on your lock screen.
          </div>
        </div>

        <button className="btn-primary" style={{ padding: 14, fontSize: 14.5, borderRadius: 16 }} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save reminder settings'}
        </button>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{children}</div>
}

function ToggleRow({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px' }}>
      <span style={{ fontSize: 13.5, color: '#fff', fontWeight: 600 }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
          background: value ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : 'rgba(255,255,255,0.15)',
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: value ? 21 : 3, width: 20, height: 20, borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      </button>
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${active ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.12)'}`,
        background: active ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : 'rgba(255,255,255,0.05)',
        color: active ? '#fff' : 'rgba(255,255,255,0.65)',
      }}
    >
      {children}
    </button>
  )
}
