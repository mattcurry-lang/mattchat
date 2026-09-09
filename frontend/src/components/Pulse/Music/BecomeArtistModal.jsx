import React, { useState } from 'react'
import { ArtistService } from '../../../lib/music/ArtistService'
import { IconX, IconMic } from '../../Icons'

export default function BecomeArtistModal({ userId, onClose, onCreated }) {
  const [artistName, setArtistName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    if (!artistName.trim()) { setError('Artist name is required'); return }
    setSubmitting(true)
    setError(null)
    try {
      const artist = await ArtistService.applyAsArtist(userId, { artistName, bio, avatarFile })
      onCreated(artist)
    } catch (e) {
      setError(e.message?.includes('duplicate') ? 'You already have an artist profile' : 'Something went wrong — try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(10,10,18,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--bg-surface-1, #14141f)', borderRadius: '20px 20px 0 0', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconMic size={18} style={{ color: '#a78bfa' }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Become a Mattchat Artist</h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><IconX size={18} /></button>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
          Anyone can publish here — your profile is active as soon as you submit. Upload music you have the rights to share.
        </p>

        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Artist name</label>
        <input value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="e.g. DJ Kesh"
          style={{ width: '100%', margin: '6px 0 14px', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)', fontSize: 13.5 }} />

        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Bio (optional)</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="A line about your sound"
          style={{ width: '100%', margin: '6px 0 14px', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)', fontSize: 13.5, resize: 'vertical', fontFamily: 'inherit' }} />

        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Artist photo (optional)</label>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
          style={{ display: 'block', margin: '6px 0 16px', fontSize: 12, color: 'var(--text-muted)' }} />

        {error && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>{error}</div>}

        <button onClick={handleSubmit} disabled={submitting}
          style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13.5, color: '#fff', background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Setting up your profile…' : 'Start publishing'}
        </button>
      </div>
    </div>
  )
}
