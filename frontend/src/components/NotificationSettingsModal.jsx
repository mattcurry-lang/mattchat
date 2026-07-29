import React, { useState, useEffect } from 'react'
import { getNotificationPreferences, updateNotificationPreferences } from '../lib/supabase'
import { subscribeToPush, unsubscribeFromPush, getNotificationPermissionState, isPushSupported } from '../lib/pushNotifications'
import { IconX } from './Icons'

function Toggle({ checked, onChange, label }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
     <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark-text)' }}>{label}</div>
      <button onClick={() => onChange(!checked)} style={{ width: 42, height: 24, borderRadius: 20, border: 'none', cursor: 'pointer', background: checked ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'var(--bg-surface-2)', position: 'relative', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: checked ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
      </button>
    </div>
  )
}

export default function NotificationSettingsModal({ userId, onClose }) {
  const [prefs, setPrefs] = useState(null)
  const [permission, setPermission] = useState('default')
  const [subscribing, setSubscribing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getNotificationPreferences(userId).then(setPrefs)
    getNotificationPermissionState().then(setPermission)
  }, [userId])

  const save = async (patch) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    await updateNotificationPreferences(userId, patch)
  }

 const handleEnable = async () => {
  setError(null)
  setSubscribing(true)
  try {
    await subscribeToPush(userId)
    setPermission('granted')
  } catch (e) {
    if (e.message?.includes('push service') || e.name === 'AbortError') {
      setError("Push notifications couldn't register. If you're using Brave, enable \"Use Google services for push messaging\" in brave://settings/privacy, then restart your browser and try again.")
    } else {
      setError(e.message)
    }
  }
  setSubscribing(false)
}

  const handleDisable = async () => {
    await unsubscribeFromPush(userId)
    setPermission('default')
  }

  if (!prefs) return null

  return (
    <div className="profile-menu-overlay" onClick={onClose}>
     <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface-1)', borderRadius: 20, padding: 20, width: 'min(460px, 92vw)', maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
           <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--dark-text)', margin: 0 }}>Notifications</h3>
         <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--dark-text-2)', cursor: 'pointer' }}><IconX size={16} /></button>
        </div>

        {!isPushSupported() && (
          <div style={{ fontSize: 12.5, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
            Push notifications aren't supported in this browser. On iPhone, add Mattchat to your home screen first (Share → Add to Home Screen), then enable notifications from there.
          </div>
        )}

        {isPushSupported() && permission !== 'granted' && (
          <button onClick={handleEnable} disabled={subscribing} style={{ width: '100%', background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 13.5, fontWeight: 700, padding: '12px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
            {subscribing ? 'Enabling…' : 'Enable push notifications'}
          </button>
        )}

        {isPushSupported() && permission === 'granted' && (
          <button onClick={handleDisable} style={{ width: '100%', background: 'none', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-muted)', fontSize: 13.5, fontWeight: 700, padding: '10px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
            Turn off notifications on this device
          </button>
        )}

        {error && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{error}</div>}

        <Toggle checked={prefs.new_messages} onChange={(v) => save({ new_messages: v })} label="New messages" />
        <Toggle checked={prefs.calls} onChange={(v) => save({ calls: v })} label="Calls" />
        <Toggle checked={prefs.mentions} onChange={(v) => save({ mentions: v })} label="Mentions" />
        <Toggle checked={prefs.reactions} onChange={(v) => save({ reactions: v })} label="Reactions" />
        <Toggle checked={prefs.reminders} onChange={(v) => save({ reminders: v })} label="Study reminders" />
        <Toggle checked={prefs.watch_together} onChange={(v) => save({ watch_together: v })} label="Watch Together invites" />
      </div>
    </div>
  )
}
