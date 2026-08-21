import React, { useState, useEffect, useCallback } from 'react'
import { IconX, IconUserPlus, IconTrash, IconUsers, IconCopy } from '../Icons'
import { listTrustedPeople, createTrustedInvite, updateTrustedPermission, revokeTrustedPerson } from '../../lib/cycleTrust'

const LEVEL_LABELS = { 1: 'Private', 2: 'Support', 3: 'Cycle Sharing' }

export default function TrustedCircle({ userId, onClose }) {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState(null)
  const [managing, setManaging] = useState(null) // trusted_people row being edited

  const reload = useCallback(async () => {
    setLoading(true)
    try { setPeople(await listTrustedPeople(userId)) } catch (e) { console.error(e) }
    setLoading(false)
  }, [userId])

  useEffect(() => { reload() }, [reload])

  const invite = async () => {
    setInviting(true)
    try {
      const row = await createTrustedInvite(userId, null)
      setInviteLink(row.inviteUrl)
      reload()
    } catch (e) {
      alert(e.message)
    }
    setInviting(false)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink)
  }

  const revoke = async (id) => {
    if (!window.confirm('Remove this trusted person? They will lose all access immediately.')) return
    await revokeTrustedPerson(id)
    reload()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconUsers size={16} /> Trusted Circle
        </h2>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer' }}><IconX size={15} /></button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 18px 90px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 6px' }}>
          Share select cycle info with up to two people you trust. You control exactly what each person sees, and you can revoke access anytime.
        </p>

        {loading && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: 20 }}>Loading…</div>}

        {!loading && people.map(p => (
          <div key={p.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  {p.status === 'accepted' ? (p.profiles?.username || 'Trusted person') : 'Invite pending'}
                </div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>
                  {LEVEL_LABELS[p.permission_level]} access
                </div>
              </div>
              <button onClick={() => revoke(p.id)} style={{ background: 'rgba(239,68,68,0.12)', border: 'none', borderRadius: 10, padding: '6px 10px', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
                <IconTrash size={12} /> Remove
              </button>
            </div>
            {p.status === 'accepted' && (
              <button
                onClick={() => setManaging(managing?.id === p.id ? null : p)}
                style={{ background: 'none', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 10, padding: '6px 12px', color: '#c4b5fd', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {managing?.id === p.id ? 'Close' : 'Change permissions'}
              </button>
            )}
            {managing?.id === p.id && (
              <PermissionEditor row={p} onSaved={() => { reload(); setManaging(null) }} />
            )}
          </div>
        ))}

        {!loading && people.length < 2 && (
          <>
            {inviteLink ? (
              <div style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd' }}>Share this invite link</div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', wordBreak: 'break-all' }}>{inviteLink}</div>
                <button onClick={copyLink} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg,#6c63ff,#a78bfa)', border: 'none', borderRadius: 12, padding: 10, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <IconCopy size={13} /> Copy link
                </button>
              </div>
            ) : (
              <button
                onClick={invite}
                disabled={inviting}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1.5px dashed rgba(167,139,250,0.4)', borderRadius: 16, padding: 16, color: '#c4b5fd', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <IconUserPlus size={16} /> {inviting ? 'Creating invite…' : 'Add a trusted person'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PermissionEditor({ row, onSaved }) {
  const [level, setLevel] = useState(row.permission_level)
  const [fields, setFields] = useState(row.shared_fields || {})
  const [saving, setSaving] = useState(false)

  const toggleField = (key) => setFields(prev => ({ ...prev, [key]: !prev[key] }))

  const save = async () => {
    setSaving(true)
    try {
      const { updateTrustedPermission } = await import('../../lib/cycleTrust')
      await updateTrustedPermission(row.id, { permission_level: level, shared_fields: level === 3 ? fields : {} })
      onSaved()
    } catch (e) {
      alert(e.message)
    }
    setSaving(false)
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[
        { v: 1, label: 'Private', desc: 'Nobody sees anything' },
        { v: 2, label: 'Support', desc: 'Minimal status only ("may be approaching their period")' },
        { v: 3, label: 'Cycle Sharing', desc: 'Choose exactly what to share' },
      ].map(opt => (
        <button
          key={opt.v}
          onClick={() => setLevel(opt.v)}
          style={{
            textAlign: 'left', background: level === opt.v ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${level === opt.v ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 12, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: level === opt.v ? '#c4b5fd' : '#fff' }}>{opt.label}</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{opt.desc}</div>
        </button>
      ))}

      {level === 3 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {[
            { key: 'estimatedWindow', label: 'Estimated period window' },
            { key: 'phase', label: 'Current cycle phase' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => toggleField(f.key)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${fields[f.key] ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.12)'}`,
                background: fields[f.key] ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : 'rgba(255,255,255,0.05)',
                color: fields[f.key] ? '#fff' : 'rgba(255,255,255,0.6)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <button className="btn-primary" style={{ padding: 10, fontSize: 12.5 }} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save permissions'}
      </button>
    </div>
  )
}
