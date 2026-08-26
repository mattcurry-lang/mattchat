
// Attach a walkthrough video to an already-verified dekut_location —
// either an uploaded clip (Supabase Storage) or an external link
// (YouTube, TikTok, etc). Always lands is_video_verified:false; an
// admin approves it in the Pending tab before it shows to anyone else.

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { DekutIcon } from './dekutIcons'

const MAX_VIDEO_MB = 60

const inputStyle = {
  width: '100%', border: '1px solid var(--border)', borderRadius: 10,
  padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)',
  background: 'var(--bg-surface-1, rgba(0,0,0,0.03))', fontFamily: 'inherit',
}
const labelStyle = { fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5, display: 'block' }

export default function AddVideoModal({ location, onUpload, onAttach, onClose }) {
  const [mode, setMode] = useState('link') // 'link' | 'upload'
  const [linkUrl, setLinkUrl] = useState('')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`Video is too large — please keep it under ${MAX_VIDEO_MB}MB.`)
      return
    }
    setError(null)
    setFile(f)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'link') {
        if (!linkUrl.trim()) throw new Error('Paste a video link first.')
        await onAttach(location.id, { videoType: 'link', videoUrl: linkUrl.trim() })
      } else {
        if (!file) throw new Error('Choose a video file first.')
        const uploadedUrl = await onUpload(file)
        await onAttach(location.id, { videoType: 'upload', videoUrl: uploadedUrl })
      }
      setDone(true)
    } catch (err) {
      console.error('AddVideoModal submit failed:', err)
      setError(err.message || 'Could not save this video — please try again.')
    }
    setSubmitting(false)
  }

  return createPortal(
    <div
      role="dialog" aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200, display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, background: 'var(--bg-surface-2)',
          border: '1px solid var(--border)', borderRadius: 20, padding: 20,
          maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>🎥 Add a Video</div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <DekutIcon type="x" size={16} color="var(--text-primary)" strokeWidth={2.2} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
          Show other students exactly how to get to <strong>{location?.name}</strong>.
        </div>

        {done ? (
          <div style={{ padding: '18px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Thanks!</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              This will show up on {location?.name} once it's reviewed and approved.
            </div>
            <button
              onClick={onClose}
              style={{
                marginTop: 14, background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', border: 'none',
                borderRadius: 999, color: '#fff', fontWeight: 700, fontSize: 12.5, padding: '9px 18px',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ id: 'link', label: 'Video link' }, { id: 'upload', label: 'Upload a clip' }].map((m) => {
                const active = mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    style={{
                      flex: 1, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                      borderRadius: 999, padding: '8px 0',
                      border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
                      background: active ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : 'transparent',
                      color: active ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>

            {mode === 'link' ? (
              <div>
                <label style={labelStyle}>Video link</label>
                <input
                  style={inputStyle}
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="YouTube, TikTok, or any video URL"
                  type="url"
                  required={mode === 'link'}
                  autoFocus
                />
              </div>
            ) : (
              <div>
                <label style={labelStyle}>Video file</label>
                <input
                  style={inputStyle}
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  required={mode === 'upload'}
                />
                <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Max {MAX_VIDEO_MB}MB. A short walkthrough (15–30 seconds) is plenty.
                </div>
              </div>
            )}

            {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}

            <button
              type="submit"
              disabled={submitting}
              style={{
                background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', border: 'none', borderRadius: 999,
                color: '#fff', fontWeight: 700, fontSize: 13, padding: '11px 18px', cursor: submitting ? 'default' : 'pointer',
                fontFamily: 'inherit', opacity: submitting ? 0.6 : 1, marginTop: 4,
              }}
            >
              {submitting ? (mode === 'upload' ? 'Uploading…' : 'Submitting…') : 'Submit for review'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}
