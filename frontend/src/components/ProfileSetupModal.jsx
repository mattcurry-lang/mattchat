import React, { useState, useRef } from 'react'
import Avatar from './Avatar'
import { uploadAvatar, skipProfileSetup, setAvatarCategory, updateProfileDetails } from '../lib/supabase'
import PinterestPicker from './PinterestPicker'
import { AVATAR_CATEGORIES } from './ProfileCard'

export default function ProfileSetupModal({ session, userId, username, onComplete, onClose, allowDismiss = false }) {
  const [step, setStep] = useState('category') // 'category' | 'bio' | 'method' | 'pinterest'
  const [category, setCategory] = useState(null)
  const [bio, setBio] = useState('')
  const [organization, setOrganization] = useState('')
  const [currentlyStudying, setCurrentlyStudying] = useState('')
  const [interestsInput, setInterestsInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const fileInputRef = useRef(null)

  const chooseCategory = async (cat) => {
    setCategory(cat)
    try { await setAvatarCategory(userId, cat) } catch (e) { console.error(e) }
    setStep('bio')
  }

  const saveBioAndContinue = async () => {
    const interests = interestsInput.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8)
    try {
      await updateProfileDetails(userId, { bio, organization, currentlyStudying, interests })
    } catch (e) {
      console.error('updateProfileDetails failed:', e)
    }
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
      onComplete({ avatar_url: url, avatar_source: 'upload', profile_setup_completed: true, avatar_category: category })
    } catch (e) {
      console.error('uploadAvatar failed:', e)
      setError('Upload failed. Please try again.')
      setUploading(false)
    }
  }

  const handleSkip = async () => {
    try { await skipProfileSetup(userId) } catch (e) { console.error(e) }
    onComplete({ profile_setup_completed: true, avatar_source: 'skipped', avatar_category: category })
  }

  const handlePinterestPicked = (imageUrl) => {
    onComplete({ avatar_url: imageUrl, avatar_source: 'pinterest', profile_setup_completed: true, avatar_category: category })
  }

  return (
    <div className="modal-overlay" onClick={allowDismiss ? onClose : undefined}>
      <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ alignItems: 'center', textAlign: 'center' }}>

        {step === 'category' && (
          <>
            <Avatar name={username} size={64} />
            <div className="modal-title" style={{ marginTop: 10 }}>What's your style?</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              We'll suggest matching Pinterest boards when you pick a picture.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, width: '100%', marginTop: 6 }}>
              {AVATAR_CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => chooseCategory(c.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '12px 6px', borderRadius: 12, border: '1px solid var(--border)',
                    background: 'var(--bg-surface-2)', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{c.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{c.label}</span>
                </button>
              ))}
            </div>
            {allowDismiss && <button className="btn-ghost" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>}
          </>
        )}

        {step === 'bio' && (
          <>
            <div className="modal-title">Tell people a bit about you</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>
              Optional — shown on your profile card. Skip if you'd rather not.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <textarea
                className="modal-textarea"
                placeholder="Short bio (e.g. Computer Science Student)"
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={2}
                maxLength={140}
              />
              <input
                className="modal-input"
                placeholder="School or company (e.g. DeKUT)"
                value={organization}
                onChange={e => setOrganization(e.target.value)}
                maxLength={80}
              />
              <input
                className="modal-input"
                placeholder="Currently studying / working on (e.g. Operating Systems)"
                value={currentlyStudying}
                onChange={e => setCurrentlyStudying(e.target.value)}
                maxLength={80}
              />
              <input
                className="modal-input"
                placeholder="Interests, comma separated (e.g. AI, Football, Startups)"
                value={interestsInput}
                onChange={e => setInterestsInput(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 10 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep('method')}>Skip</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={saveBioAndContinue}>Continue</button>
            </div>
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
            category={category}
            onPicked={handlePinterestPicked}
            onBack={() => setStep('method')}
          />
        )}
      </div>
    </div>
  )
}
