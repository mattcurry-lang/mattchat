import React, { useState, useEffect } from 'react'
import { getAiSettings, updateAiSettings } from '../lib/supabase'
import { IconX } from './Icons'

const LABEL_OPTIONS = ['INBOX', 'IMPORTANT', 'CATEGORY_UPDATES', 'CATEGORY_PROMOTIONS']

function Toggle({ checked, onChange, label, description }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {description && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 42, height: 24, borderRadius: 20, border: 'none', cursor: 'pointer',
          background: checked ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'var(--bg-surface-2)',
          position: 'relative', flexShrink: 0, transition: 'background 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 20 : 2, width: 20, height: 20,
          borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  )
}

export default function AISettingsModal({ userId, onClose }) {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { getAiSettings(userId).then(setSettings) }, [userId])

  const save = async (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next) // optimistic
    setSaving(true)
    try {
      await updateAiSettings(userId, patch)
    } catch (e) {
      console.error('Failed to save AI settings:', e)
    }
    setSaving(false)
  }

  const toggleLabel = (label) => {
    const current = settings.analyzed_labels || ['INBOX']
    const next = current.includes(label) ? current.filter(l => l !== label) : [...current, label]
    save({ analyzed_labels: next.length ? next : ['INBOX'] })
  }

  if (!settings) return null

  return (
    <div className="profile-menu-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface-1, #14141f)', borderRadius: 20, padding: 20, width: 'min(460px, 92vw)', maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>AI Settings</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><IconX size={16} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
          Control what Curry's AI is allowed to do automatically. Turning something off stops future automation — it never deletes what's already there.
        </div>

        <Toggle
          checked={settings.auto_task_creation_enabled}
          onChange={(v) => save({ auto_task_creation_enabled: v })}
          label="Automatic task creation"
          description="Create tasks from actionable emails automatically"
        />
        <Toggle
          checked={settings.ai_scheduling_enabled}
          onChange={(v) => save({ ai_scheduling_enabled: v })}
          label="AI scheduling"
          description="Automatically book study sessions around your calendar"
        />
        <Toggle
          checked={settings.reminders_enabled}
          onChange={(v) => save({ reminders_enabled: v })}
          label="Reminders"
          description="Get notified about upcoming deadlines and sessions"
        />
        <Toggle
          checked={settings.document_analysis_enabled}
          onChange={(v) => save({ document_analysis_enabled: v })}
          label="Document analysis"
          description="Automatically summarize PDF/Word/PPT attachments"
        />

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Which labels get analyzed</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {LABEL_OPTIONS.map(label => {
              const active = (settings.analyzed_labels || []).includes(label)
              return (
                <button
                  key={label}
                  onClick={() => toggleLabel(label)}
                  style={{
                    background: active ? 'rgba(167,139,250,0.2)' : 'var(--bg-surface-2)',
                    border: `1px solid ${active ? 'rgba(167,139,250,0.5)' : 'var(--border)'}`,
                    borderRadius: 20, color: active ? '#c4b5fd' : 'var(--text-muted)',
                    fontSize: 11.5, fontWeight: 700, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {saving && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>Saving…</div>}
      </div>
    </div>
  )
}
