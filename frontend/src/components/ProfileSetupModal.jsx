import React, { useState, useRef } from 'react'
import Avatar from './Avatar'
import { uploadAvatar, skipProfileSetup, setAvatarCategory, updateProfileDetails } from '../lib/supabase'
import PinterestPicker from './PinterestPicker'
import { AVATAR_CATEGORIES } from './ProfileCard'
import { IconCamera } from './Icons'

// Survives the round trip to Pinterest and back, so people don't restart from step 1
const RESUME_KEY = 'mattchat:profileSetup:resume'
const RESUME_MAX_AGE_MS = 30 * 60 * 1000
const readResume = () => {
  try {
    const r = JSON.parse(localStorage.getItem(RESUME_KEY))
    return r && Date.now() - r.at < RESUME_MAX_AGE_MS ? r : null
  } catch { return null }
}
const saveResume = (data) => { try { localStorage.setItem(RESUME_KEY, JSON.stringify({ ...data, at: Date.now() })) } catch {} }
const clearResume = () => { try { localStorage.removeItem(RESUME_KEY) } catch {} }

const STEPS = ['category', 'bio', 'method']

const STYLES = `
@keyframes ps-pop { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
.ps-fade { animation: ps-pop .25s ease both; }
.ps-tile { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 6px; border-radius: 14px; border: 1px solid var(--border); background: var(--bg-surface-2); cursor: pointer; font-family: inherit; color: var(--text-primary); transition: transform .12s ease, border-color .12s ease, background .12s ease; }
.ps-tile:hover { border-color: rgba(167,139,250,.6); background: rgba(167,139,250,.1); }
.ps-tile:active { transform: scale(.96); }
.ps-tile.on { border-color: #a78bfa; background: rgba(167,139,250,.18); }
.ps-opt { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px; border-radius: 14px; border: 1px solid var(--border); background: var(--bg-surface-2); cursor: pointer; font-family: inherit; text-align: left; color: var(--text-primary); transition: transform .12s ease, border-color .12s ease; }
.ps-opt:hover:not(:disabled) { border-color: rgba(167,139,250,.6); }
.ps-opt:active:not(:disabled) { transform: scale(.98); }
.ps-opt:disabled { opacity: .55; cursor: default; }
`

const linkBtn = { background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 4px', minHeight: 40 }
const label = { fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4, textAlign: 'left' }

function TopBar({ index, onBack, onSkip, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 40 }}>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
        {onBack && <button onClick={onBack} disabled={disabled} aria-label="Back" style={linkBtn}>← Back</button>}
      </div>
      <div style={{ display: 'flex', gap: 6 }} role="img" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s} style={{ width: i === index ? 22 : 7, height: 7, borderRadius: 4, transition: 'width .25s ease', background: i <= index ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'var(--border)' }} />
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        {onSkip && <button onClick={onSkip} disabled={disabled} style={linkBtn}>Skip setup</button>}
      </div>
    </div>
  )
}

export default function ProfileSetupModal({ session, userId, username, onComplete, onClose, allowDismiss = false }) {
  const [resume] = useState(readResume)
  const [step, setStep] = useState(resume?.step === 'pinterest' ? 'pinterest' : 'category') // category | bio | method | pinterest
  const [category, setCategory] = useState(resume?.category ?? null)
  const [bio, setBio] = useState('')
  const [organization, setOrganization] = useState('')
  const [currentlyStudying, setCurrentlyStudying] = useState('')
  const [interestsInput, setInterestsInput] = useState('')
  const [birthday, setBirthday] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const fileInputRef = useRef(null)

  const interests = interestsInput.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8)

  // Tap now, save in the background, so slow connections never make a button feel dead
  const chooseCategory = (cat) => {
    setCategory(cat)
    setStep('bio')
    Promise.resolve(setAvatarCategory(userId, cat)).catch((e) => console.error('setAvatarCategory failed:', e))
  }

  const saveBioAndContinue = () => {
    setStep('method')
    const details = { bio: bio.trim(), organization: organization.trim(), currentlyStudying: currentlyStudying.trim(), interests, birthday: birthday || null }
    const hasAny = details.bio || details.organization || details.currentlyStudying || interests.length || details.birthday
    if (hasAny) Promise.resolve(updateProfileDetails(userId, details)).catch((e) => console.error('updateProfileDetails failed:', e))
  }

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return }
    if (file.size > 8 * 1024 * 1024) { setError('Image must be under 8MB.'); return }

    setError('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await uploadAvatar(userId, file)
      clearResume()
      onComplete({ avatar_url: url, avatar_source: 'upload', profile_setup_completed: true, avatar_category: category })
    } catch (err) {
      console.error('uploadAvatar failed:', err)
      setError('Upload failed. Please try again.')
      setUploading(false)
    }
  }

  const handleSkip = () => {
    clearResume()
    Promise.resolve(skipProfileSetup(userId)).catch((e) => console.error('skipProfileSetup failed:', e))
    onComplete({ profile_setup_completed: true, avatar_source: 'skipped', avatar_category: category })
  }

  const handlePinterestPicked = (imageUrl) => {
    clearResume()
    onComplete({ avatar_url: imageUrl, avatar_source: 'pinterest', profile_setup_completed: true, avatar_category: category })
  }

  const goPinterest = () => { saveResume({ step: 'pinterest', category }); setStep('pinterest') }
  const leavePinterest = () => { clearResume(); setStep('method') }

  return (
    <div className="modal-overlay" onClick={allowDismiss ? onClose : undefined}>
      <style>{STYLES}</style>
      <div
        className="modal-panel"
        role="dialog" aria-modal="true" aria-label="Set up your profile"
        onClick={(e) => e.stopPropagation()}
        style={{ alignItems: 'center', textAlign: 'center', width: 'min(440px, 94vw)', boxSizing: 'border-box', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <div key={step} className="ps-fade" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>

          {step === 'category' && (
            <>
              <TopBar index={0} onSkip={handleSkip} />
              <Avatar name={username} size={64} />
              <div>
                <div className="modal-title">Welcome{username ? `, ${username}` : ''} 👋</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                  What's your style? We'll use it to suggest matching pictures. It takes about 30 seconds.
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: '100%' }}>
                {AVATAR_CATEGORIES.map((c) => (
                  <button key={c.id} className={`ps-tile ${category === c.id ? 'on' : ''}`} onClick={() => chooseCategory(c.id)}>
                    <span style={{ fontSize: 26, lineHeight: 1 }}>{c.emoji}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700 }}>{c.label}</span>
                  </button>
                ))}
              </div>
              <button className="btn-ghost" onClick={handleSkip} style={{ width: '100%' }}>Skip for now</button>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>You can set this up any time from your profile.</div>
              {allowDismiss && <button className="btn-ghost" onClick={onClose}>Cancel</button>}
            </>
          )}

          {step === 'bio' && (
            <>
              <TopBar index={1} onBack={() => setStep('category')} onSkip={handleSkip} />
              <div>
                <div className="modal-title">Tell people a bit about you</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  All optional. It shows on your profile card.
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                <div>
                  <label style={label}>Short bio <span style={{ float: 'right', fontWeight: 400 }}>{bio.length}/140</span></label>
                  <textarea className="modal-textarea" placeholder="e.g. Computer Science Student" value={bio} onChange={(e) => setBio(e.target.value)} rows={2} maxLength={140} />
                </div>
                <div>
                  <label style={label}>School or company</label>
                  <input className="modal-input" placeholder="e.g. DeKUT" value={organization} onChange={(e) => setOrganization(e.target.value)} maxLength={80} />
                </div>
                <div>
                  <label style={label}>Currently studying or working on</label>
                  <input className="modal-input" placeholder="e.g. Operating Systems" value={currentlyStudying} onChange={(e) => setCurrentlyStudying(e.target.value)} maxLength={80} />
                </div>
                <div>
                  <label style={label}>Interests (separate with commas)</label>
                  <input className="modal-input" placeholder="e.g. AI, Football, Startups" value={interestsInput} onChange={(e) => setInterestsInput(e.target.value)} />
                  {interests.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {interests.map((t) => (
                        <span key={t} style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, color: '#c4b5fd', background: 'rgba(167,139,250,0.14)' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={label}>Birthday <span style={{ fontWeight: 400 }}>(so Pulse can celebrate you)</span></label>
                  <input className="modal-input" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep('method')}>Not now</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={saveBioAndContinue}>Continue</button>
              </div>
            </>
          )}

          {step === 'method' && (
            <>
              <TopBar index={2} onBack={() => setStep('bio')} disabled={uploading} />
              <div style={{ position: 'relative', padding: 3, borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)' }}>
                <Avatar name={username} size={96} photoUrl={previewUrl} />
                {uploading && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700, color: '#fff' }}>
                    Uploading…
                  </div>
                )}
              </div>
              <div>
                <div className="modal-title">Add a display picture</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>Help your friends recognise you.</div>
              </div>
              {error && <div className="modal-error" role="alert">{error}</div>}

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePicked} style={{ display: 'none' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                <button className="ps-opt" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconCamera size={18} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>Upload from device</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Choose a photo or take a new one</span>
                  </span>
                </button>
                <button className="ps-opt" disabled={uploading} onClick={goPinterest}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: '#e60023', color: '#fff', fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>P</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>Choose from Pinterest</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Pick a pin from your own boards</span>
                  </span>
                </button>
                <button className="btn-ghost" disabled={uploading} onClick={handleSkip}>Skip for now</button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>You can change this any time from your profile.</div>
            </>
          )}

          {step === 'pinterest' && (
            <PinterestPicker
              session={session}
              userId={userId}
              preference={category}
              onPicked={handlePinterestPicked}
              onBack={leavePinterest}
              onSkip={handleSkip}
            />
          )}
        </div>
      </div>
    </div>
  )
}
