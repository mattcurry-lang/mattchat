import React, { useState, useRef } from 'react'
import { createStatus, uploadStatusMedia } from '../lib/supabase'
import { IconX, IconCamera } from './Icons'

const BACKGROUNDS = [
  'linear-gradient(135deg,#6c63ff,#a78bfa)',
  'linear-gradient(135deg,#f472b6,#fb7185)',
  'linear-gradient(135deg,#38bdf8,#6c63ff)',
  'linear-gradient(135deg,#34d399,#22d3ee)',
  'linear-gradient(135deg,#fbbf24,#f97316)',
  'linear-gradient(135deg,#1f2937,#111827)',
]

export default function AddStatusModal({ userId, onClose, onPosted }) {
  const [tab, setTab] = useState('text') // text | photo | video
  const [text, setText] = useState('')
  const [bg, setBg] = useState(BACKGROUNDS[0])
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [caption, setCaption] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const pickFile = (accept) => {
    const input = fileInputRef.current
    if (!input) return
    input.accept = accept
    input.value = ''
    input.click()
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  const post = async () => {
    setError('')
    if (tab === 'text' && !text.trim()) { setError('Write something first'); return }
    if (tab !== 'text' && !file) { setError(`Choose a ${tab} first`); return }

    setPosting(true)
    try {
      if (tab === 'text') {
        await createStatus({ userId, type: 'text', caption: text.trim(), background: bg })
      } else {
        const path = await uploadStatusMedia(file, userId)
        await createStatus({ userId, type: tab === 'photo' ? 'image' : 'video', caption: caption.trim(), mediaPath: path })
      }
      onPosted?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Could not post status')
    }
    setPosting(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel status-compose-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add status</div>
          <button className="modal-close" onClick={onClose}><IconX size={14} /></button>
        </div>

        <div className="list-tabs" style={{ padding: 0 }}>
          <button className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}>Text</button>
          <button className={tab === 'photo' ? 'active' : ''} onClick={() => { setTab('photo'); pickFile('image/*') }}>Photo</button>
          <button className={tab === 'video' ? 'active' : ''} onClick={() => { setTab('video'); pickFile('video/*') }}>Video</button>
        </div>

        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />

        {tab === 'text' && (
          <>
            <div className="status-text-preview" style={{ background: bg }}>
              <textarea
                className="status-text-input"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Type a status…"
                maxLength={280}
                autoFocus
              />
            </div>
            <div className="status-bg-swatches">
              {BACKGROUNDS.map(g => (
                <button
                  key={g}
                  className={`status-bg-swatch ${bg === g ? 'active' : ''}`}
                  style={{ background: g }}
                  onClick={() => setBg(g)}
                />
              ))}
            </div>
          </>
        )}

        {tab !== 'text' && (
          <>
            {previewUrl ? (
              <div className="status-media-preview">
                {tab === 'photo'
                  ? <img src={previewUrl} alt="preview" />
                  : <video src={previewUrl} controls />}
              </div>
            ) : (
              <button className="status-pick-btn" onClick={() => pickFile(tab === 'photo' ? 'image/*' : 'video/*')}>
                <IconCamera size={26} />
                <span>Choose {tab}</span>
              </button>
            )}
            <input
              className="modal-input"
              placeholder="Add a caption (optional)"
              value={caption}
              onChange={e => setCaption(e.target.value)}
            />
          </>
        )}

        {error && <div className="modal-error">{error}</div>}

        <button className="btn-primary" style={{ width: '100%', padding: 12 }} onClick={post} disabled={posting}>
          {posting ? 'Posting…' : 'Post status'}
        </button>
      </div>
    </div>
  )
}
