import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const autoContrastText = {
  color: '#ffffff',
  mixBlendMode: 'difference',
}

const TOGGLES = [
  { key: 'football_match_start', label: 'Match starting' },
  { key: 'football_goal', label: 'Goals' },
  { key: 'football_red_card', label: 'Red cards' },
  { key: 'football_full_time', label: 'Full-time result' },
  { key: 'football_lineup', label: 'Lineup announced' },
  { key: 'football_team_news', label: 'Team news' },
  { key: 'football_transfer_news', label: 'Transfer news' },
  { key: 'football_position_change', label: 'League position changes' },
]

const DEFAULT_ON = new Set(['football_match_start', 'football_goal', 'football_red_card', 'football_full_time'])

export default function NotificationPrefsSheet({ userId, onClose }) {
  const [prefs, setPrefs] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle()
      .then(({ data }) => setPrefs(data || Object.fromEntries(TOGGLES.map(t => [t.key, DEFAULT_ON.has(t.key)]))))
  }, [userId])

  const toggle = async (key) => {
    if (!prefs || saving) return
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaving(true)
    await supabase.from('notification_preferences').upsert({ user_id: userId, ...next }, { onConflict: 'user_id' })
    setSaving(false)
  }

  if (!prefs) return null

  return (
    <div style={{ borderRadius: 18, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, ...autoContrastText }}>Match Notifications</div>
        {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', ...autoContrastText, opacity: 0.6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Done</button>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {TOGGLES.map(t => (
          <button
            key={t.key}
            onClick={() => toggle(t.key)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 12.5, ...autoContrastText }}>{t.label}</span>
            <span style={{
              width: 36, height: 20, borderRadius: 10, position: 'relative', flexShrink: 0,
              background: prefs[t.key] ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : 'rgba(127,127,127,0.25)',
              transition: 'background 0.2s',
            }}>
              <span style={{
                position: 'absolute', top: 2, left: prefs[t.key] ? 18 : 2, width: 16, height: 16,
                borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
