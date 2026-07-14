import React, { useState, useRef } from 'react'
import Avatar from './Avatar'
import { uploadAvatar, skipProfileSetup, setUsagePreference } from '../lib/supabase'
import PinterestPicker from './PinterestPicker'

export default function ProfileSetupModal({ session, userId, username, onComplete, onClose, allowDismiss = false }) {
  const [step, setStep] = useState('usage') // 'usage' | 'method' | 'pinterest'
  const [preference, setPreference] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const fileInputRef = useRef(null)

  const choosePreference = async (pref) => {
    setPreference(pref)
    try { await setUsagePreference(userId, pref) } catch (e) { console.error(e) }
    setStep('method')
  }

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
      onComplete({ avatar_url: url, avatar_source: 'upload', profile_setup_completed: true, usage_preference: preference })
    } catch (e) {
      console.error('uploadAvatar failed:', e)
      setError('Upload failed. Please try again.')
      setUploading(false)
    }
  }

  const handleSkip = async () => {
    try { await skipProfileSetup(userId) } catch (e) { console.error(e) }
    onComplete({ profile_setup_completed: true, avatar_source: 'skipped', usage_preference: preference })
  }

  const handlePinterestPicked = (imageUrl) => {
    onComplete({ avatar_url: imageUrl, avatar_source: 'pinterest', profile_setup_completed: true, usage_preference: preference })
  }

  return (
    <div className="modal-overlay" onClick={allowDismiss ? onClose : undefined}>
      <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ alignItems: 'center', textAlign: 'center' }}>

        {step === 'usage' && (
          <>
            <Avatar name={username} size={64} />
            <div className="modal-title" style={{ marginTop: 10 }}>How will you use Mattchat?</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              This helps us suggest the right kind of display picture.
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 8 }}>
              <button className="btn-primary" style={{ flex: 1, padding: '14px 10px' }} onClick={() => choosePreference('professional')}>
                💼 Professional
              </button>
              <button className="btn-primary" style={{ flex: 1, padding: '14px 10px' }} onClick={() => choosePreference('personal')}>
                🙂 Personal
              </button>
            </div>
            {allowDismiss && <button className="btn-ghost" style={{ marginTop: 4 }} onClick={onClose}>Cancel</button>}
          </>
        )}

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
            <div className="modal-title" style={{ marginTop: 10 }}>Add a display picture</div>
            {error && <div className="modal-error">{error}</div>}

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePicked} style={{ display: 'none' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 8 }}>
              <button className="btn-primary" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                🖼️ Upload from device
              </button>
              <button className="btn-primary" disabled={uploading} style={{ background: 'linear-gradient(135deg,#e60023,#ad081b)' }} onClick={() => setStep('pinterest')}>
                📌 Choose from Pinterest
              </button>
              <button className="btn-ghost" disabled={uploading} onClick={handleSkip}>
                Skip for now
              </button>
            </div>
          </>
        )}

        {step === 'pinterest' && (
          <PinterestPicker
            session={session}
            userId={userId}
            preference={preference}
            onPicked={handlePinterestPicked}
            onBack={() => setStep('method')}
          />
        )}
      </div>
    </div>
  )
}
