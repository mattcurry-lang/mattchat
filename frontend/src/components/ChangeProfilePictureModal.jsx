import React, { useState, useRef } from 'react'
import Avatar from './Avatar'
import { uploadAvatar } from '../lib/supabase'
import PinterestPicker from './PinterestPicker'
import { IconCamera, IconX } from './Icons'

// Lightweight, always-available version of the picture-picking flow from
// ProfileSetupModal — reachable any time from the profile menu, not just
// during first-time onboarding. Doesn't touch avatar_category or
// profile_setup_completed at all, just the picture itself.
export default function ChangeProfilePictureModal({ session, userId, username, currentAvatarUrl, avatarPreference, onComplete, onClose }) {
  const [step, setStep] = useState('method') // 'method' | 'pinterest'
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState(currentAvatarUrl || null)
  const fileInputRef = useRef(null)

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return }
    if (file.size > 8 * 1024 * 1024) { setError('Image must be under 8MB.'); return }

    setError('')
    setPreviewUrl(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await uploadAvatar(userId, file)
      onComplete({ avatar_url: url, avatar_source: 'upload' })
    } catch (e) {
      console.error('uploadAvatar failed:', e)
      setError('Upload failed. Please try again.')
      setUploading(false)
    }
  }

  const handlePinterestPicked = (imageUrl) => {
    onComplete({ avatar_url: imageUrl, avatar_source: 'pinterest' })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ alignItems: 'center', textAlign: 'center' }}>
        <button
          onClick={onClose}
          style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
          aria-label="Close"
        >
          <IconX size={16} />
        </button>

        {step === 'method' && (
          <>
            <div style={{ position: 'relative' }}>
              <Avatar name={username} size={80} photoUrl={previewUrl} />
              {uploading && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff' }}>
                  Uploading…
                </div>
              )}
            </div>
            <div className="modal-title" style={{ marginTop: 10 }}>Change profile picture</div>
            {error && <div className="modal-error">{error}</div>}

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePicked} style={{ display: 'none' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 8 }}>
              <button className="btn-primary" disabled={uploading} onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <IconCamera size={16} /> Upload from device
              </button>
              <button className="btn-primary" disabled={uploading} style={{ background: 'linear-gradient(135deg,#e60023,#ad081b)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setStep('pinterest')}>
                Choose from Pinterest
              </button>
              <button className="btn-ghost" disabled={uploading} onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'pinterest' && (
          <PinterestPicker
            session={session}
            userId={userId}
            preference={avatarPreference}
            onPicked={handlePinterestPicked}
            onBack={() => setStep('method')}
          />
        )}
      </div>
    </div>
  )
}
